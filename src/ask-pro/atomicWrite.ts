import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const RETRYABLE_RENAME_ERRORS = new Set(["EBUSY", "EPERM"]);

export async function atomicWriteFile(filePath: string, data: string | Uint8Array): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temporaryPath, data);
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fs.rename(temporaryPath, filePath);
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code ?? "";
        if (attempt === 2 || !RETRYABLE_RENAME_ERRORS.has(code)) throw error;
        await delay(50);
      }
    }
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}
