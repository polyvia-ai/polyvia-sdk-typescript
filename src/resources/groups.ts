import type { Transport } from "../transport.js";
import type { Group } from "../types.js";

export class GroupsResource {
  constructor(private readonly transport: Transport) {}

  async list(): Promise<Group[]> {
    const result = await this.transport.get<{ groups: Group[] }>("/api/v1/groups");
    return result.groups;
  }

  async create(name: string): Promise<{ group_id: string }> {
    return this.transport.post<{ group_id: string }>("/api/v1/groups", { name });
  }

  async deleteDocuments(groupId: string): Promise<void> {
    await this.transport.delete(`/api/v1/groups/${groupId}/documents`);
  }

  /** Delete a group. Pass `deleteDocuments: true` to wipe its documents first. */
  async delete(groupId: string, options: { deleteDocuments?: boolean } = {}): Promise<void> {
    if (options.deleteDocuments) {
      await this.deleteDocuments(groupId);
    }
    await this.transport.delete(`/api/v1/groups/${groupId}`);
  }
}
