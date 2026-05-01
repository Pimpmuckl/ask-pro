import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import type { ChromeClient } from "../browser/types.js";

const REQUIRED_RESPONSE_FILES = [
  "IMPLEMENTATION_PLAN.md",
  "TASKS.json",
  "TEST_PLAN.md",
  "RISK_REGISTER.md",
  "FILES_TO_EDIT.md",
  "REPO_CONTEXT_USED.md",
];

export interface AskProResponseZipManifest {
  schemaVersion: 1;
  responseZip: {
    status: "downloaded" | "unavailable" | "invalid" | "error";
    actualFileName: string | null;
    downloadPath: string | null;
    extractPath: string | null;
    requiredFilesPresent: boolean;
    notes: string[];
  };
}

export async function harvestLatestAssistantZip({
  runtime,
  page,
  input,
  sessionDir,
}: {
  runtime: ChromeClient["Runtime"];
  page?: ChromeClient["Page"];
  input?: ChromeClient["Input"];
  sessionDir: string;
}): Promise<AskProResponseZipManifest> {
  const downloadsDir = path.join(sessionDir, "downloads");
  await fs.mkdir(downloadsDir, { recursive: true });
  const artifact = await fetchLatestAssistantZip(runtime);
  if (artifact.status !== "downloaded") {
    const clicked = await harvestAssistantZipDownloadButton({ runtime, page, input, sessionDir });
    return clicked ?? processResponseZip({ sessionDir, notes: artifact.notes });
  }

  const fileName = sanitizeZipFileName(artifact.fileName);
  const downloadPath = path.join(downloadsDir, fileName);
  await fs.writeFile(downloadPath, Buffer.from(artifact.base64, "base64"));
  return processResponseZip({ sessionDir, preferredZipPath: downloadPath, notes: artifact.notes });
}

export async function harvestAssistantZipDownloadButton({
  runtime,
  page,
  input,
  sessionDir,
}: {
  runtime: ChromeClient["Runtime"];
  page?: ChromeClient["Page"];
  input?: ChromeClient["Input"];
  sessionDir: string;
}): Promise<AskProResponseZipManifest | null> {
  if (!page) return null;
  const downloadsDir = path.join(sessionDir, "downloads");
  await fs.mkdir(downloadsDir, { recursive: true });
  const pageWithDownloads = page as ChromeClient["Page"] & {
    setDownloadBehavior?: (options: { behavior: "allow"; downloadPath: string }) => Promise<void>;
  };
  if (typeof pageWithDownloads.setDownloadBehavior !== "function") {
    return null;
  }
  await pageWithDownloads.setDownloadBehavior({ behavior: "allow", downloadPath: downloadsDir });
  const { result } = await runtime.evaluate({
    expression: buildFindAssistantZipButtonExpression(),
    awaitPromise: true,
    returnByValue: true,
  });
  const value = result?.value as
    | {
        found?: boolean;
        x?: number;
        y?: number;
        text?: string;
        notes?: string[];
      }
    | undefined;
  if (!value?.found) {
    return null;
  }
  const notes = value.notes ?? [
    `Clicked response zip download button: ${(value.text ?? "download").slice(0, 120)}`,
  ];
  if (
    input &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y)
  ) {
    await input.dispatchMouseEvent({ type: "mouseMoved", x: value.x, y: value.y });
    await input.dispatchMouseEvent({
      type: "mousePressed",
      x: value.x,
      y: value.y,
      button: "left",
      clickCount: 1,
    });
    await input.dispatchMouseEvent({
      type: "mouseReleased",
      x: value.x,
      y: value.y,
      button: "left",
      clickCount: 1,
    });
  } else {
    await runtime.evaluate({
      expression: buildDispatchAssistantZipButtonClickExpression(),
      awaitPromise: true,
      returnByValue: true,
    });
  }
  const zipPath = await waitForDownloadedZip(downloadsDir, 20_000);
  if (!zipPath) {
    return processResponseZip({
      sessionDir,
      notes,
    });
  }
  return processResponseZip({
    sessionDir,
    preferredZipPath: zipPath,
    notes,
  });
}

