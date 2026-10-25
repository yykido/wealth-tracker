import { env } from "cloudflare:workers";
import { requireChatGPTUser, chatGPTSignOutPath } from "./chatgpt-auth";
import { isAllowed } from "../server/access";
import App from "../src/App";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await requireChatGPTUser("/");
  if (!isAllowed(user, env.WEALTH_ALLOWED_EMAILS))
    return (
      <main className="access-page">
        <h1>Access is limited to invited accounts.</h1>
        <p>
          This ChatGPT account cannot view or change the household’s records.
          Ask the owner to add your account, or sign in with an invited account.
        </p>
        <a className="btn" href={chatGPTSignOutPath("/")} target="_top">
          Sign out
        </a>
      </main>
    );
  return <App />;
}
