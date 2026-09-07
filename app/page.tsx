"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadImages, parseUrls } from "@/lib/download";
import { buildZip } from "@/lib/zip";

const PROXY_STORAGE_KEY = "img-scraper-proxy-url";

type Result = {
  downloaded: number;
  failed: number;
  skipped: number;
  failedDetails: { url: string; reason: string }[];
};

function countUrls(raw: string): number {
  return parseUrls(raw).urls.length;
}

export default function HomePage() {
  const [urls, setUrls] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(PROXY_STORAGE_KEY);
    if (saved) setProxyUrl(saved);
  }, []);

  const urlCount = useMemo(() => countUrls(urls), [urls]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    localStorage.setItem(PROXY_STORAGE_KEY, proxyUrl.trim());

    try {
      const { urls: parsed, skipped } = parseUrls(urls);

      if (parsed.length === 0) {
        throw new Error("Inga giltiga http(s)-URL:er hittades");
      }

      const { downloaded, failed } = await downloadImages(
        parsed,
        proxyUrl.trim() || undefined,
      );

      if (downloaded.length === 0) {
        setResult({
          downloaded: 0,
          failed: failed.length,
          skipped,
          failedDetails: failed,
        });
        throw new Error("Kunde inte ladda ner några bilder");
      }

      const zipBytes = await buildZip(downloaded);
      const blob = new Blob([zipBytes], { type: "application/zip" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `images-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);

      setResult({
        downloaded: downloaded.length,
        failed: failed.length,
        skipped,
        failedDetails: failed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Okänt fel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          DevTools → zip
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Img Scraper</h1>
        <p className="max-w-2xl text-zinc-600">
          Klistra in URL:er från Chrome DevTools{" "}
          <span className="font-medium text-zinc-800">
            Network → Img → högerklick → Copy → Copy all listed URLs
          </span>
          . Verktyget laddar ner alla bilder och packar dem i en zip — direkt i
          webbläsaren.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="urls" className="text-sm font-medium text-zinc-800">
              Bild-URL:er
            </label>
            <span className="text-sm text-zinc-500">
              {urlCount > 0 ? `${urlCount} URL:er` : "En URL per rad"}
            </span>
          </div>
          <textarea
            id="urls"
            value={urls}
            onChange={(event) => setUrls(event.target.value)}
            placeholder={
              "https://example.com/logo.svg\nhttps://cdn.example.com/photo.webp"
            }
            rows={14}
            className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-4 py-3 font-mono text-sm leading-6 shadow-sm outline-none ring-zinc-900/10 focus:ring-2"
          />
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-200 bg-white px-4 py-4">
          <label
            htmlFor="proxy"
            className="text-sm font-medium text-zinc-800"
          >
            CORS-proxy (valfritt)
          </label>
          <p className="text-sm text-zinc-600">
            GitHub Pages kör allt i webbläsaren. Många bild-URL:er blockeras av
            CORS — då behövs en liten proxy (medföljer i{" "}
            <code className="rounded bg-zinc-100 px-1">worker/</code> för
            Cloudflare).
          </p>
          <input
            id="proxy"
            type="url"
            value={proxyUrl}
            onChange={(event) => setProxyUrl(event.target.value)}
            placeholder="https://img-scraper-proxy.ditt-konto.workers.dev"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm outline-none ring-zinc-900/10 focus:ring-2"
          />
        </div>

        <button
          type="submit"
          disabled={loading || urlCount === 0}
          className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Laddar ner och zippar…" : "Skapa zip"}
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-white px-4 py-4 text-sm shadow-sm">
          <p className="font-medium text-zinc-900">Klart</p>
          <ul className="space-y-1 text-zinc-600">
            <li>
              <span className="font-medium text-green-700">
                {result.downloaded}
              </span>{" "}
              bilder i zip
            </li>
            {result.failed > 0 ? (
              <li>
                <span className="font-medium text-red-600">{result.failed}</span>{" "}
                misslyckades
              </li>
            ) : null}
            {result.skipped > 0 ? (
              <li>
                <span className="font-medium text-zinc-800">
                  {result.skipped}
                </span>{" "}
                rader hoppades över
              </li>
            ) : null}
          </ul>

          {result.failedDetails.length > 0 ? (
            <details className="pt-2">
              <summary className="cursor-pointer text-zinc-700">
                Visa misslyckade URL:er
              </summary>
              <ul className="mt-2 max-h-48 space-y-2 overflow-auto font-mono text-xs text-zinc-600">
                {result.failedDetails.map((item) => (
                  <li key={item.url}>
                    <span className="block break-all">{item.url}</span>
                    <span className="text-red-600">{item.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
