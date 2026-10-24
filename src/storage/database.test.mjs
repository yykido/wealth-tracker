import "fake-indexeddb/auto";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TrackerDB } from "./database.ts";
import { demoData } from "../demo/data.ts";
import { emptyData } from "../domain/model.ts";
import { makeBackup, parseBackup } from "../domain/backup.ts";
function expect(value) {
  return {
    toEqual: (expected) => assert.deepEqual(value, expected),
    rejects: {
      toThrow: (message) =>
        assert.rejects(value, message ? new RegExp(message) : undefined),
    },
  };
}
const opened = [];
const open = () => {
  const db = new TrackerDB(`test-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
};
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.delete()));
});
describe("persistent storage and restore", () => {
  it("persists across reopening and restores a backup into a fresh database", async () => {
    const first = open();
    await first.replace(demoData());
    const original = await first.read();
    first.close();
    await first.open();
    expect(await first.read()).toEqual(original);
    const fresh = open();
    await fresh.replace(parseBackup(JSON.stringify(makeBackup(original))).data);
    expect(await fresh.read()).toEqual(original);
  });
  it("preserves existing records if validation fails", async () => {
    const db = open();
    await db.replace(demoData());
    const original = await db.read();
    const invalid = structuredClone(original);
    invalid.assetSnapshots[0].accountId = "missing";
    await expect(db.replace(invalid)).rejects.toThrow();
    expect(await db.read()).toEqual(original);
  });
  it("rolls back a failed write after clearing has started", async () => {
    const db = open();
    await db.replace(demoData());
    const original = await db.read();
    db.categories.hook("creating", () => {
      throw new Error("Injected write failure");
    });
    await expect(db.replace(demoData())).rejects.toThrow(
      "Injected write failure",
    );
    expect(await db.read()).toEqual(original);
  });
  it("rejects stale writes from another tab and supports clearing all records", async () => {
    const db = open();
    const initial = await db.read();
    await db.replace(demoData(), initial);
    await expect(db.replace(emptyData(), initial)).rejects.toThrow(
      "another tab",
    );
    const current = await db.read();
    await db.replace(emptyData(), current);
    expect(await db.read()).toEqual(emptyData());
  });
});
