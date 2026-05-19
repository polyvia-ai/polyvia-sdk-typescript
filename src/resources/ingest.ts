import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { IngestionError, IngestionTimeout } from "../errors.js";
import type { Transport } from "../transport.js";
import type {
  BatchIngestItem,
  IngestResult,
  IngestionStatus,
} from "../types.js";

export interface IngestFileOptions {
  name?: string;
  groupId?: string;
  /** Override the inferred MIME type. */
  contentType?: string;
}

export interface IngestBatchOptions {
  names?: string[];
  groupId?: string;
  /** Override the inferred MIME type for each file (aligned with `sources`). */
  contentTypes?: string[];
}

export interface WaitOptions {
  /** Poll interval in seconds (default 5) */
  pollInterval?: number;
  /** Timeout in seconds (default 300) */
  timeout?: number;
}

// Direct PUTs to storage need a generous timeout window — large files over
// slow connections can take a while. We don't enforce it client-side here
// (fetch has no built-in timeout); document it instead.

const EXT_TO_MIME: Record<string, string> = {
  ".pdf":  "application/pdf",
  ".doc":  "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt":  "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xls":  "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt":  "text/plain",
  ".md":   "text/markdown",
  ".html": "text/html",
  ".htm":  "text/html",
  ".csv":  "text/csv",
  ".json": "application/json",
  ".rtf":  "application/rtf",
  ".mp3":  "audio/mpeg",
  ".m4a":  "audio/mp4",
  ".wav":  "audio/wav",
  ".webm": "audio/webm",
  ".ogg":  "audio/ogg",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
};

function inferMime(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

interface UploadUrlResponse {
  upload_url: string;
}

interface ConvexStoragePutResponse {
  storageId: string;
}

interface FinalizeBody {
  storage_id: string;
  file_type: string;
  name?: string;
  group_id?: string;
}

/** Normalised representation of one input file used during direct upload. */
interface Source {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

async function toSource(
  input: string | Buffer | Blob,
  explicitName: string | undefined,
  explicitContentType: string | undefined,
): Promise<Source> {
  if (typeof input === "string") {
    const buf = await readFile(input);
    const filename = explicitName ?? basename(input);
    return {
      bytes: new Uint8Array(buf),
      filename,
      contentType: explicitContentType ?? inferMime(filename),
    };
  }
  if (Buffer.isBuffer(input)) {
    const filename = explicitName ?? "upload";
    return {
      bytes: new Uint8Array(input),
      filename,
      contentType: explicitContentType ?? inferMime(filename),
    };
  }
  const blob = input;
  const filename = explicitName ?? "upload";
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    filename,
    contentType: explicitContentType ?? blob.type ?? inferMime(filename),
  };
}

export class IngestResource {
  constructor(private readonly transport: Transport) {}

  /** Get a short-lived storage URL, PUT bytes directly, then finalize. */
  private async uploadOne(
    source: Source,
    options: { name?: string; groupId?: string },
  ): Promise<IngestResult> {
    const { upload_url } = await this.transport.post<UploadUrlResponse>(
      "/api/v1/ingest/upload-url",
      {},
    );

    // PUT bytes straight to Convex storage. Important: do NOT send our
    // Polyvia Authorization header — the URL is already signed, and we
    // shouldn't leak the API key to a different origin.
    const putRes = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": source.contentType },
      // Cast: Uint8Array is a valid BlobPart at runtime in Node 18+ and all
      // browsers, but TS's lib.dom types disagree about ArrayBufferLike vs
      // ArrayBuffer. The runtime behavior is well-defined.
      body: new Blob([source.bytes as unknown as BlobPart]),
    });
    if (!putRes.ok) {
      const detail = await putRes.text().catch(() => "");
      throw new Error(
        `Direct upload to storage failed (HTTP ${putRes.status}): ${detail}`,
      );
    }
    const { storageId } = (await putRes.json()) as ConvexStoragePutResponse;

    const body: FinalizeBody = {
      storage_id: storageId,
      file_type: source.contentType,
      name: options.name ?? source.filename,
    };
    if (options.groupId) body.group_id = options.groupId;

    return this.transport.post<IngestResult>("/api/v1/ingest/finalize", body);
  }

  /** Upload a single file. Accepts a file path, Buffer, or Blob.
   *
   *  Bytes are uploaded directly to Polyvia's storage backend (the API
   *  server is not in the upload path), so there is no practical
   *  file-size cap from the SDK side. */
  async file(
    source: string | Buffer | Blob,
    options: IngestFileOptions = {},
  ): Promise<IngestResult> {
    const src = await toSource(source, options.name, options.contentType);
    const callOptions: { name?: string; groupId?: string } = {};
    if (options.name !== undefined) callOptions.name = options.name;
    if (options.groupId !== undefined) callOptions.groupId = options.groupId;
    return this.uploadOne(src, callOptions);
  }

  /** Upload multiple files. Each file is uploaded directly and finalized
   *  independently — a failure on one file does not affect the others. */
  async batch(
    sources: Array<string | Buffer | Blob>,
    options: IngestBatchOptions = {},
  ): Promise<BatchIngestItem[]> {
    const results: BatchIngestItem[] = [];
    for (let i = 0; i < sources.length; i++) {
      const explicitName = options.names?.[i];
      const explicitContentType = options.contentTypes?.[i];
      let src: Source;
      try {
        src = await toSource(sources[i]!, explicitName, explicitContentType);
      } catch (e) {
        results.push({
          document_id: null,
          task_id: null,
          status: "failed",
          error: (e as Error).message,
        });
        continue;
      }
      const callOptions: { name?: string; groupId?: string } = {};
      if (explicitName !== undefined) callOptions.name = explicitName;
      if (options.groupId !== undefined) callOptions.groupId = options.groupId;
      try {
        const r = await this.uploadOne(src, callOptions);
        results.push({
          document_id: r.document_id,
          task_id: r.task_id,
          status: r.status,
          error: null,
        });
      } catch (e) {
        results.push({
          document_id: null,
          task_id: null,
          status: "failed",
          error: (e as Error).message,
        });
      }
    }
    return results;
  }

  /** Poll ingestion status for a task. */
  async status(taskId: string): Promise<IngestionStatus> {
    return this.transport.get<IngestionStatus>(`/api/v1/ingest/${taskId}`);
  }

  /** Block until the task is completed, polling every `pollInterval` seconds.
   *  Throws `IngestionError` on failure, `IngestionTimeout` on timeout. */
  async wait(taskId: string, options: WaitOptions = {}): Promise<IngestionStatus> {
    const pollMs = (options.pollInterval ?? 5) * 1000;
    const timeoutMs = (options.timeout ?? 300) * 1000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const s = await this.status(taskId);
      if (s.status === "completed") return s;
      if (s.status === "failed") {
        throw new IngestionError(taskId, s.error ?? "unknown error");
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }

    throw new IngestionTimeout(taskId);
  }
}
