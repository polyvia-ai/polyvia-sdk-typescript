import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { IngestionError, IngestionTimeout } from "../errors.js";
import type { Transport } from "../transport.js";
import type {
  BatchIngestItem,
  BatchIngestResult,
  IngestResult,
  IngestionStatus,
} from "../types.js";

export interface IngestFileOptions {
  name?: string;
  groupId?: string;
}

export interface IngestBatchOptions {
  names?: string[];
  groupId?: string;
}

export interface WaitOptions {
  /** Poll interval in seconds (default 5) */
  pollInterval?: number;
  /** Timeout in seconds (default 300) */
  timeout?: number;
}

export class IngestResource {
  constructor(private readonly transport: Transport) {}

  /** Upload a single file. Accepts a file path, Buffer, or Blob. */
  async file(
    source: string | Buffer | Blob,
    options: IngestFileOptions = {},
  ): Promise<IngestResult> {
    const form = new FormData();

    if (typeof source === "string") {
      const buf = await readFile(source);
      const filename = options.name ?? basename(source);
      form.append("file", new Blob([buf]), filename);
    } else if (Buffer.isBuffer(source)) {
      form.append("file", new Blob([new Uint8Array(source)]), options.name ?? "upload");
    } else {
      form.append("file", source, options.name ?? "upload");
    }

    if (options.name) form.append("name", options.name);
    if (options.groupId) form.append("group_id", options.groupId);

    return this.transport.postForm<IngestResult>("/api/v1/ingest", form);
  }

  /** Upload multiple files in a single request. */
  async batch(
    sources: Array<string | Buffer | Blob>,
    options: IngestBatchOptions = {},
  ): Promise<BatchIngestItem[]> {
    const form = new FormData();

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i]!;
      const name = options.names?.[i];

      if (typeof source === "string") {
        const buf = await readFile(source);
        form.append("files", new Blob([buf]), name ?? basename(source));
      } else if (Buffer.isBuffer(source)) {
        form.append("files", new Blob([new Uint8Array(source)]), name ?? "upload");
      } else {
        form.append("files", source, name ?? "upload");
      }

      if (name) form.append("names", name);
    }

    if (options.groupId) form.append("group_id", options.groupId);

    const result = await this.transport.postForm<BatchIngestResult>(
      "/api/v1/ingest/batch",
      form,
    );
    return result.results;
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
