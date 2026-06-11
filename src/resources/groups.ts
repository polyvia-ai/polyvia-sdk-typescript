import type { Transport } from "../transport.js";
import type { Group } from "../types.js";

/** A group by human **name**, or a {@link Group} object. Most callers should
 *  just pass the name — the SDK resolves it to the backend group id for you,
 *  so you never have to track the opaque id yourself. */
export type GroupRef = string | Group;

/** Resolve a `group` (name or {@link Group}) / explicit `groupId` to a group id.
 *
 *  `groupId` wins if given. A `group` name is looked up by exact match; with
 *  `create: true` (ingest) it's created when missing, otherwise (query) a
 *  missing name throws a clear error. */
export async function resolveGroupId(
  transport: Transport,
  group: GroupRef | undefined,
  groupId: string | undefined,
  opts: { create: boolean },
): Promise<string | undefined> {
  if (groupId !== undefined) return groupId;
  if (group === undefined) return undefined;
  if (typeof group !== "string") return group.id;
  const { groups } = await transport.get<{ groups: Group[] }>("/api/v1/groups");
  const match = groups.find((g) => g.name === group);
  if (match) return match.id;
  if (opts.create) {
    const { group_id } = await transport.post<{ group_id: string }>("/api/v1/groups", {
      name: group,
    });
    return group_id;
  }
  throw new Error(
    `No group named "${group}". Pass groupId, or create it first with ` +
      `client.groups.getOrCreate("${group}").`,
  );
}

export class GroupsResource {
  constructor(private readonly transport: Transport) {}

  async list(): Promise<Group[]> {
    const result = await this.transport.get<{ groups: Group[] }>("/api/v1/groups");
    return result.groups;
  }

  /** Create a new group. Always creates a fresh group, even if one with the
   *  same name already exists — prefer {@link getOrCreate} unless you
   *  specifically want a new group every time. */
  async create(name: string): Promise<{ group_id: string }> {
    return this.transport.post<{ group_id: string }>("/api/v1/groups", { name });
  }

  /** Find a group by its exact `name`, or `undefined` if there isn't one. */
  async find(name: string): Promise<Group | undefined> {
    const groups = await this.list();
    return groups.find((g) => g.name === name);
  }

  /** Return the group named `name`, creating it if it doesn't exist.
   *
   *  Idempotent and matched by exact name, so it never makes duplicate groups —
   *  the easy way to turn a human name into a usable group without ever handling
   *  the backend group id yourself:
   *
   *  ```ts
   *  const group = await client.groups.getOrCreate("Q4 Earnings");
   *  await client.ingest.file("10k.pdf", { group });   // or { group: "Q4 Earnings" }
   *  ```
   */
  async getOrCreate(name: string): Promise<Group> {
    const existing = await this.find(name);
    if (existing) return existing;
    const { group_id } = await this.create(name);
    return { id: group_id, name };
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
