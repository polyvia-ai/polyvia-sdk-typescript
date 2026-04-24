/**
 * Polyvia JS SDK — OpenAI Responses API + remote MCP
 *
 * OpenAI connects directly to the Polyvia MCP server and calls tools
 * automatically — no manual tool-dispatch loop needed.
 *
 * Requirements:
 *   npm install openai
 *
 * Run:
 *   POLYVIA_API_KEY=poly_... OPENAI_API_KEY=sk-... npx tsx examples/openai-responses-mcp.ts
 */

import OpenAI from "openai";
import { Polyvia } from "../src/index.js";

const polyvia = new Polyvia();
const oai = new OpenAI();

const response = await oai.responses.create({
  model: "gpt-4o",
  // @ts-expect-error — MCP tool type is in preview
  tools: [polyvia.mcp.toOpenAIResponsesTool()],
  input: "What documents do I have, and what are the key themes?",
});

console.log(response.output_text);
