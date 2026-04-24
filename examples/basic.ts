/**
 * Polyvia JS SDK — Basic Example
 *
 * Ingest a document, wait for indexing, then query it.
 *
 * Run:
 *   POLYVIA_API_KEY=poly_... npx tsx examples/basic.ts
 */

import { Polyvia } from "../src/index.js";

const client = new Polyvia();

// 1. Ingest
const result = await client.ingest.file("report.pdf", { name: "Q4 Report" });
console.log("Ingesting:", result.task_id);

// 2. Wait until indexed
await client.ingest.wait(result.task_id);
console.log("Indexed:", result.document_id);

// 3. Query
const answer = await client.query("What are the key findings?", {
  documentId: result.document_id,
});
console.log("Answer:", answer.answer);
