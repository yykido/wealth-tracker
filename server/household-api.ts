import { type Data } from "../src/domain/model";
import { validateData } from "../src/domain/backup";
import { isAllowed, type Identity } from "./access";
import type { HouseholdStore } from "./household-store";
export type Dependencies = {
  identity: () => Promise<Identity | null>;
  allowlist: () => string | undefined;
  store: () => HouseholdStore;
};
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is required.");
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 10 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Request exceeds the 10 MB limit.");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON request.");
  }
}
export function createHouseholdApi(dependencies: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const user = await dependencies.identity();
    if (!user)
      return reply(
        { error: "Sign in with ChatGPT to access this household." },
        401,
      );
    if (!isAllowed(user, dependencies.allowlist()))
      return reply(
        { error: "This account is not invited to this household." },
        403,
      );
    if (!["GET", "PUT"].includes(request.method))
      return reply({ error: "Method not allowed." }, 405);
    if (request.method === "PUT") {
      if (
        request.headers.get("origin") !== new URL(request.url).origin ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        return reply({ error: "Cross-site writes are not allowed." }, 403);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "Use application/json." }, 415);
      const match = request.headers.get("if-match")?.match(/^"(0|[1-9]\d*)"$/);
      if (!match || !Number.isSafeInteger(Number(match[1])))
        return reply(
          { error: "Refresh the shared records before saving." },
          428,
        );
      let data: Data;
      try {
        const body = await readBody(request);
        data = validateData((body as { data?: unknown })?.data);
      } catch (error) {
        return reply(
          {
            error: error instanceof Error ? error.message : "Invalid records.",
          },
          400,
        );
      }
      try {
        const saved = await dependencies
          .store()
          .write(data, Number(match[1]), user.userId);
        return saved
          ? reply({ revision: Number(match[1]) + 1 })
          : reply(
              {
                error:
                  "Another member changed the shared records. Cancel your edit, refresh, and try again.",
              },
              409,
            );
      } catch {
        return reply(
          {
            error:
              "Shared records could not be saved. Your previous records are unchanged; please try again.",
          },
          503,
        );
      }
    }
    try {
      return reply({
        ...(await dependencies.store().read()),
        viewer: { displayName: user.displayName, email: user.email },
      });
    } catch {
      return reply(
        {
          error:
            "Shared records are temporarily unavailable. Please try again.",
        },
        503,
      );
    }
  };
}
