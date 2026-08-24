import { execFileSync } from "node:child_process";

// Die E2E bekommen eine eigene D1-Ablage. Sonst laufen sie gegen dieselbe
// lokale Datenbank wie `npm run ansehen` und schlagen fehl, sobald dort
// Demodaten liegen — Tests duerfen nicht davon abhaengen, was gerade in der
// Entwicklungs-Datenbank steht.
export const E2E_STATE_DIR = ".wrangler/e2e-state";

function wrangler(args) {
  execFileSync("npx", ["wrangler", ...args], { stdio: "pipe" });
}

export default function globalSetup() {
  wrangler(["d1", "migrations", "apply", "vh-portal", "--local", "--persist-to", E2E_STATE_DIR]);
  wrangler([
    "d1", "execute", "vh-portal", "--local", "--persist-to", E2E_STATE_DIR,
    "--command", "DELETE FROM activities",
  ]);
}
