export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target) {
      return new Response("Missing ?url=", { status: 400, headers: corsHeaders() });
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      return new Response("Invalid url", { status: 400, headers: corsHeaders() });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response("Only http(s) allowed", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const upstream = await fetch(parsed.toString(), { redirect: "follow" });
    if (!upstream.ok) {
      return new Response(`Upstream HTTP ${upstream.status}`, {
        status: upstream.status,
        headers: corsHeaders(),
      });
    }

    const headers = corsHeaders();
    const contentType = upstream.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);

    return new Response(upstream.body, { status: 200, headers });
  },
};

function corsHeaders() {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
}
