import Dexie, { type Table } from "dexie";
import { type Data, type Settings } from "../domain/model";
import { validateData } from "../domain/backup";
export class TrackerDB extends Dexie {
  accounts!: Table<Data["accounts"][number]>;
  categories!: Table<Data["categories"][number]>;
  monthlyExpenses!: Table<Data["monthlyExpenses"][number]>;
  assetSnapshots!: Table<Data["assetSnapshots"][number]>;
  cashFlows!: Table<Data["cashFlows"][number]>;
  scenarios!: Table<Data["scenarios"][number]>;
  settings!: Table<{ id: string; value: Settings }>;
  constructor(name = "wealth-tracker") {
    super(name);
    this.version(1).stores({
      accounts: "id",
      categories: "id",
      monthlyExpenses: "id, &[month+categoryId]",
      assetSnapshots: "id, &[accountId+date]",
      cashFlows: "id, pairId",
      scenarios: "id",
      settings: "id",
    });
  }
  async read(): Promise<Data> {
    return this.transaction("r", this.tables, async () => ({
      accounts: await this.accounts.toArray(),
      categories: await this.categories.toArray(),
      monthlyExpenses: await this.monthlyExpenses.toArray(),
      assetSnapshots: await this.assetSnapshots.toArray(),
      cashFlows: await this.cashFlows.toArray(),
      scenarios: await this.scenarios.toArray(),
      settings: (await this.settings.get("preferences"))?.value ?? {},
    }));
  }
  async replace(input: Data, expected?: Data) {
    const data = validateData(input);
    await this.transaction("rw", this.tables, async () => {
      if (
        expected &&
        JSON.stringify(await this.read()) !== JSON.stringify(expected)
      )
        throw new Error(
          "Records changed in another tab. Reload this page before editing again.",
        );
      await Promise.all(this.tables.map((t) => t.clear()));
      await this.accounts.bulkPut(data.accounts);
      await this.categories.bulkPut(data.categories);
      await this.monthlyExpenses.bulkPut(data.monthlyExpenses);
      await this.assetSnapshots.bulkPut(data.assetSnapshots);
      await this.cashFlows.bulkPut(data.cashFlows);
      await this.scenarios.bulkPut(data.scenarios);
      await this.settings.put({ id: "preferences", value: data.settings });
    });
  }
}
export const db = new TrackerDB();
