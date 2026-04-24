import type { Transport } from "../transport.js";
import type { Document } from "../types.js";

export interface ListDocumentsOptions {
  status?: string;
  groupId?: string;
  groupIds?: string[];
}

export class DocumentsResource {
  constructor(private readonly transport: Transport) {}

  async list(options: ListDocumentsOptions = {}): Promise<Document[]> {
    const params: Record<string, string | undefined> = {
      status: options.status,
      group_id: options.groupId,
      group_ids: options.groupIds?.join(","),
    };
    const result = await this.transport.get<{ documents: Document[] }>(
      "/api/v1/documents",
      params,
    );
    return result.documents;
  }

  async get(documentId: string): Promise<Document> {
    return this.transport.get<Document>(`/api/v1/documents/${documentId}`);
  }

  async update(documentId: string, options: { groupId: string | null }): Promise<void> {
    await this.transport.patch(`/api/v1/documents/${documentId}`, {
      group_id: options.groupId,
    });
  }

  async delete(documentId: string): Promise<void> {
    await this.transport.delete(`/api/v1/documents/${documentId}`);
  }
}
