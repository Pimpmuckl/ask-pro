import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

const ASK_PRO_STATE_DIR = path.join(os.homedir(), ".agents", "skills", "ask-pro");

export function defaultAskProBrowserProfileDir(env: NodeJS.ProcessEnv = process.env): string {
  const agentId = resolveAskProAgentId(env);
  return askProBrowserProfileDirForAgentId(agentId);
}

export function askProBrowserProfileDirForAgentId(agentId: string | null | undefined): string {
  return agentId
    ? path.join(ASK_PRO_STATE_DIR, "agents", agentId, "browser-profile")
    : path.join(ASK_PRO_STATE_DIR, "browser-profile");
}

export function resolveAskProAgentId(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.ASK_PRO_AGENT_ID;
  if (value === undefined) return null;
  const raw = value.trim();
  if (raw !== value) {
    throw new Error("ASK_PRO_AGENT_ID must not start or end with whitespace.");
  }
  if (!raw) {
    throw new Error("ASK_PRO_AGENT_ID must not be empty.");
  }
  if (!/^[a-z0-9._-]+$/.test(raw)) {
    throw new Error("ASK_PRO_AGENT_ID must use only lowercase letters, numbers, '.', '_', or '-'.");
  }
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 10);
  const prefix = raw.slice(0, 53).replace(/^[-_.]+|[-_.]+$/g, "") || "agent";
  return `${prefix}-${hash}`;
}
