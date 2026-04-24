export const VERSION = "0.1.0";

export { Polyvia } from "./client.js";
export type { PolyviaOptions, QueryOptions } from "./client.js";

export { MCPConfig } from "./mcp.js";

export {
  PolyviaError,
  APIError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  IngestionError,
  IngestionTimeout,
} from "./errors.js";

export type {
  IngestResult,
  BatchIngestItem,
  BatchIngestResult,
  IngestionStatus,
  IngestionStatusValue,
  Document,
  Group,
  QueryResult,
  Usage,
  UsageData,
  UsageCounters,
  RateLimits,
} from "./types.js";

export type { OpenAITool, AnthropicTool } from "./tools.js";
export type { IngestFileOptions, IngestBatchOptions, WaitOptions } from "./resources/ingest.js";
export type { ListDocumentsOptions } from "./resources/documents.js";
