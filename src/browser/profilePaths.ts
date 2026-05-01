import os from "node:os";
import path from "node:path";

export function defaultAskProBrowserProfileDir(): string {
  return path.join(os.homedir(), ".agents", "skills", "ask-pro", "browser-profile");
}
