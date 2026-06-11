import { describe, expect, it } from "vitest";
import { resolveGroupId } from "../src/resources/groups.js";
import type { Transport } from "../src/transport.js";

/** Minimal duck-typed transport that serves canned groups and records POSTs. */
function fakeTransport(groups: Array<{ id: string; name: string }>) {
  const posted: Array<{ name: string }> = [];
  const t = {
    async get(path: string) {
      expect(path).toBe("/api/v1/groups");
      return { groups };
    },
    async post(path: string, body: { name: string }) {
      expect(path).toBe("/api/v1/groups");
      posted.push(body);
      const gid = `g_new_${posted.length}`;
      groups.push({ id: gid, name: body.name });
      return { group_id: gid };
    },
    async delete() {},
  } as unknown as Transport;
  return { t, posted };
}

describe("resolveGroupId", () => {
  it("explicit groupId wins without a lookup", async () => {
    const { t, posted } = fakeTransport([{ id: "g_1", name: "Earnings" }]);
    expect(await resolveGroupId(t, "Earnings", "g_explicit", { create: true })).toBe("g_explicit");
    expect(posted).toEqual([]);
  });

  it("a Group object uses its id", async () => {
    const { t, posted } = fakeTransport([]);
    expect(await resolveGroupId(t, { id: "g_42", name: "Earnings" }, undefined, { create: true })).toBe(
      "g_42",
    );
    expect(posted).toEqual([]);
  });

  it("matches an existing name without creating a duplicate", async () => {
    const { t, posted } = fakeTransport([{ id: "g_1", name: "Q4 Earnings" }]);
    expect(await resolveGroupId(t, "Q4 Earnings", undefined, { create: true })).toBe("g_1");
    expect(posted).toEqual([]);
  });

  it("creates a missing name when create=true", async () => {
    const { t, posted } = fakeTransport([{ id: "g_1", name: "Other" }]);
    expect(await resolveGroupId(t, "New Group", undefined, { create: true })).toBe("g_new_1");
    expect(posted).toEqual([{ name: "New Group" }]);
  });

  it("throws on a missing name when create=false (query path)", async () => {
    const { t } = fakeTransport([]);
    await expect(resolveGroupId(t, "Missing", undefined, { create: false })).rejects.toThrow(
      /No group named "Missing"/,
    );
  });

  it("returns undefined when no group is given", async () => {
    const { t } = fakeTransport([]);
    expect(await resolveGroupId(t, undefined, undefined, { create: true })).toBeUndefined();
  });
});
