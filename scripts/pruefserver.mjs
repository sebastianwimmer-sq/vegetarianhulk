/* pruefserver.mjs — EIN Prueferver fuer alle Browser-Tore (28.09.2026).
 *
 * WARUM
 * Vier Tore starteten `python3 -m http.server` auf einem FESTEN Port und
 * warteten STARR 700–1200 ms, bis er „bestimmt" laeuft. Zwei davon teilten
 * sich sogar denselben Port (8247) und liefen direkt hintereinander. Unter
 * Last reichte die Wartezeit nicht, oder der Port war noch vom Vorgaenger
 * belegt — das Tor war mal rot, mal gruen, und im Gesamtlauf von
 * premium-check nie dasselbe. Ein Tor, dem man nicht glauben kann, macht jede
 * gruene Meldung wertlos.
 *
 * Hier: Node-Server auf Port 0 (das System vergibt einen freien), und das
 * Versprechen erfuellt sich erst, wenn er wirklich annimmt.
 *
 *   const { basis, schliessen } = await pruefserver(WURZEL);
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const TYPEN = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.gpx': 'application/gpx+xml',
  '.txt': 'text/plain', '.xml': 'application/xml', '.pdf': 'application/pdf' };

export async function pruefserver(wurzel, { ersetzen } = {}) {
  const server = await new Promise((fertig) => {
    const s = createServer(async (anf, ant) => {
      let pfad = join(wurzel, decodeURIComponent(anf.url.split('?')[0]));
      if (pfad.endsWith('/')) pfad += 'index.html';
      try {
        let inhalt = await readFile(pfad);
        if (ersetzen) inhalt = (await ersetzen(pfad, inhalt)) ?? inhalt;
        ant.writeHead(200, { 'Content-Type': TYPEN[extname(pfad)] || 'application/octet-stream' });
        ant.end(inhalt);
      } catch { ant.writeHead(404); ant.end('weg'); }
    });
    s.listen(0, '127.0.0.1', () => fertig(s));
  });
  return {
    basis: `http://localhost:${server.address().port}`,
    port: server.address().port,
    schliessen: () => new Promise((r) => server.close(() => r())),
  };
}
