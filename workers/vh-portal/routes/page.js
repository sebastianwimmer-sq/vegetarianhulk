import { htmlResponse } from "../lib/http.js";
import { PAGE_STYLES } from "../lib/page-styles.js";
import { escapeHtml, formatDate, formatDuration, formatNumber, kindLabel } from "../lib/render.js";
import { loadLogbook } from "./logbook.js";

const CACHE_SECONDS = 120;

// /v3.css und /fonts.css bewusst OHNE ?v=-Hash: bump-asset-versions.sh
// schliesst workers/ aus (reine Static-Site-Pipeline). GitHub Pages liefert
// max-age=600, ein veraltetes Stylesheet haelt also hoechstens zehn Minuten.
const SHELL_STYLES = ["/fonts.css", "/v3.css"];

function renderFacts(item) {
  const facts = [
    item.elevationM ? `${formatNumber(item.elevationM)} hm` : null,
    item.distanceM ? `${formatNumber(item.distanceM / 1000, 1)} km` : null,
    formatDuration(item.durationS),
  ].filter(Boolean);

  return facts.map((fact) => `<b>${escapeHtml(fact)}</b>`).join('<i class="hsep"></i>');
}

function renderRow(item) {
  return `
      <li class="gb-row">
        <span class="gb-row__date">${escapeHtml(formatDate(item.startedAt))}</span>
        <span class="gb-row__kind">${escapeHtml(kindLabel(item.kind))}</span>
        <span class="gb-row__facts">${renderFacts(item)}</span>
      </li>`;
}

function renderEmpty() {
  return `
    <div class="gb-empty">
      <p>Noch nichts eingetragen. Die nächste Einheit schreibt sich hier von allein rein.</p>
      <span>Wartet auf das erste Workout</span>
    </div>`;
}

function renderBody(activities, totals, year) {
  if (activities.length === 0) return renderEmpty();

  return `
    <div class="gb-hero">
      <div class="gb-hero__main">
        <span class="gb-hero__label">Höhenmeter ${year}</span>
        <span class="gb-hero__value">${formatNumber(totals.elevationM)}<span class="gb-hero__unit">hm</span></span>
      </div>
      <div class="gb-side">
        <div class="gb-side__item">
          <span class="gb-side__label">Distanz</span>
          <span class="gb-side__value">${formatNumber(totals.distanceKm, 1)}<small>km</small></span>
        </div>
        <div class="gb-side__item">
          <span class="gb-side__label">Einheiten</span>
          <span class="gb-side__value">${formatNumber(totals.activityCount)}</span>
        </div>
        <div class="gb-side__item">
          <span class="gb-side__label">Streak</span>
          <span class="gb-side__value">${formatNumber(totals.streakDays)}<small>Tage</small></span>
        </div>
      </div>
    </div>

    <ul class="gb-rows">${activities.map(renderRow).join("")}</ul>
    <p class="gb-foot">Direkt von der Uhr <i class="hsep"></i> keine Handarbeit</p>`;
}

export function renderGipfelbuchPage({ activities, totals, year }) {
  const styleLinks = SHELL_STYLES.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n");

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' https:; script-src 'self' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Gipfelbuch — VegetarianHulk</title>
<meta name="description" content="Das Logbuch von VegetarianHulk: Höhenmeter, Kilometer und Einheiten dieses Jahres — direkt von der Uhr, ohne Handarbeit.">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="https://vegetarianhulk.de/gipfelbuch/">
<meta name="theme-color" content="#0B2418">
<meta property="og:title" content="Gipfelbuch — VegetarianHulk">
<meta property="og:description" content="Was zwischen den Touren passiert: Höhenmeter, Kilometer und Einheiten, direkt von der Uhr.">
<meta property="og:type" content="website">
<meta property="og:locale" content="de_DE">
<meta property="og:url" content="https://vegetarianhulk.de/gipfelbuch/">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%23045927'/%3E%3Ctext x='50' y='66' font-family='Inter,sans-serif' font-size='52' font-weight='900' text-anchor='middle' fill='%23fff'%3EV%3C/text%3E%3C/svg%3E">
${styleLinks}
<style>${PAGE_STYLES}</style>
</head>
<body>
<main class="gb-wrap">
  <p class="gb-kicker"><span class="gb-dot"></span>Logbuch</p>
  <h1 class="gb-title">Was zwischen den Touren passiert.</h1>
  <p class="gb-lead">Zwischen zwei Bergtouren liegen Wochen. Trainiert wird trotzdem — hier steht, was die Uhr davon mitbekommen hat.</p>
  ${renderBody(activities, totals, year)}
</main>
</body>
</html>`;
}

export async function handleGipfelbuchPage(request, env) {
  const data = await loadLogbook(env.DB, new Date());

  return htmlResponse(renderGipfelbuchPage(data), {
    headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` },
  });
}
