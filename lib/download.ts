const MAX_URLS = 200;
const MAX_CONCURRENT = 8;
const FETCH_TIMEOUT_MS = 15_000;

export type ParsedUrls = {
  urls: string[];
  skipped: number;
};

export type DownloadResult = {
  filename: string;
  data: ArrayBuffer;
};

export type DownloadSummary = {
  downloaded: DownloadResult[];
  failed: { url: string; reason: string }[];
};

export function parseUrls(raw: string): ParsedUrls {
  const seen = new Set<string>();
  const urls: string[] = [];
  let skipped = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const url = new URL(trimmed);
      if (!["http:", "https:"].includes(url.protocol)) {
        skipped += 1;
        continue;
      }
      const normalized = url.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      urls.push(normalized);
    } catch {
      skipped += 1;
    }
  }

  return { urls: urls.slice(0, MAX_URLS), skipped };
}

function filenameFromUrl(url: string): string {
  const { pathname } = new URL(url);
  const segment = pathname.split("/").filter(Boolean).pop() ?? "image";
  const decoded = decodeURIComponent(segment.split("?")[0] || "image");
  const sanitized = decoded.replace(/[^\w.\-()]/g, "_") || "image";
  return sanitized.includes(".") ? sanitized : `${sanitized}.bin`;
}

function uniqueFilename(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";

  let i = 2;
  while (used.has(`${stem}-${i}${ext}`)) i += 1;
  const name = `${stem}-${i}${ext}`;
  used.add(name);
  return name;
}

function resolveFetchUrl(url: string, proxyBase?: string): string {
  const trimmed = proxyBase?.trim();
  if (!trimmed) return url;
  const base = trimmed.replace(/\/$/, "");
  return `${base}?url=${encodeURIComponent(url)}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "Timeout";
    if (error.message === "Failed to fetch") {
      return "Blockerad (CORS) — aktivera proxy nedan";
    }
    return error.message;
  }
  return "Okänt fel";
}

async function downloadOne(
  url: string,
  proxyBase?: string,
): Promise<DownloadResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(resolveFetchUrl(url, proxyBase), {
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.arrayBuffer();
    if (data.byteLength === 0) {
      throw new Error("Tomt svar");
    }

    return { filename: filenameFromUrl(url), data };
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadImages(
  urls: string[],
  proxyBase?: string,
): Promise<DownloadSummary> {
  const downloaded: DownloadResult[] = [];
  const failed: { url: string; reason: string }[] = [];
  const usedNames = new Set<string>();

  let index = 0;

  async function worker() {
    while (index < urls.length) {
      const current = urls[index];
      index += 1;

      try {
        const result = await downloadOne(current, proxyBase);
        result.filename = uniqueFilename(result.filename, usedNames);
        downloaded.push(result);
      } catch (error) {
        failed.push({
          url: current,
          reason: errorMessage(error),
        });
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT, urls.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return { downloaded, failed };
}

export { MAX_URLS };
