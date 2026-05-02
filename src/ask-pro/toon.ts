type ToonValue = string | number | boolean | null | undefined;

export type AskProToonFields = Record<string, ToonValue>;

export function renderToonRecord(name: string, fields: AskProToonFields): string {
  const lines = [name];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    lines.push(`  ${formatKey(key)}: ${formatValue(value)}`);
  }
  return lines.join("\n");
}

function formatKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

function formatValue(value: Exclude<ToonValue, undefined>): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (isBareString(value)) return value;
  return JSON.stringify(value);
}

function isBareString(value: string): boolean {
  return /^[A-Za-z0-9_./@-]+$/.test(value);
}
