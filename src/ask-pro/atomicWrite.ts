import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function atomicWriteFile(filePath: string, data: string | Uint8Array): Promise<void> {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await fs.writeFile(temporaryPath, data);
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}
