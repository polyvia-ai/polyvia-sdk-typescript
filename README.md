# polyvia

[![npm](https://img.shields.io/npm/v/polyvia?style=flat-square&color=6366f1&labelColor=3730a3&logo=npm&logoColor=white)](https://www.npmjs.com/package/polyvia)
[![Node](https://img.shields.io/node/v/polyvia?style=flat-square&color=6366f1&labelColor=3730a3&logo=nodedotjs&logoColor=white)](https://www.npmjs.com/package/polyvia)
[![License: MIT](https://img.shields.io/badge/license-MIT-6366f1?style=flat-square&labelColor=3730a3)](https://opensource.org/licenses/MIT)
[![Docs](https://img.shields.io/badge/docs-docs.polyvia.ai-6366f1?style=flat-square&labelColor=3730a3)](https://docs.polyvia.ai/products/js-sdk)

Official TypeScript/JavaScript SDK for [Polyvia AI Platform](https://app.polyvia.ai).

```ts
import { Polyvia } from "polyvia";

const client = new Polyvia({ apiKey: "poly_<key>" });

// Ingest → wait → query
const result = await client.ingest.file("report.pdf", { name: "Q4 Report" });
await client.ingest.wait(result.task_id);
const answer = await client.query("What are the key findings?");
console.log(answer.answer);
```

---

## Table of Contents

- [Installation](#installation)
- [Authentication](#authentication)
- [REST API](#rest-api)
  - [Ingest](#ingest)
  - [Query](#query)
  - [Groups](#groups)
  - [Documents](#documents)
  - [Usage & Rate Limits](#usage--rate-limits)
- [MCP Server](#mcp-server)
  - [Anthropic beta MCP client](#anthropic-beta-mcp-client)
  - [OpenAI Responses API](#openai-responses-api)
  - [OpenAI Agents SDK](#openai-agents-sdk)
  - [Claude Desktop](#claude-desktop)
- [Agent Tools (programmatic)](#agent-tools-programmatic)
  - [OpenAI ChatCompletion](#openai-chatcompletion)
  - [Anthropic Messages API](#anthropic-messages-api)
- [Error Handling](#error-handling)
- [Development](#development)

---

## Installation

```bash
npm install polyvia
```

Requires Node.js 18+.

---

## Authentication

Generate an API key at **[app.polyvia.ai → Settings → API](https://app.polyvia.ai/settings)**.
All keys start with `poly_`.

```ts
// Pass explicitly
const client = new Polyvia({ apiKey: "poly_<key>" });

// Or set the environment variable and omit the argument
// export POLYVIA_API_KEY=poly_<key>
const client = new Polyvia();
```

---

## REST API

### Ingest

```ts
// Single file — accepts a file path, Buffer, or Blob
const result = await client.ingest.file("report.pdf", {
  name: "Q4 Report",
  groupId: "g_<id>",
});
// { "document_id": "<id>", "task_id": "<id>", status: "pending" }

// Multiple files
const items = await client.ingest.batch(["q3.pdf", "q4.pdf"], {
  names: ["Q3 Report", "Q4 Report"],
  groupId: "g_<id>",
});

// Check status
const status = await client.ingest.status(result.task_id);

// Block until done — throws IngestionError on failure, IngestionTimeout on timeout
const done = await client.ingest.wait(result.task_id, {
  pollInterval: 5,   // seconds
  timeout: 300,      // seconds
});
```

### Query

```ts
// All completed documents
const answer = await client.query("What risks are mentioned across all reports?");

// Single document (fastest)
const answer = await client.query("Summarise section 3.", { documentId: "doc_<id>" });

// Scoped to a group
const answer = await client.query("Key findings?", { groupId: "g_<id>" });

// Multiple groups
const answer = await client.query("Compare results.", { groupIds: ["g_<id>", "g_<id>"] });

console.log(answer.answer);
```

### Groups

```ts
// Create
const { group_id } = await client.groups.create("Finance");

// List
const groups = await client.groups.list();

// Delete all documents in a group, then the group itself
await client.groups.delete(group_id, { deleteDocuments: true });

// Or separately
await client.groups.deleteDocuments(group_id);
await client.groups.delete(group_id);
```

### Documents

```ts
// List — filter by status and/or group
const docs = await client.documents.list({ status: "completed", groupId: "g_<id>" });
const docs = await client.documents.list({ groupIds: ["g_<id>", "g_<id>"] });

// Get one
const doc = await client.documents.get("doc_<id>");

// Move to a different group / remove from group
await client.documents.update("doc_<id>", { groupId: "g_other" });
await client.documents.update("doc_<id>", { groupId: null });

// Delete
await client.documents.delete("doc_<id>");
```

### Usage & Rate Limits

```ts
const usage = await client.usage();
console.log(usage.usage.requests.period);     // requests this calendar month
console.log(usage.usage.documents_stored);    // live document count

const limits = await client.rateLimits();
console.log(limits.limits["requests_per_minute"]);
console.log(limits.current["remaining_this_minute"]);
console.log(limits.resets_at.month);          // ISO timestamp of next monthly reset
```

---

## MCP Server

Polyvia runs a hosted [Model Context Protocol](https://modelcontextprotocol.io) server at
`https://app.polyvia.ai/mcp`. Connect your AI client once and it can ingest, search,
and query documents without any manual tool-dispatch code.

`client.mcp` returns an `MCPConfig` object with a helper for every major client:

| Method | Use with |
|--------|----------|
| `toAnthropicMcpServer()` | `ant.beta.messages.create({ mcp_servers: [...] })` |
| `toOpenAIResponsesTool()` | `oai.responses.create({ tools: [...] })` |
| `toOpenAIMcpServer()` | OpenAI Agents SDK `MCPServerStreamableHTTP` |
| `toClaudeDesktopConfig()` | `~/.claude/claude_desktop_config.json` |

### Anthropic beta MCP client

```ts
import Anthropic from "@anthropic-ai/sdk";
import { Polyvia } from "polyvia";

const polyvia = new Polyvia({ apiKey: "poly_<key>" });
const ant = new Anthropic();

const response = await ant.beta.messages.create({
  model: "claude-opus-4-5",
  max_tokens: 1000,
  messages: [{ role: "user", content: "What are my Q4 findings?" }],
  mcp_servers: [polyvia.mcp.toAnthropicMcpServer()],
  betas: ["mcp-client-2025-04-04"],
});
```

### OpenAI Responses API

```ts
import OpenAI from "openai";
import { Polyvia } from "polyvia";

const polyvia = new Polyvia({ apiKey: "poly_<key>" });
const oai = new OpenAI();

const response = await oai.responses.create({
  model: "gpt-4o",
  tools: [polyvia.mcp.toOpenAIResponsesTool()],
  input: "What are my Q4 findings?",
});
console.log(response.output_text);
```

### OpenAI Agents SDK

```ts
import { Agent, Runner } from "@openai/agents";
import { MCPServerStreamableHTTP } from "@openai/agents/mcp";
import { Polyvia } from "polyvia";

const cfg = new Polyvia({ apiKey: "poly_<key>" }).mcp.toOpenAIMcpServer();
const server = new MCPServerStreamableHTTP({ url: cfg.url, headers: cfg.headers });
const agent = new Agent({ name: "Research", mcpServers: [server] });
const result = await Runner.runSync(agent, "What do my Q4 reports say about revenue?");
console.log(result.finalOutput);
```

### Claude Desktop

```ts
import { Polyvia } from "polyvia";

// Print a snippet to copy-paste into ~/.claude/claude_desktop_config.json
new Polyvia({ apiKey: "poly_<key>" }).mcp.printClaudeDesktopSnippet();
```

---

## Agent Tools (programmatic)

Use `client.tools` to get JSON-schema tool definitions and an executor that calls
the REST API directly — for frameworks that don't support remote MCP.

### OpenAI ChatCompletion

```ts
import OpenAI from "openai";
import { Polyvia } from "polyvia";

const client = new Polyvia({ apiKey: "poly_<key>" });
const oai = new OpenAI();
const [tools, callTool] = client.tools.openai();

const response = await oai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "What are my Q4 findings?" }],
  tools,
});

for (const tc of response.choices[0]?.message.tool_calls ?? []) {
  const result = await callTool(tc.function.name, JSON.parse(tc.function.arguments));
  console.log(result);
}
```

### Anthropic Messages API

```ts
import Anthropic from "@anthropic-ai/sdk";
import { Polyvia } from "polyvia";

const client = new Polyvia({ apiKey: "poly_<key>" });
const ant = new Anthropic();
const [tools, callTool] = client.tools.anthropic();

const response = await ant.messages.create({
  model: "claude-opus-4-5",
  max_tokens: 2048,
  messages: [{ role: "user", content: "Summarise my Finance documents." }],
  tools,
});

for (const block of response.content) {
  if (block.type === "tool_use") {
    const result = await callTool(block.name, block.input as Record<string, unknown>);
    console.log(result);
  }
}
```

---

## Error Handling

```ts
import {
  AuthenticationError,  // 401 — bad or missing API key
  ForbiddenError,        // 403 — document belongs to another user
  NotFoundError,         // 404 — document, group, or task not found
  RateLimitError,        // 429 — too many requests
  IngestionError,        // task finished with status "failed"
  IngestionTimeout,      // ingest.wait() exceeded its timeout
} from "polyvia";

try {
  await client.ingest.wait(taskId, { timeout: 60 });
} catch (e) {
  if (e instanceof IngestionError) console.error("Parsing failed:", e.error);
  else if (e instanceof IngestionTimeout) console.error("Timed out");
  else if (e instanceof RateLimitError) console.error("Rate limited");
  else if (e instanceof NotFoundError) console.error("Not found");
  else if (e instanceof AuthenticationError) console.error("Invalid API key");
  else throw e;
}
```

---

## Development

```bash
git clone https://github.com/polyvia-ai/polyvia-sdk-typescript
cd polyvia-sdk-typescript
npm install
npm run build
npm test
```

---

## License

MIT
