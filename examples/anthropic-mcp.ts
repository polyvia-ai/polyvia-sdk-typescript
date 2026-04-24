/**
 * Polyvia JS SDK — Anthropic beta MCP client
 *
 * Anthropic connects directly to the Polyvia MCP server via the
 * beta MCP client feature — no manual tool-dispatch loop needed.
 *
 * Requirements:
 *   npm install @anthropic-ai/sdk
 *
 * Run:
 *   POLYVIA_API_KEY=poly_... ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/anthropic-mcp.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { Polyvia } from "../src/index.js";

const polyvia = new Polyvia();
const ant = new Anthropic();

const response = await ant.beta.messages.create({
  model: "claude-opus-4-5",
  max_tokens: 1000,
  messages: [{ role: "user", content: "What documents do I have, and what are the key themes?" }],
  // @ts-expect-error — mcp_servers is in the beta API
  mcp_servers: [polyvia.mcp.toAnthropicMcpServer()],
  betas: ["mcp-client-2025-04-04"],
});

console.log(response.content[0]);
