import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { createHouseholdApi } from "../../../server/household-api";
import { D1HouseholdStore } from "../../../server/household-store";
export const dynamic = "force-dynamic";
const handler = createHouseholdApi({
  identity: getChatGPTUser,
  allowlist: () => env.WEALTH_ALLOWED_EMAILS,
  store: () => {
    if (!env.DB) throw new Error("Shared database unavailable.");
    return new D1HouseholdStore(env.DB);
  },
});
export const GET = handler;
export const PUT = handler;
