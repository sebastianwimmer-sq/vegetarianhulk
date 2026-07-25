#!/usr/bin/env python3
"""
build-dem.py — regeneriert watzmann-dem.json aus AWS-Terrarium-Elevation-Tiles.

Warum: das ursprüngliche DEM (256×256) war für den Watzmann zu grob. Dieses Script
zieht höher aufgelöste Kacheln (Zoom 13) und resampled auf ein NEW×NEW-Gitter, in
GENAU der Orientierung, die relief3d.js erwartet:
  - data[iy*w + ix], normalisiert (elev-min)/(max-min)*65535 (uint16-Bereich)
  - Reihen (iy) Nord→Süd, Spalten (ix) West→Ost
  - Zentrum LAT0/LON0, Gesamtbreite = KM (quadratischer Ausschnitt)

Quelle: s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
Terrarium-Dekodierung: elev = (R*256 + G + B/256) - 32768  [Meter]

Aufruf:  python3 scripts/build-dem.py   (schreibt watzmann-dem.json)
Deps:    Pillow  (PIL). Kein Key nötig, keine Cookies.
"""
import json, math, urllib.request, io, os, sys
from PIL import Image

# ---- Parameter (mit relief3d.js synchron halten) ----
LAT0, LON0 = 47.5545, 12.9221      # Zentrum (Watzmann-Massiv)
KM = 8.2                           # Kantenlänge des Ausschnitts
NEW = 384                          # Ziel-Auflösung (war 256; 384 = schärfer, aber mobil-freundlich ~860 KB)
ZOOM = 13                          # Terrarium-Zoom (13 ≈ ~9 m/px hier)
TILE = 256
BASE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
OUT = os.path.join(os.path.dirname(__file__), "..", "watzmann-dem.json")

# ---- Bounds aus Zentrum + KM ----
half = KM / 2.0
dlat = half / 111.32
dlon = half / (111.32 * math.cos(math.radians(LAT0)))
north, south = LAT0 + dlat, LAT0 - dlat
west,  east  = LON0 - dlon, LON0 + dlon

def lon2px(lon, z): return (lon + 180.0) / 360.0 * (2 ** z) * TILE
def lat2px(lat, z):
    s = math.sin(math.radians(lat))
    return (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * (2 ** z) * TILE

# ---- Kachel-Range bestimmen ----
px_w, px_e = lon2px(west, ZOOM), lon2px(east, ZOOM)
px_n, px_s = lat2px(north, ZOOM), lat2px(south, ZOOM)
tx0, tx1 = int(px_w // TILE), int(px_e // TILE)
ty0, ty1 = int(px_n // TILE), int(px_s // TILE)
print(f"Bounds N{north:.5f} S{south:.5f} W{west:.5f} E{east:.5f}")
print(f"Kacheln x {tx0}..{tx1}  y {ty0}..{ty1}  (Zoom {ZOOM}) = {(tx1-tx0+1)*(ty1-ty0+1)} Stück")

# ---- Mosaik zusammensetzen (Elevation in Metern) ----
mos_w = (tx1 - tx0 + 1) * TILE
mos_h = (ty1 - ty0 + 1) * TILE
elev = [[0.0] * mos_w for _ in range(mos_h)]
for tx in range(tx0, tx1 + 1):
    for ty in range(ty0, ty1 + 1):
        url = BASE.format(z=ZOOM, x=tx, y=ty)
        req = urllib.request.Request(url, headers={"User-Agent": "vh-dem-builder/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            img = Image.open(io.BytesIO(r.read())).convert("RGB")
        px = img.load()
        ox, oy = (tx - tx0) * TILE, (ty - ty0) * TILE
        for j in range(TILE):
            row = elev[oy + j]
            for i in range(TILE):
                R, G, B = px[i, j]
                row[ox + i] = (R * 256 + G + B / 256.0) - 32768.0
        sys.stdout.write("."); sys.stdout.flush()
print("  Mosaik fertig.")

mos_px_x0 = tx0 * TILE
mos_px_y0 = ty0 * TILE
def sample(lat, lon):
    """bilinear aus dem Mosaik in Metern."""
    fx = lon2px(lon, ZOOM) - mos_px_x0
    fy = lat2px(lat, ZOOM) - mos_px_y0
    x0 = max(0, min(mos_w - 1, int(math.floor(fx)))); x1 = min(mos_w - 1, x0 + 1)
    y0 = max(0, min(mos_h - 1, int(math.floor(fy)))); y1 = min(mos_h - 1, y0 + 1)
    dx, dy = fx - x0, fy - y0
    return (elev[y0][x0] * (1 - dx) * (1 - dy) + elev[y0][x1] * dx * (1 - dy)
            + elev[y1][x0] * (1 - dx) * dy + elev[y1][x1] * dx * dy)

# ---- Zielgitter samplen (iy Nord→Süd, ix West→Ost) ----
grid = [[0.0] * NEW for _ in range(NEW)]
lo, hi = float("inf"), float("-inf")
for iy in range(NEW):
    lat = north + (iy / (NEW - 1)) * (south - north)
    for ix in range(NEW):
        lon = west + (ix / (NEW - 1)) * (east - west)
        e = sample(lat, lon)
        grid[iy][ix] = e
        lo = min(lo, e); hi = max(hi, e)

span = hi - lo
data = []
for iy in range(NEW):
    for ix in range(NEW):
        data.append(round((grid[iy][ix] - lo) / span * 65535))

out = {"w": NEW, "h": NEW, "min": round(lo, 1), "max": round(hi, 1), "km": KM, "data": data}
with open(OUT, "w") as f:
    json.dump(out, f, separators=(",", ":"))
print(f"→ {OUT}: {NEW}×{NEW}, {lo:.1f}–{hi:.1f} m, {len(data)} Punkte")
