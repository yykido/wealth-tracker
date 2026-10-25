import { test as base, expect } from "@playwright/test";
import { emptyData } from "../src/domain/model.ts";
export { expect };
export const test = base.extend({
  resetLocalHousehold: [
    async ({ context }, use) => {
      // Reset ONLY the fictional loopback preview household before every test, across all files.
      const origin = "http://127.0.0.1:5173";
      await context.request.get(`${origin}/signin-with-chatgpt?return_to=%2F`);
      const response = await context.request.get(`${origin}/api/household`);
      if (!response.ok())
        throw new Error(
          `Local household unavailable: ${response.status()} ${await response.text()}`,
        );
      const state = await response.json();
      if (state.viewer?.email !== "seedy@sites.test")
        throw new Error("Refusing to reset a non-test household.");
      const reset = await context.request.put(`${origin}/api/household`, {
        headers: { Origin: origin, "If-Match": `"${state.revision}"` },
        data: { data: emptyData() },
      });
      if (!reset.ok()) throw new Error("Local test reset failed.");
      await use();
    },
    { auto: true },
  ],
});