export async function processResponseZip({
  sessionDir,
  preferredZipPath,
  notes = [],
}: {
  sessionDir: string;
  preferredZipPath?: string;
  notes?: string[];
}): Promise<AskProResponseZipManifest> {
  const downloadsDir = path.join(sessionDir, "downloads");
  const zipPath = preferredZipPath ?? (await findPreferredZip(downloadsDir));
  if (!zipPath) {
    return {
      schemaVersion: 1,
      responseZip: {
        status: "unavailable",
        actualFileName: null,
        downloadPath: null,
        extractPath: null,
        requiredFilesPresent: false,
        notes: notes.length ? notes : ["No generated response zip was found."],
      },
    };
  }

  const extractPath = path.join(sessionDir, "pro-output");
  try {
    const entries = await readZipEntries(zipPath);
    await fs.rm(extractPath, { recursive: true, force: true });
    await fs.mkdir(extractPath, { recursive: true });
    for (const entry of entries) {
      if (entry.name.endsWith("/")) continue;
      const target = safeExtractPath(extractPath, entry.name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, entry.data);
    }
    const names = new Set(entries.map((entry) => normalizeZipPath(entry.name)));
    const requiredFilesPresent = REQUIRED_RESPONSE_FILES.every((name) => names.has(name));
    return {
      schemaVersion: 1,
      responseZip: {
        status: requiredFilesPresent ? "downloaded" : "invalid",
        actualFileName: path.basename(zipPath),
        downloadPath: zipPath,
        extractPath,
        requiredFilesPresent,
        notes: requiredFilesPresent
          ? notes
          : [...notes, "Response zip is missing one or more required files."],
      },
    };
  } catch (error) {
    return {
      schemaVersion: 1,
      responseZip: {
        status: "error",
        actualFileName: path.basename(zipPath),
        downloadPath: zipPath,
        extractPath,
        requiredFilesPresent: false,
        notes: [...notes, error instanceof Error ? error.message : String(error)],
      },
    };
  }
}

