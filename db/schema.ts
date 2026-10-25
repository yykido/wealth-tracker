import {
  integer,
  sqliteTable,
  text,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const householdState = sqliteTable("household_state", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  writeToken: text("write_token").notNull().default(""),
  updatedAt: text("updated_at"),
  updatedBy: text("updated_by"),
});
export const householdChunks = sqliteTable(
  "household_chunks",
  {
    householdId: text("household_id").notNull(),
    position: integer("position").notNull(),
    payload: text("payload").notNull(),
  },
  (table) => [primaryKey({ columns: [table.householdId, table.position] })],
);
