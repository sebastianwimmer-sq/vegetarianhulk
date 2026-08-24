// Nur fuer die lokale Ansicht (`npm run ansehen`).
//
// Produktiv bedient die Zonen-Route ausschliesslich /gipfelbuch/* — /v3.css,
// /fonts.css und /fonts/* kommen von GitHub Pages unter derselben Domain.
// Lokal kennt wrangler dev diese Pfade nicht, die Seite waere ungestylt und
// jede Sichtpruefung wertlos.
//
// Sicherheit: das Ziel ist fest verdrahtet und die Pfadliste abgeschlossen.
// Weder Anfrage-Host noch Anfrage-Pfad koennen bestimmen, wohin gegriffen wird —
// sonst waere das ein offener Proxy. Ohne DEV_SHELL_PROXY="on" passiert nichts.

const SHELL_ORIGIN = "https://vegetarianhulk.de";
const EXACT_PATHS = new Set(["/v3.css", "/fonts.css"]);
const PATH_PREFIX = "/fonts/";

function isShellPath(pathname) {
  if (EXACT_PATHS.has(pathname)) return true;
  return pathname.startsWith(PATH_PREFIX) && !pathname.includes("..");
}

export async function handleShellRequest(request, env, fetchImpl = fetch) {
  if (env.DEV_SHELL_PROXY !== "on") return null;

  const { pathname } = new URL(request.url);
  if (!isShellPath(pathname)) return null;

  const upstream = await fetchImpl(`${SHELL_ORIGIN}${pathname}`);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "text/plain",
      "Cache-Control": "public, max-age=60",
    },
  });
}
