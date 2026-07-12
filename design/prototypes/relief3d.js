/* ============================================================
   VH RELIEF 3D — DER ECHTE WATZMANN.
   Terrain aus echten Höhendaten (Terrarium-DEM, lokal gebacken:
   watzmann-dem.json — zur Laufzeit kein Third-Party-Call).
   Route im Strava-Look: Gradient-Kern + Glow + Puls am Kopf.
   Scroll = Aufstieg: Weg wächst, Smashy wandert, ~90° Drehung.
   ============================================================ */
import * as THREE from './vendor/three.module.min.js';

const section = document.querySelector('.grat-wrap');
const canvas = document.querySelector('.berg-canvas');
const sticky = document.querySelector('.grat-sticky');
const track = document.querySelector('.grat-track');

if (section && canvas && sticky && track) {
  fetch('watzmann-dem.json?v=hd2')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(dem => init(dem))
    .catch(() => section.classList.add('no3d'));
}

function init(DEM) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    section.classList.add('no3d');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  /* ---- Licht: warmes Abendlicht + Emerald-Fill ---- */
  scene.add(new THREE.HemisphereLight(0xd8ecdc, 0x0a2418, 0.68));
  const sun = new THREE.DirectionalLight(0xf0dcae, 2.4);
  sun.position.set(9, 5, 4);                     /* tiefe Abendsonne: lange Schatten */
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6fcf97, 0.42);
  fill.position.set(-5, 3, -4);
  scene.add(fill);

  /* ---- Echtes Terrain: bilineares DEM-Sampling ---- */
  const SIZE = 10, SEG = 254;
  const SPAN = DEM.max - DEM.min;
  const V_SCALE = SIZE * (SPAN / (DEM.km * 1000)) * 1.35;   /* leichte Modell-Überhöhung */
  function demAt(ix, iy) {
    ix = Math.max(0, Math.min(DEM.w - 1, ix));
    iy = Math.max(0, Math.min(DEM.h - 1, iy));
    return DEM.data[iy * DEM.w + ix] / 65535;
  }
  function height(x, z) {
    const u = (x + SIZE / 2) / SIZE * (DEM.w - 1);
    const v = (z + SIZE / 2) / SIZE * (DEM.h - 1);
    const x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
    const hh = demAt(x0, y0) * (1 - fx) * (1 - fy) + demAt(x0 + 1, y0) * fx * (1 - fy)
             + demAt(x0, y0 + 1) * (1 - fx) * fy + demAt(x0 + 1, y0 + 1) * fx * fy;
    return hh * V_SCALE;
  }

  /* Gipfel im Grid finden (Kreuz-Anker) */
  let peakI = 0;
  for (let i = 1; i < DEM.data.length; i++) if (DEM.data[i] > DEM.data[peakI]) peakI = i;
  const PEAK = {
    x: (peakI % DEM.w) / (DEM.w - 1) * SIZE - SIZE / 2,
    z: Math.floor(peakI / DEM.w) / (DEM.h - 1) * SIZE - SIZE / 2
  };

  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  /* Farben: Höhe + Hangneigung (steil = Fels, hoch + flach = Schnee) */
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const cTal = new THREE.Color('#0A2A1B'), cHang = new THREE.Color('#14432B'),
        cFels = new THREE.Color('#3E5A48'), cSchnee = new THREE.Color('#F0EDE2');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / V_SCALE;
    const ny = nrm.getY(i);
    tmp.lerpColors(cTal, cHang, Math.min(1, t / 0.5));
    const steil = Math.min(1, Math.max(0, (0.74 - ny) / 0.32));
    tmp.lerp(cFels, steil * 0.85);
    if (t > 0.68 && ny > 0.55) tmp.lerp(cSchnee, Math.min(1, (t - 0.68) / 0.18));
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: false, roughness: 0.92, metalness: 0
  }));
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  scene.add(terrain);
  const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    wireframe: true, color: 0xF3EBD9, transparent: true, opacity: 0.035
  }));
  scene.add(wire);
  /* Sockel wie beim Relief-Modell */
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(SIZE + 0.24, 0.6, SIZE + 0.24),
    new THREE.MeshStandardMaterial({ color: 0x04140C, roughness: 1 })
  );
  plinth.position.y = -0.31;
  scene.add(plinth);

  /* ---- Route: ECHTER Watzmann-Normalweg (reale Koordinaten) ----
     Wimbachbruecke -> Stubenalm -> Mitterkaseralm -> Watzmannhaus
     -> Grat -> Hocheck -> Mittelspitze. lat/lon -> Weltkoordinaten. */
  const LAT0 = 47.5545, LON0 = 12.9221;
  const DLAT = (DEM.km / 2) / 111.32;
  const DLON = (DEM.km / 2) / (111.32 * Math.cos(LAT0 * Math.PI / 180));
  const ll = (lat, lon) => new THREE.Vector3(
    (lon - LON0) / DLON * (SIZE / 2), 0, -(lat - LAT0) / DLAT * (SIZE / 2));
  const way = [
    ll(47.5735, 12.9020),   /* Wimbachbruecke, Tal */
    ll(47.5754, 12.9068),
    ll(47.5763, 12.9118),   /* Stubenalm */
    ll(47.5744, 12.9150),
    ll(47.5738, 12.9168),   /* Mitterkaseralm */
    ll(47.5722, 12.9160),
    ll(47.5713, 12.9178),   /* Falzsteig */
    ll(47.5697, 12.9166),   /* Watzmannhaus 1930 */
    ll(47.5672, 12.9158),
    ll(47.5655, 12.9165),   /* Grataufschwung */
    ll(47.5628, 12.9168),
    ll(47.5605, 12.9172),
    ll(47.5590, 12.9175),   /* Hocheck */
    ll(47.5572, 12.9195),
    ll(47.5545, 12.9221)    /* Mittelspitze */
  ];
  const rough = new THREE.CatmullRomCurve3(way, false, 'centripetal', 0.4);
  const proj = rough.getPoints(300).map(pt => new THREE.Vector3(pt.x, height(pt.x, pt.z) + 0.04, pt.z));
  const curve = new THREE.CatmullRomCurve3(proj, false, 'catmullrom', 0);
  /* Wegpunkt-Parameter nach ECHTEN Hoehen finden (1200/1930 hm) */
  function findT(hm) {
    for (let i = 0; i <= 400; i++) {
      const t = i / 400;
      const q = curve.getPointAt(t);
      if (DEM.min + q.y / V_SCALE * SPAN >= hm) return t;
    }
    return 1;
  }

  /* Basis: gestrichelte Wanderkarten-Linie */
  const baseGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(500));
  const baseLine = new THREE.Line(baseGeo, new THREE.LineDashedMaterial({
    color: 0xF3EBD9, transparent: true, opacity: 0.5, dashSize: 0.12, gapSize: 0.09
  }));
  baseLine.computeLineDistances();
  scene.add(baseLine);

  /* Strava-Look: Gradient-Kern + additiver Glow, beide wachsen mit p */
  const TUBE_SEG = 640;
  const tubeGeo = new THREE.TubeGeometry(curve, TUBE_SEG, 0.02, 6, false);
  const ringVerts = tubeGeo.attributes.position.count / (TUBE_SEG + 1);
  const tubeCols = new Float32Array(tubeGeo.attributes.position.count * 3);
  const cA = new THREE.Color('#D1F2EB'), cB = new THREE.Color('#50C878');
  for (let i = 0; i < tubeGeo.attributes.position.count; i++) {
    const seg = Math.floor(i / ringVerts) / TUBE_SEG;
    tmp.lerpColors(cA, cB, Math.min(1, seg * 1.4));
    tubeCols[i * 3] = tmp.r; tubeCols[i * 3 + 1] = tmp.g; tubeCols[i * 3 + 2] = tmp.b;
  }
  tubeGeo.setAttribute('color', new THREE.BufferAttribute(tubeCols, 3));
  const tube = new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  tube.geometry.setDrawRange(0, 0);
  scene.add(tube);
  const glowGeo = new THREE.TubeGeometry(curve, TUBE_SEG, 0.05, 6, false);
  const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({
    color: 0x50C878, transparent: true, opacity: 0.12,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  glow.geometry.setDrawRange(0, 0);
  scene.add(glow);
  const tubeIdx = tubeGeo.index.count, glowIdx = glowGeo.index.count;

  /* ---- Overlays (HTML) an 3D-Ankern ---- */
  const WP_T = [0.015, findT(1420), findT(1930), 0.99];
  const anchors = [];
  function anchor(el, v3, oy) { if (el) anchors.push({ el, v3, oy: oy || 0 }); }
  const wps = Array.from(document.querySelectorAll('.wp'));
  wps.forEach((el, i) => anchor(el, curve.getPointAt(WP_T[i]), 0));
  anchor(document.querySelector('[data-poi="start"]'), curve.getPointAt(0.004).add(new THREE.Vector3(-0.5, 0.02, 0)), 0);
  anchor(document.querySelector('[data-poi="kapelle"]'), curve.getPointAt(0.06).add(new THREE.Vector3(0.35, 0, 0.3)), 0);
  anchor(document.querySelector('[data-poi="huette"]'), curve.getPointAt(findT(1930)).add(new THREE.Vector3(0.35, 0.02, -0.25)), 0);
  anchor(document.querySelector('[data-poi="kreuz"]'),
    new THREE.Vector3(PEAK.x, height(PEAK.x, PEAK.z) + 0.04, PEAK.z), 0);
  const smashy = document.querySelector('.grat-smashy');
  const smashyAnchor = { el: smashy, v3: curve.getPointAt(0).clone(), oy: 0 };
  if (smashy) anchors.push(smashyAnchor);
  const head = document.querySelector('.route-head');
  const headAnchor = { el: head, v3: curve.getPointAt(0).clone(), oy: 0 };
  if (head) anchors.push(headAnchor);

  /* ---- Panel ---- */
  const WERTE = [
    { num: '01 / Faith', title: 'Bibel-grounded. Wörtlich.', text: 'Das Fundament, bevor irgendwas anderes kommt: Schlachter 2000, jeden Morgen — bevor das Handy angeht. Sprüche 24,16 ist der Anker: hinfallen gehört dazu, liegen bleiben nicht.' },
    { num: '02 / Disziplin', title: 'Ritual statt Willenskraft.', text: 'Architektur die trägt — jeden Morgen, auch wenn keiner hinschaut. 4:50 Uhr, Bibel, Gym. Seit Jahren.' },
    { num: '03 / Vegetarisch + Stark', title: 'Beweis seit 2016.', text: 'Muskelaufbau ohne Fleisch ist kein Kompromiss — es ist mein Beweis, dass beides geht. Teller statt Theorie.' },
    { num: '04 / Fitness', title: 'Gym seit 2017.', text: '4-5× pro Woche, Lifting plus Cardio — und am Wochenende den Grat rauf. Kraft ist die Basis für jede Tour.' }
  ];
  const panel = document.querySelector('.grat-panel .inner');
  const stepNow = document.querySelector('[data-step-now]');
  let curIdx = 0, panelBusy = false;
  function setPanel(i) {
    if (i === curIdx || !panel) return;
    curIdx = i;
    wps.forEach((b, j) => b.classList.toggle('on', j === i));
    section.classList.toggle('summit', i === 3);
    if (stepNow) stepNow.textContent = '0' + (i + 1);
    if (panelBusy) return;
    panelBusy = true;
    panel.classList.add('swap-out');
    setTimeout(() => {
      panel.querySelector('[data-p-num]').textContent = WERTE[curIdx].num;
      panel.querySelector('[data-p-title]').textContent = WERTE[curIdx].title;
      panel.querySelector('[data-p-text]').textContent = WERTE[curIdx].text;
      panel.classList.remove('swap-out');
      panel.classList.add('swap-in');
      void panel.offsetWidth;
      panel.classList.remove('swap-in');
      panelBusy = false;
    }, 240);
  }

  /* ---- Scroll -> Fortschritt ---- */
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = 0, p = 0, lastP = 0, walkT = 0;
  function readScroll() {
    const r = track.getBoundingClientRect();
    const span = track.offsetHeight - sticky.offsetHeight;
    target = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
  }
  if (!reduce) {
    window.addEventListener('scroll', readScroll, { passive: true });
    readScroll();
  }
  function goTo(i) {
    i = Math.max(0, Math.min(3, i));
    if (reduce) { target = WP_T[i]; setPanel(i); return; }
    const span = track.offsetHeight - sticky.offsetHeight;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + WP_T[i] * span + 2, behavior: 'smooth' });
  }
  wps.forEach(b => b.addEventListener('click', () => goTo(parseInt(b.dataset.i, 10))));
  document.querySelectorAll('[data-step]').forEach(b =>
    b.addEventListener('click', () => goTo(curIdx + parseInt(b.dataset.step, 10))));

  function resize() {
    const w = sticky.clientWidth, h = sticky.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  /* ---- Frame-Loop ---- */
  const baseCenter = new THREE.Vector3(0, V_SCALE * 0.3, 0.2);
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  function frame() {
    p += (target - p) * 0.075;
    const sp0 = curve.getPointAt(Math.min(0.999, Math.max(0.001, p)));
    /* Kamera zieht ins Geschehen: Blickpunkt lerpt zur Route,
       Radius dollyt in der Wegmitte nah ran */
    /* Choreografie: Establishing -> reinziehen -> Gipfel-Finale */
    const mid = Math.sin(p * Math.PI);
    center.copy(baseCenter).lerp(sp0, 0.12 + 0.42 * mid + 0.25 * p);
    const az = -2.35 + p * 1.75;
    const el = 0.52 - mid * 0.14;
    const R = 9.6 - mid * 3.4 - p * 0.8;
    camera.position.set(
      center.x + R * Math.cos(el) * Math.sin(az),
      center.y + R * Math.sin(el),
      center.z + R * Math.cos(el) * Math.cos(az)
    );
    camera.lookAt(center);
    tube.geometry.setDrawRange(0, Math.floor(tubeIdx * p));
    glow.geometry.setDrawRange(0, Math.floor(glowIdx * p));
    smashyAnchor.v3.copy(sp0).y += 0.02;
    headAnchor.v3.copy(sp0);
    let idx = 0;
    for (let i = 1; i < 4; i++) if (p >= (WP_T[i - 1] + WP_T[i]) / 2) idx = i;
    setPanel(idx);
    if (smashy) {
      if (Math.abs(p - lastP) > 0.0004) walkT = 14;
      walkT = Math.max(0, walkT - 1);
      smashy.classList.toggle('walking', walkT > 0);
    }
    lastP = p;
    const w = renderer.domElement.clientWidth, h2 = renderer.domElement.clientHeight;
    for (const a of anchors) {
      v.copy(a.v3).project(camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h2;
      a.el.style.left = x.toFixed(1) + 'px';
      a.el.style.top = (y + a.oy).toFixed(1) + 'px';
      a.el.style.visibility = v.z < 1 ? 'visible' : 'hidden';
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  section.classList.add('gl-ready');

  /* ---- Bergstation: Open-Meteo am Watzmann ---- */
  const chip = document.querySelector('.wetter-hud');
  if (chip && window.fetch) {
    const WMO = c => c === 0 ? 'klar' : c <= 2 ? 'leicht bewölkt' : c === 3 ? 'bedeckt'
      : c <= 48 ? 'Nebel' : c <= 67 ? 'Regen' : c <= 77 ? 'Schneefall' : c <= 82 ? 'Schauer' : 'Gewitter';
    fetch('https://api.open-meteo.com/v1/forecast?latitude=47.5545&longitude=12.9221&current=temperature_2m,weather_code&daily=sunset&timezone=Europe%2FBerlin&forecast_days=1')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const s = (d.daily.sunset[0] || '').slice(11, 16);
        chip.querySelector('[data-w-temp]').textContent = Math.round(d.current.temperature_2m);
        chip.querySelector('[data-w-cond]').textContent = WMO(d.current.weather_code);
        chip.querySelector('[data-w-meta]').textContent = '2713 m' + (s ? ' · Sonne bis ' + s : '');
        chip.hidden = false;
      })
      .catch(() => {});
  }
}
