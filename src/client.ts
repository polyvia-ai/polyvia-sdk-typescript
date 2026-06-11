import { MCPConfig } from "./mcp.js";
import { DocumentsResource } from "./resources/documents.js";
import { GroupsResource, resolveGroupId, type GroupRef } from "./resources/groups.js";
import { IngestResource } from "./resources/ingest.js";
import { ToolsResource } from "./tools.js";
import { Transport } from "./transport.js";
import type { QueryResult, RateLimits, Usage } from "./types.js";

export interface PolyviaOptions {
  /** API key (defaults to POLYVIA_API_KEY env var). */
  apiKey?: string;
  /** Override the base URL (default: https://app.polyvia.ai). */
  baseUrl?: string;
}

export interface QueryOptions {
  /** Restrict to a single document (fastest). */
  documentId?: string;
  /** Restrict to one group by **name** (or a {@link Group}). The group must
   *  already exist. Prefer this over `groupId`. */
  group?: GroupRef;
  /** Restrict to one group by backend id. */
  groupId?: string;
  /** Restrict to documents across multiple groups. */
  groupIds?: string[];
}

export class Polyvia {
  readonly ingest: IngestResource;
  readonly documents: DocumentsResource;
  readonly groups: GroupsResource;
  readonly tools: ToolsResource;

  private readonly _transport: Transport;
  private readonly _apiKey: string;
  private readonly _baseUrl: string;

  constructor(options: PolyviaOptions = {}) {
    const apiKey = options.apiKey ?? process.env["POLYVIA_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "api_key is required. Pass it explicitly or set the POLYVIA_API_KEY environment variable.",
      );
    }
    this._apiKey = apiKey;
    this._baseUrl = options.baseUrl ?? "https://app.polyvia.ai";
    this._transport = new Transport(this._apiKey, this._baseUrl);

    this.ingest = new IngestResource(this._transport);
    this.documents = new DocumentsResource(this._transport);
    this.groups = new GroupsResource(this._transport);
    this.tools = new ToolsResource(this);
  }

  /** MCP server connection helpers. */
  get mcp(): MCPConfig {
    return new MCPConfig(`${this._baseUrl}/mcp`, {
      Authorization: `Bearer ${this._apiKey}`,
    });
  }

  /** Query documents with natural language. */
  async query(question: string, options: QueryOptions = {}): Promise<QueryResult> {
    const groupId =
      options.group !== undefined &&
      options.groupId === undefined &&
      options.groupIds === undefined
        ? await resolveGroupId(this._transport, options.group, undefined, { create: false })
        : options.groupId;
    return this._transport.post<QueryResult>("/api/v1/query", {
      query: question,
      ...(options.documentId && { document_id: options.documentId }),
      ...(groupId && { group_id: groupId }),
      ...(options.groupIds && { group_ids: options.groupIds }),
    });
  }

  /** Return request and document usage for the current API key. */
  async usage(): Promise<Usage> {
    return this._transport.get<Usage>("/api/v1/usage");
  }

  /** Return rate-limit thresholds and remaining capacity. */
  async rateLimits(): Promise<RateLimits> {
    return this._transport.get<RateLimits>("/api/v1/rate-limits");
  }
}
