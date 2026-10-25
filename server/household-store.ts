import { type Data, emptyData } from "../src/domain/model";
import { validateData } from "../src/domain/backup";
export type SharedState = {
  data: Data;
  revision: number;
  updatedAt: string | null;
};
export interface HouseholdStore {
  read(): Promise<SharedState>;
  write(data: Data, revision: number, actor: string): Promise<boolean>;
}
const KEY = "household";
export class D1HouseholdStore implements HouseholdStore {
  constructor(private database: D1Database) {}
  async read(): Promise<SharedState> {
    const results = await this.database.batch([
      this.database
        .prepare(
          "SELECT revision, updated_at FROM household_state WHERE id = ?",
        )
        .bind(KEY),
      this.database
        .prepare(
          "SELECT payload FROM household_chunks WHERE household_id = ? ORDER BY position",
        )
        .bind(KEY),
    ]);
    const metadata = results[0].results?.[0] as
      { revision: number; updated_at: string | null } | undefined;
    if (!metadata || metadata.revision === 0)
      return { data: emptyData(), revision: 0, updatedAt: null };
    const raw = (results[1].results as { payload: string }[])
      .map((row) => row.payload)
      .join("");
    if (!raw) throw new Error("Shared records are temporarily unavailable.");
    return {
      data: validateData(JSON.parse(raw)),
      revision: metadata.revision,
      updatedAt: metadata.updated_at,
    };
  }
  async write(data: Data, revision: number, actor: string): Promise<boolean> {
    const json = JSON.stringify(validateData(data));
    if (new TextEncoder().encode(json).length > 10 * 1024 * 1024)
      throw new Error(
        "Shared records exceed the 10 MB limit. Export a backup before reducing the dataset.",
      );
    const token = crypto.randomUUID(),
      time = new Date().toISOString();
    const statements = [
      this.database
        .prepare("INSERT OR IGNORE INTO household_state (id) VALUES (?)")
        .bind(KEY),
      this.database
        .prepare(
          "UPDATE household_state SET revision = revision + 1, write_token = ?, updated_at = ?, updated_by = ? WHERE id = ? AND revision = ?",
        )
        .bind(token, time, actor, KEY, revision),
      this.database
        .prepare(
          "DELETE FROM household_chunks WHERE household_id = ? AND EXISTS (SELECT 1 FROM household_state WHERE id = ? AND write_token = ?)",
        )
        .bind(KEY, KEY, token),
    ];
    // Each chunk stays below D1's row limit, even for multibyte text. At most 42 chunks per bounded request.
    for (let start = 0, position = 0; start < json.length; position++) {
      let end = Math.min(start + 256000, json.length);
      const last = json.charCodeAt(end - 1);
      if (end < json.length && last >= 0xd800 && last <= 0xdbff) end--;
      statements.push(
        this.database
          .prepare(
            "INSERT INTO household_chunks (household_id, position, payload) SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM household_state WHERE id = ? AND write_token = ?)",
          )
          .bind(KEY, position, json.slice(start, end), KEY, token),
      );
      start = end;
    }
    const result = await this.database.batch(statements);
    return result[1].meta.changes === 1;
  }
}