export async function writeResponseZipManifest(
  sessionDir: string,
  manifest: AskProResponseZipManifest,
): Promise<void> {
  await fs.writeFile(
    path.join(sessionDir, "PRO_OUTPUT_MANIFEST.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

async function fetchLatestAssistantZip(
  runtime: ChromeClient["Runtime"],
): Promise<
  | { status: "downloaded"; fileName: string; base64: string; notes: string[] }
  | { status: "unavailable"; notes: string[] }
> {
  const { result } = await runtime.evaluate({
    expression: buildFetchLatestAssistantZipExpression(),
    awaitPromise: true,
    returnByValue: true,
  });
  const value = result?.value as
    | { status?: string; fileName?: string; base64?: string; notes?: string[] }
    | undefined;
  const notes = Array.isArray(value?.notes) ? value.notes : [];
  if (value?.status === "downloaded" && value.fileName && value.base64) {
    return { status: "downloaded", fileName: value.fileName, base64: value.base64, notes };
  }
  return { status: "unavailable", notes: notes.length ? notes : ["No zip link found."] };
}

function buildFetchLatestAssistantZipExpression(): string {
  return `(async () => {
    const notes = [];
    const assistantTurns = Array.from(document.querySelectorAll(
      '[data-message-author-role="assistant"], [data-testid*="conversation-turn"][data-message-author-role="assistant"], article'
    ));
    const scope = assistantTurns.length ? assistantTurns[assistantTurns.length - 1] : document;
    const anchors = Array.from(scope.querySelectorAll('a[href], a[download]'));
    const candidates = anchors.map((anchor) => {
      const href = anchor.href || anchor.getAttribute('href') || '';
      const download = anchor.getAttribute('download') || '';
      const text = anchor.textContent || '';
      const name = download || text || href.split('/').pop() || 'ask-pro-response.zip';
      return { href, name, text: [download, text, href].join(' ') };
    }).filter((candidate) => /\\.zip(?:$|[?#])/i.test(candidate.href) || /\\.zip\\b/i.test(candidate.text));
    candidates.sort((a, b) => {
      const score = (candidate) => /ask-pro|response|implementation|plan/i.test(candidate.text) ? 0 : 1;
      return score(a) - score(b);
    });
    const candidate = candidates[0];
    if (!candidate?.href) {
      return { status: 'unavailable', notes: ['No zip link found in latest assistant response.'] };
    }
    const response = await fetch(candidate.href, { credentials: 'include' });
    if (!response.ok) {
      return { status: 'unavailable', notes: ['Zip link fetch failed with HTTP ' + response.status + '.'] };
    }
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return {
      status: 'downloaded',
      fileName: candidate.name || 'ask-pro-response.zip',
      base64: btoa(binary),
      notes,
    };
  })()`;
}

function buildFindAssistantZipButtonExpression(): string {
  return `(() => {
    const assistantTurns = Array.from(document.querySelectorAll(
      '[data-message-author-role="assistant"], [data-testid*="conversation-turn"][data-message-author-role="assistant"], article'
    ));
    const scope = assistantTurns.length ? assistantTurns[assistantTurns.length - 1] : document;
    const candidates = Array.from(scope.querySelectorAll('button,[role="button"],a,span'))
      .map((node) => {
        const text = (node.innerText || node.textContent || '').trim();
        const clickable = node.closest('button,[role="button"],a') || node;
        return { node, clickable, text };
      })
      .filter((candidate) => /\\.zip\\b/i.test(candidate.text));
    const candidate =
      candidates.find((item) => /download|ask-pro|response/i.test(item.text)) || candidates[0];
    if (!candidate) {
      return { found: false, notes: ['No response zip download button found.'] };
    }
    candidate.clickable.scrollIntoView({ block: 'center' });
    const rect = candidate.clickable.getBoundingClientRect();
    return {
      found: true,
      text: candidate.text,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      notes: ['Clicked response zip download button: ' + candidate.text.slice(0, 120)],
    };
  })()`;
}

function buildDispatchAssistantZipButtonClickExpression(): string {
  return `(() => {
    const assistantTurns = Array.from(document.querySelectorAll(
      '[data-message-author-role="assistant"], [data-testid*="conversation-turn"][data-message-author-role="assistant"], article'
    ));
    const scope = assistantTurns.length ? assistantTurns[assistantTurns.length - 1] : document;
    const candidates = Array.from(scope.querySelectorAll('button,[role="button"],a,span'))
      .map((node) => {
        const text = (node.innerText || node.textContent || '').trim();
        const clickable = node.closest('button,[role="button"],a') || node;
        return { clickable, text };
      })
      .filter((candidate) => /\\.zip\\b/i.test(candidate.text));
    const candidate =
      candidates.find((item) => /download|ask-pro|response/i.test(item.text)) || candidates[0];
    if (!candidate) return false;
    candidate.clickable.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
    );
    return true;
  })()`;
}

async function waitForDownloadedZip(
  downloadsDir: string,
  timeoutMs: number,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const zip = await findPreferredZip(downloadsDir);
    if (zip) return zip;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

async function findPreferredZip(downloadsDir: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await fs.readdir(downloadsDir);
  } catch {
    return null;
  }
  const zips = entries
    .filter((entry) => entry.toLowerCase().endsWith(".zip"))
    .sort((a, b) => {
      const score = (value: string) =>
        /ask-pro|response|implementation|plan/i.test(value) ? 0 : 1;
      return score(a) - score(b) || a.localeCompare(b);
    });
  return zips[0] ? path.join(downloadsDir, zips[0]) : null;
}

async function readZipEntries(zipPath: string): Promise<Array<{ name: string; data: Buffer }>> {
  const buffer = await fs.readFile(zipPath);
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error("Response file is not a zip archive.");
  }
  const centralDirectory = findCentralDirectory(buffer);
  const entries: Array<{ name: string; data: Buffer }> = [];
  let offset = centralDirectory.offset;
  for (let index = 0; index < centralDirectory.totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid zip central directory.");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = normalizeZipPath(
      buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"),
    );
    entries.push({
      name,
      data: inflateZipEntry(buffer, localHeaderOffset, compressedSize, method),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function findCentralDirectory(buffer: Buffer): { offset: number; totalEntries: number } {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return {
        totalEntries: buffer.readUInt16LE(offset + 10),
        offset: buffer.readUInt32LE(offset + 16),
      };
    }
  }
  throw new Error("Zip end-of-central-directory record was not found.");
}

function inflateZipEntry(
  buffer: Buffer,
  localHeaderOffset: number,
  compressedSize: number,
  method: number,
): Buffer {
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error("Invalid zip local header.");
  }
  const nameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
  if (method === 0) return Buffer.from(compressed);
  if (method === 8) return zlib.inflateRawSync(compressed);
  throw new Error(`Unsupported zip compression method ${method}.`);
}

function safeExtractPath(root: string, zipEntryName: string): string {
  const target = path.resolve(root, normalizeZipPath(zipEntryName));
  const rootWithSeparator = path.resolve(root) + path.sep;
  if (target !== path.resolve(root) && !target.startsWith(rootWithSeparator)) {
    throw new Error(`Unsafe zip entry path: ${zipEntryName}`);
  }
  return target;
}

function normalizeZipPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function sanitizeZipFileName(value: string): string {
  const base = path.basename(value).replace(/[^a-zA-Z0-9._-]+/g, "-");
  return base.toLowerCase().endsWith(".zip") ? base : "ask-pro-response.zip";
}
