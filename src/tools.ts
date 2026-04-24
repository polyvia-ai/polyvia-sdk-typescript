import type { QueryOptions } from "./client.js";
import type { Polyvia } from "./client.js";
import type { ListDocumentsOptions } from "./resources/documents.js";

// ── Tool schemas ──────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "polyvia_ingest_document",
    description: "Upload a document to Polyvia for parsing and indexing. Returns a task_id to poll for status.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Display name for the document" },
        group_id: { type: "string", description: "Group to assign the document to" },
      },
      required: [],
    },
  },
  {
    name: "polyvia_check_ingestion_status",
    description: "Check the ingestion status of a document upload task.",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID from polyvia_ingest_document" },
      },
      required: ["task_id"],
    },
  },
  {
    name: "polyvia_list_documents",
    description: "List documents in the Polyvia workspace, optionally filtered by status or group.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["uploading", "parsing", "completed", "failed"] },
        group_id: { type: "string" },
        group_ids: { type: "array", items: { type: "string" } },
      },
      required: [],
    },
  },
  {
    name: "polyvia_get_document",
    description: "Get metadata and summary for a single document.",
    parameters: {
      type: "object",
      properties: {
        document_id: { type: "string" },
      },
      required: ["document_id"],
    },
  },
  {
    name: "polyvia_update_document",
    description: "Move a document to a different group, or remove it from its current group.",
    parameters: {
      type: "object",
      properties: {
        document_id: { type: "string" },
        group_id: { type: ["string", "null"], description: "Target group ID, or null to remove from any group" },
      },
      required: ["document_id", "group_id"],
    },
  },
  {
    name: "polyvia_delete_document",
    description: "Permanently delete a document and all its indexed content.",
    parameters: {
      type: "object",
      properties: {
        document_id: { type: "string" },
      },
      required: ["document_id"],
    },
  },
  {
    name: "polyvia_query",
    description: "Ask a natural-language question about documents. Scope to a document, group, or the entire workspace.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Your natural-language question" },
        document_id: { type: "string", description: "Query a single document" },
        group_id: { type: "string", description: "Query documents in a specific group" },
        group_ids: { type: "array", items: { type: "string" }, description: "Query across multiple groups" },
      },
      required: ["query"],
    },
  },
  {
    name: "polyvia_list_groups",
    description: "List all document groups in the workspace.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "polyvia_create_group",
    description: "Create a new document group.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Display name for the group" },
      },
      required: ["name"],
    },
  },
  {
    name: "polyvia_delete_group",
    description: "Delete a group. Must be empty unless delete_documents is true.",
    parameters: {
      type: "object",
      properties: {
        group_id: { type: "string" },
        delete_documents: { type: "boolean", description: "Delete all documents in the group first" },
      },
      required: ["group_id"],
    },
  },
] as const;

// ── Executor ──────────────────────────────────────────────────────────────────

type Args = Record<string, unknown>;

function makeExecutor(client: Polyvia) {
  return async (name: string, args: Args): Promise<unknown> => {
    switch (name) {
      case "polyvia_ingest_document":
        return client.ingest.status(args["task_id"] as string);

      case "polyvia_check_ingestion_status":
        return client.ingest.status(args["task_id"] as string);

      case "polyvia_list_documents": {
        const opts: ListDocumentsOptions = {};
        if (args["status"] !== undefined) opts.status = args["status"] as string;
        if (args["group_id"] !== undefined) opts.groupId = args["group_id"] as string;
        if (args["group_ids"] !== undefined) opts.groupIds = args["group_ids"] as string[];
        return client.documents.list(opts);
      }

      case "polyvia_get_document":
        return client.documents.get(args["document_id"] as string);

      case "polyvia_update_document":
        return client.documents.update(args["document_id"] as string, {
          groupId: args["group_id"] as string | null,
        });

      case "polyvia_delete_document":
        return client.documents.delete(args["document_id"] as string);

      case "polyvia_query": {
        const opts: QueryOptions = {};
        if (args["document_id"] !== undefined) opts.documentId = args["document_id"] as string;
        if (args["group_id"] !== undefined) opts.groupId = args["group_id"] as string;
        if (args["group_ids"] !== undefined) opts.groupIds = args["group_ids"] as string[];
        return client.query(args["query"] as string, opts);
      }

      case "polyvia_list_groups":
        return client.groups.list();

      case "polyvia_create_group":
        return client.groups.create(args["name"] as string);

      case "polyvia_delete_group": {
        const delOpts: { deleteDocuments?: boolean } = {};
        if (args["delete_documents"] !== undefined) delOpts.deleteDocuments = args["delete_documents"] as boolean;
        return client.groups.delete(args["group_id"] as string, delOpts);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  };
}

// ── Format adapters ───────────────────────────────────────────────────────────

type Executor = (name: string, args: Args) => Promise<unknown>;

export type OpenAITool = {
  type: "function";
  function: { name: string; description: string; parameters: object };
};

export type AnthropicTool = {
  name: string;
  description: string;
  input_schema: object;
};

export class ToolsResource {
  constructor(private readonly client: Polyvia) {}

  /** OpenAI ChatCompletion / Responses API tool format. */
  openai(): [OpenAITool[], Executor] {
    const tools: OpenAITool[] = TOOLS.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    return [tools, makeExecutor(this.client)];
  }

  /** Anthropic Messages API tool format. */
  anthropic(): [AnthropicTool[], Executor] {
    const tools: AnthropicTool[] = TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
    return [tools, makeExecutor(this.client)];
  }
}
