import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  createManagedChromeRunLease,
  releaseManagedChromeRunLeaseAndCountPeers,
} from "../../src/browser/profileState.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("managed Chrome run leases", () => {
  test("transfers cleanup to the last live run and prunes dead peers", async () => {
    const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "ask-pro-run-leases-"));
    tempDirs.push(profileDir);

    const first = await createManagedChromeRunLease(profileDir);
    const second = await createManagedChromeRunLease(profileDir);
    await expect(releaseManagedChromeRunLeaseAndCountPeers(profileDir, first)).resolves.toBe(1);
    await expect(releaseManagedChromeRunLeaseAndCountPeers(profileDir, second)).resolves.toBe(0);

    const deadLeasePath = path.join(path.dirname(first.path), "2147483647-dead-controller.lease");
    await fs.writeFile(deadLeasePath, "");
    const live = await createManagedChromeRunLease(profileDir);
    await expect(releaseManagedChromeRunLeaseAndCountPeers(profileDir, live)).resolves.toBe(0);
    await expect(fs.stat(deadLeasePath)).rejects.toThrow();
  });
});
