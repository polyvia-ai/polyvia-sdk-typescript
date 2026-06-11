export interface IngestResult {
  document_id: string;
  task_id: string;
  status: string;
}

export interface BatchIngestItem {
  document_id: string | null;
  task_id: string | null;
  status: string;
  error: string | null;
}

export interface BatchIngestResult {
  results: BatchIngestItem[];
}

export type IngestionStatusValue = "pending" | "parsing" | "completed" | "failed";

export interface IngestionStatus {
  task_id: string;
  document_id: string;
  status: IngestionStatusValue;
  error: string | null;
}

export interface Document {
  id: string;
  title: string;
  status: string;
  file_type: string;
  file_url?: string;
  summary: string;
  created_at: number;
  group_id: string | null;
}

export interface Group {
  id: string;
  name: string;
  /** Optional — not returned when a group is created, only when listed. */
  color?: string;
  /** Optional — not returned when a group is created, only when listed. */
  created_at?: number;
}

export interface QueryResult {
  answer: string;
  document_id?: string;
}

export interface UsageCounters {
  period: number;
  total: number;
}

export interface UsageData {
  requests: UsageCounters;
  ingests: UsageCounters;
  queries: UsageCounters;
  /**
   * Workspace-scoped page count — sum across completed ingests in the
   * workspace this key belongs to. `requests` / `ingests` / `queries` are
   * per-key; `pages` and `audio_seconds` are per-workspace.
   */
  pages: UsageCounters;
  /**
   * Workspace-scoped audio seconds processed (whole seconds). Convert to
   * minutes (`audio_seconds.period / 60`) for display if needed.
   */
  audio_seconds: UsageCounters;
  documents_stored: number;
}

export interface Usage {
  usage: UsageData;
}

export interface RateLimits {
  limits: Record<string, number>;
  current: Record<string, number>;
  resets_at: {
    minute: string;
    month: string;
  };
}

export interface MCPServerConfig {
  type: string;
  url: string;
  headers: Record<string, string>;
  name?: string;
  server_label?: string;
  server_url?: string;
  require_approval?: string;
}
