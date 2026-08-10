import { randomUUID } from "node:crypto";
import { mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isProcessAlive } from "../browser/profileState.js";

const LEASE_FILENAME = ".controller.lease";
const OWNER_PATTERN = /^(\d+)-(.+)\.owner$/;
const REMOVE_OPTIONS = { recursive: true, force: true, maxRetries: 5, retryDelay: 20 } as const;

export async function withSessionControllerLease<T>(
  sessionDir: string,
  action: () => Promise<T>,
): Promise<T> {
  const id = randomUUID();
  const leasePath = path.join(sessionDir, LEASE_FILENAME);
  const candidatePath = `${leasePath}.${id}.candidate`;
  const ownerName = `${process.pid}-${id}.owner`;
  await mkdir(candidatePath);

  let acquired = false;
  try {
    await writeFile(path.join(candidatePath, ownerName), "");
    for (;;) {
      try {
        await rename(candidatePath, leasePath);
        acquired = true;
        break;
      } catch (error) {
        if (!(await stat(leasePath).catch(() => null))) throw error;
      }

      const existingOwner = (await readdir(leasePath)).find((entry) => OWNER_PATTERN.test(entry));
      const existingPid = Number(existingOwner?.match(OWNER_PATTERN)?.[1]);
      if (!existingOwner || !Number.isInteger(existingPid) || existingPid <= 0) {
        throw new Error("ask-pro session controller lease is unreadable");
      }
      if (isProcessAlive(existingPid)) {
        throw new Error(`ask-pro session controller is already running (pid ${existingPid})`);
      }

      try {
        await rename(path.join(leasePath, existingOwner), path.join(leasePath, ownerName));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      const stalePath = `${leasePath}.${id}.stale`;
      await rename(leasePath, stalePath);
      await rm(stalePath, REMOVE_OPTIONS);
    }

    try {
      return await action();
    } finally {
      const ownsLease = (await readdir(leasePath).catch((): string[] => [])).includes(ownerName);
      if (ownsLease) {
        const retiredPath = `${leasePath}.${id}.retired`;
        const retired = await rename(leasePath, retiredPath).then(
          () => true,
          () => false,
        );
        if (retired) await rm(retiredPath, REMOVE_OPTIONS).catch(() => undefined);
      }
    }
  } finally {
    if (!acquired) await rm(candidatePath, REMOVE_OPTIONS).catch(() => undefined);
  }
}
