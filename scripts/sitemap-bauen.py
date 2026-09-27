#!/usr/bin/env python3
"""sitemap-bauen.py — sitemap.xml aus den Seiten ABLEITEN, nicht pflegen.

Bis 27.09.2026 stand die Sitemap von Hand da: neun Eintraege, von fuenf
Tourseiten nur eine. Vier Touren kannte keine Suchmaschine ueber die Sitemap.
Eine Uebersichtsdatei wird abgeleitet (kern.md) — also:

  python3 scripts/sitemap-bauen.py            # sitemap.xml neu schreiben
  python3 scripts/sitemap-bauen.py --pruefen  # Exit 1, wenn eine Seite fehlt/zu viel ist
  python3 scripts/sitemap-bauen.py --selbsttest

Aufgenommen wird jede .html mit rel=canonical auf vegetarianhulk.de und ohne
noindex. Die URL ist der Canonical, nicht der Dateipfad — so steht dieselbe
Adresse in Sitemap und Seite. lastmod = letzter Commit der Datei, bei
uncommitteten Aenderungen heute.
"""
import datetime
import pathlib
import re
import subprocess
import sys
import tempfile

WURZEL = pathlib.Path(__file__).resolve().parent.parent
HOST = "https://vegetarianhulk.de/"
# Ordner, die nicht zur Website gehoeren (robots.txt + Werkzeugablagen).
AUSGESCHLOSSEN = {"archive", "design", "design-archives", "design-system-sync", "admin",
                  "audit", "audit-reports", "workers", "vendor", "email-templates",
                  "mail-templates", "docs", "node_modules", "release", "scripts",
                  "vegetarianhulk.de_preview", "prototypes", "command", "_preview",
                  "second-brain"}
PRIORITAET = {"": "1.0", "touren/": "0.95", "newsletter": "0.9", "partner-picks/": "0.9",
              "kooperationen.html": "0.9", "anfrage.html": "0.7",
              "impressum.html": "0.3", "datenschutz.html": "0.3"}

RE_CANON = re.compile(r'<link[^>]+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)', re.I)
RE_CANON2 = re.compile(r'<link[^>]+href=["\']([^"\']+)["\'][^>]*rel=["\']canonical', re.I)
RE_NOINDEX = re.compile(r'<meta[^>]+name=["\']robots["\'][^>]*content=["\'][^"\']*noindex', re.I)


def seiten(wurzel):
    for pfad in sorted(wurzel.rglob("*.html")):
        teile = pfad.relative_to(wurzel).parts
        if teile[0] in AUSGESCHLOSSEN or any(t.startswith(".") for t in teile):
            continue
        text = pfad.read_text(encoding="utf-8", errors="replace")
        if RE_NOINDEX.search(text):
            continue
        m = RE_CANON.search(text) or RE_CANON2.search(text)
        if not m or not m.group(1).startswith(HOST):
            continue
        yield pfad, m.group(1)


def lastmod(pfad, wurzel):
    heute = datetime.date.today().isoformat()
    try:
        dreckig = subprocess.run(["git", "status", "--porcelain", "--", str(pfad)], cwd=wurzel,
                                 capture_output=True, text=True, check=True).stdout.strip()
        if dreckig:
            return heute
        datum = subprocess.run(["git", "log", "-1", "--format=%cs", "--", str(pfad)], cwd=wurzel,
                               capture_output=True, text=True, check=True).stdout.strip()
        return datum or heute
    except (subprocess.CalledProcessError, FileNotFoundError):
        return heute


def bauen(wurzel):
    eintraege = {}
    for pfad, url in seiten(wurzel):
        eintraege.setdefault(url, pfad)  # doppelter Canonical: erster gewinnt
    zeilen = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url in sorted(eintraege, key=lambda u: (u != HOST, u)):
        rest = url[len(HOST):]
        prio = PRIORITAET.get(rest, "0.85" if rest.startswith("touren/") else "0.6")
        zeilen += ["  <url>", f"    <loc>{url}</loc>",
                   f"    <lastmod>{lastmod(eintraege[url], wurzel)}</lastmod>",
                   f"    <priority>{prio}</priority>", "  </url>"]
    zeilen.append("</urlset>")
    return "\n".join(zeilen) + "\n"


def locs(xml):
    return set(re.findall(r"<loc>([^<]+)</loc>", xml))


def selbsttest():
    with tempfile.TemporaryDirectory() as tmp:
        w = pathlib.Path(tmp)
        def seite(rel, kopf):
            p = w / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(f"<html><head>{kopf}</head></html>", encoding="utf-8")
        seite("index.html", f'<link rel="canonical" href="{HOST}">')
        seite("touren/neu/index.html", f'<link rel="canonical" href="{HOST}touren/neu/">')
        seite("geheim/index.html", f'<meta name="robots" content="noindex,follow"><link rel="canonical" href="{HOST}geheim/">')
        seite("archive/alt.html", f'<link rel="canonical" href="{HOST}alt.html">')
        seite("ohne.html", "<title>ohne canonical</title>")
        seite("fremd.html", '<link href="https://example.org/" rel="canonical">')
        got = locs(bauen(w))
        soll = {HOST, f"{HOST}touren/neu/"}
        if got != soll:
            print(f"✗ Selbsttest: erwartet {sorted(soll)}, bekommen {sorted(got)}")
            return 1
    print("✓ Selbsttest: noindex, Archiv, fehlender und fremder Canonical korrekt ausgeschlossen")
    return 0


def main():
    if "--selbsttest" in sys.argv:
        return selbsttest()
    neu = bauen(WURZEL)
    ziel = WURZEL / "sitemap.xml"
    if "--pruefen" in sys.argv:
        alt = ziel.read_text(encoding="utf-8") if ziel.exists() else ""
        fehlt, zuviel = locs(neu) - locs(alt), locs(alt) - locs(neu)
        for u in sorted(fehlt):
            print(f"✗ fehlt in sitemap.xml: {u}")
        for u in sorted(zuviel):
            print(f"✗ steht in sitemap.xml, ist aber keine indexierbare Seite: {u}")
        if fehlt or zuviel:
            print("  → python3 scripts/sitemap-bauen.py")
            return 1
        print(f"✓ sitemap.xml deckt alle {len(locs(neu))} indexierbaren Seiten")
        return 0
    ziel.write_text(neu, encoding="utf-8")
    print(f"sitemap.xml: {len(locs(neu))} Seiten")
    return 0


if __name__ == "__main__":
    sys.exit(main())
