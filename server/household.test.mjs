import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { D1HouseholdStore } from "./household-store.ts";
import { createHouseholdApi } from "./household-api.ts";
import { isAllowed } from "./access.ts";
import { emptyData } from "../src/domain/model.ts";
const owner = {
  userId: "owner-id",
  email: "owner@example.test",
  displayName: "Owner",
};
function database() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  const prepare = (sql, args = []) => ({
    bind: (...values) => prepare(sql, values),
    execute: () => {
      const statement = sqlite.prepare(sql);
      if (/^\s*SELECT/i.test(sql))
        return {
          success: true,
          results: statement.all(...args),
          meta: { changes: 0 },
        };
      const result = statement.run(...args);
      return {
        success: true,
        results: [],
        meta: { changes: Number(result.changes) },
      };
    },
  });
  return {
    sqlite,
    adapter: {
      prepare,
      batch: async (statements) => {
        sqlite.exec("BEGIN IMMEDIATE");
        try {
          const results = statements.map((s) => s.execute());
          sqlite.exec("COMMIT");
          return results;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
    },
  };
}
const request = (data, revision = 0, origin = "https://tracker.test") =>
  new Request("https://tracker.test/api/household", {
    method: "PUT",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "If-Match": `"${revision}"`,
    },
    body: JSON.stringify({ data }),
  });
describe("household authorization", () => {
  it("fails closed for missing configuration and uninvited identities", () => {
    assert.equal(isAllowed(owner, undefined), false);
    assert.equal(isAllowed(null, "owner@example.test"), false);
    assert.equal(
      isAllowed(
        { ...owner, email: "stranger@example.test" },
        "owner@example.test",
      ),
      false,
    );
    assert.equal(isAllowed(owner, " OWNER@example.test "), true);
  });
  it("rejects anonymous and uninvited requests before accessing storage", async () => {
    for (const identity of [
      null,
      { ...owner, email: "stranger@example.test" },
    ]) {
      const api = createHouseholdApi({
        identity: async () => identity,
        allowlist: () => owner.email,
        store: () => {
          throw new Error("Storage must not be accessed");
        },
      });
      const response = await api(
        new Request("https://tracker.test/api/household"),
      );
      assert.equal(response.status, identity ? 403 : 401);
      assert.equal("data" in (await response.json()), false);
    }
  });
  it("blocks cross-site writes and writes without a revision", async () => {
    const api = createHouseholdApi({
      identity: async () => owner,
      allowlist: () => owner.email,
      store: () => {
        throw new Error("No storage access");
      },
    });
    assert.equal(
      (await api(request(emptyData(), 0, "https://attacker.test"))).status,
      403,
    );
    const missing = request(emptyData());
    missing.headers.delete("If-Match");
    assert.equal((await api(missing)).status, 428);
  });
});
describe("shared state persistence and concurrency", () => {
  it("makes an invited editor’s changes visible to another invited account", async () => {
    const { sqlite, adapter } = database();
    try {
      const store = new D1HouseholdStore(adapter),
        data = emptyData();
      data.categories = [{ id: "g", name: "Groceries" }];
      data.monthlyExpenses = [
        {
          id: "cost",
          month: "2026-10",
          categoryId: "g",
          amount: 40000,
          note: "",
        },
      ];
      const deps = {
        allowlist: () => `${owner.email},editor@example.test`,
        store: () => store,
      };
      const ownerApi = createHouseholdApi({
        ...deps,
        identity: async () => owner,
      });
      assert.equal((await ownerApi(request(data))).status, 200);
      const editorApi = createHouseholdApi({
        ...deps,
        identity: async () => ({
          ...owner,
          userId: "editor-id",
          email: "editor@example.test",
        }),
      });
      const response = await editorApi(
        new Request("https://tracker.test/api/household"),
      );
      const read = await response.json();
      assert.equal(response.headers.get("cache-control"), "no-store, private");
      assert.equal(read.data.monthlyExpenses[0].amount, 40000);
      read.data.monthlyExpenses[0].amount = 45000;
      assert.equal(
        (await editorApi(request(read.data, read.revision))).status,
        200,
      );
      assert.equal((await store.read()).data.monthlyExpenses[0].amount, 45000);
    } finally {
      sqlite.close();
    }
  });
  it("rejects a stale update atomically and preserves the winning data", async () => {
    const { sqlite, adapter } = database();
    try {
      const store = new D1HouseholdStore(adapter);
      const a = emptyData();
      a.categories = [{ id: "a", name: "A" }];
      const b = emptyData();
      b.categories = [{ id: "b", name: "B" }];
      assert.equal(await store.write(a, 0, "one"), true);
      assert.equal(await store.write(b, 0, "two"), false);
      assert.deepEqual((await store.read()).data, a);
      assert.equal((await store.read()).revision, 1);
    } finally {
      sqlite.close();
    }
  });
  it("round-trips a large Unicode household using bounded chunks", async () => {
    const { sqlite, adapter } = database();
    try {
      const store = new D1HouseholdStore(adapter),
        data = emptyData();
      data.categories = [{ id: "c", name: "Other" }];
      data.payments = Array.from({ length: 3000 }, (_, i) => ({
        id: String(i),
        date: "2026-10-20",
        description: `${i} ${"€😀".repeat(60)}`,
        amount: 100,
        categoryId: "c",
        direction: "debit",
      }));
      assert.equal(await store.write(data, 0, "one"), true);
      assert.deepEqual((await store.read()).data, data);
      assert.ok(
        sqlite.prepare("SELECT count(*) AS n FROM household_chunks").get().n >
          1,
      );
    } finally {
      sqlite.close();
    }
  });
  it("rolls back data and revision when any chunk write fails", async () => {
    const { sqlite, adapter } = database();
    try {
      const store = new D1HouseholdStore(adapter);
      await store.write(emptyData(), 0, "one");
      sqlite.exec(
        "CREATE TRIGGER reject_chunks BEFORE INSERT ON household_chunks BEGIN SELECT RAISE(ABORT, 'test failure'); END",
      );
      const data = emptyData();
      data.categories = [{ id: "bad", name: "Should not save" }];
      await assert.rejects(store.write(data, 1, "two"));
      assert.equal((await store.read()).revision, 1);
      assert.deepEqual((await store.read()).data, emptyData());
    } finally {
      sqlite.close();
    }
  });
  it("rejects invalid payloads without changing stored records", async () => {
    const { sqlite, adapter } = database();
    try {
      const store = new D1HouseholdStore(adapter),
        api = createHouseholdApi({
          identity: async () => owner,
          allowlist: () => owner.email,
          store: () => store,
        });
      assert.equal((await api(request({}))).status, 400);
      assert.deepEqual((await store.read()).data, emptyData());
    } finally {
      sqlite.close();
    }
  });
});
