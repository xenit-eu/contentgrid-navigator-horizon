export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const match = /^([^#=\s][^=]*)=(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].trim();
    const raw = match[2].trim();
    result[key] = raw.replace(/^(['"])(.*)\1$/, "$2");
  }
  return result;
}
