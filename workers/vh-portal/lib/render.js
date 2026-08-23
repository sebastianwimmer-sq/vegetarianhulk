const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

const KIND_LABELS = {
  wandern: "Wandern",
  laufen: "Laufen",
  radfahren: "Radfahren",
  gehen: "Gehen",
  kraft: "Krafttraining",
  schwimmen: "Schwimmen",
  sonstiges: "Training",
};

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

export function formatDuration(seconds) {
  if (seconds < SECONDS_PER_HOUR) {
    return `${Math.round(seconds / SECONDS_PER_MINUTE)} min`;
  }
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.round((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return `${hours}:${String(minutes).padStart(2, "0")} h`;
}

export function formatNumber(value, fractionDigits = 0) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(isoString) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(isoString));
}

// Die Sportart kommt aus einer festen Zuordnung, nie roh aus der Nutzlast —
// unbekannte Typen landen als "sonstiges" und damit auf "Training".
export function kindLabel(kind) {
  return KIND_LABELS[kind] ?? KIND_LABELS.sonstiges;
}
