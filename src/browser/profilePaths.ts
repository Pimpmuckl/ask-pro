import os from "node:os";
import path from "node:path";

const ASK_PRO_STATE_DIR = path.join(os.homedir(), ".agents", "skills", "ask-pro");

export function defaultAskProBrowserProfileDir(env: NodeJS.ProcessEnv = process.env): string {
  const agentId = resolveAskProAgentId(env);
  return agentId
    ? path.join(ASK_PRO_STATE_DIR, "agents", agentId, "browser-profile")
    : path.join(ASK_PRO_STATE_DIR, "browser-profile");
}

export function resolveAskProAgentId(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env.ASK_PRO_AGENT_ID?.trim();
  if (!raw) return null;
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[-_.]{2,}/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return slug ? slug.slice(0, 64) : "agent";
}
