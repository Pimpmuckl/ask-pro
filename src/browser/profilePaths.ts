import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

const ASK_PRO_STATE_DIR = path.join(os.homedir(), ".agents", "skills", "ask-pro");
const RESOLVED_AGENT_ID_PATTERN = /^[a-z0-9._-]+-[a-f0-9]{10}$/;

export function defaultAskProBrowserProfileDir(env: NodeJS.ProcessEnv = process.env): string {
  const agentId = resolveAskProAgentId(env);
  return askProBrowserProfileDirForAgentId(agentId);
}

export function askProBrowserProfileDirForAgentId(agentId: string | null | undefined): string {
  if (!agentId) return path.join(ASK_PRO_STATE_DIR, "browser-profile");
  if (!RESOLVED_AGENT_ID_PATTERN.test(agentId)) {
    throw new Error("Stored ask-pro agent id is invalid.");
  }
  return path.join(ASK_PRO_STATE_DIR, "agents", agentId, "browser-profile");
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
