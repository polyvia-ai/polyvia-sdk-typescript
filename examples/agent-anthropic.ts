/**
 * Polyvia JS SDK — Anthropic agent with programmatic tool dispatch
 *
 * Uses the Anthropic Messages API with Polyvia tools so Claude can
 * ingest documents, search the workspace, and answer questions.
 *
 * Requirements:
 *   npm install @anthropic-ai/sdk
 *
 * Run:
 *   POLYVIA_API_KEY=poly_... ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/agent-anthropic.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { Polyvia } from "../src/index.js";

const polyvia = new Polyvia();
const ant = new Anthropic();

const [tools, callTool] = polyvia.tools.anthropic();

async function runAgent(userMessage: string, maxSteps = 10): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];

  for (let step = 0; step < maxSteps; step++) {
    const response = await ant.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      system:
        "You are a helpful research assistant with access to the user's Polyvia document workspace. " +
        "Use the available tools to find documents and answer questions from their content.",
      tools,
      messages,
    });

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    const textBlocks = response.content.filter((b) => b.type === "text");

    if (toolUses.length === 0) {
      return textBlocks.map((b) => (b.type === "text" ? b.text : "")).join(" ");
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (tu) => {
        if (tu.type !== "tool_use") return null!;
        console.log(`  → ${tu.name}(${JSON.stringify(tu.input)})`);
        const result = await callTool(tu.name, tu.input as Record<string, unknown>);
        return {
          type: "tool_result" as const,
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        };
      }),
    );

    messages.push({ role: "user", content: toolResults });
  }

  return "Max steps reached.";
}

const question = process.argv[2] ?? "What documents do I have?";
console.log(`Question: ${question}\n`);
const answer = await runAgent(question);
console.log(`\nAnswer:\n${answer}`);
