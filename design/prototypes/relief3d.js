/* ============================================================
   VH RELIEF 3D — prozeduraler Low-Poly-Berg im Marken-Look.
   Scrollytelling: Scroll steuert Weg-Fortschritt + ~90° Drehung.
   Smashy wandert die Serpentinen, Wetterstation am Gipfel (live).
   Kein Asset, keine Lizenz — alles generiert. reduced-motion-safe.
   ============================================================ */
import * as THREE from './vendor/three.module.min.js';

const section = document.querySelector('.grat-wrap');
const canvas = document.querySelector('.berg-canvas');
const sticky = document.querySelector('.grat-sticky');
const track = document.querySelector('.grat-track');
if (section && canvas && sticky && track) init();

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    section.classList.add('no3d');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  /* ---- Licht: warmes Gold von Ost, Emerald-Fill, dunkler Grund ---- */
  scene.add(new THREE.HemisphereLight(0xd8ecdc, 0x061c12, 0.85));
  const sun = new THREE.DirectionalLight(0xe8d5a4, 1.5);
  sun.position.set(6, 7, 2);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x50c878, 0.35);
  fill.position.set(-5, 3, -4);
  scene.add(fill);

  /* ---- Terrain: Peak + Grate + Rand-Falloff, Vertex-Farben nach Höhe ---- */
  const SIZE = 10, SEG = 110;
  const PEAK = { x: 0.2, z: -1.0 };
  function height(x, z) {
    const dx = x - PEAK.x, dz = z - PEAK.z;
    const r2 = dx * dx + dz * dz;
    let h = 3.0 * Math.exp(-r2 / 2.2);
    h += 0.5 * Math.exp(-((x + 2.6) ** 2 + (z + 0.4) ** 2) / 1.6);      /* Nebengipfel */
    h += 0.22 * Math.sin(x * 2.3 + 1.7) * Math.sin(z * 1.9 - 0.6);      /* Grate */
    h += 0.09 * Math.sin(x * 6.1) * Math.cos(z * 5.3);                  /* Fels-Detail */
    const edge = Math.min(1, Math.max(0, (4.6 - Math.max(Math.abs(x), Math.abs(z))) / 1.4));
    return Math.max(0, h) * edge * edge;
  }
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cTal = new THREE.Color('#0B2E1E'), cHang = new THREE.Color('#155038'),
        cFels = new THREE.Color('#2E6B4C'), cSchnee = new THREE.Color('#E9E9DC');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = height(x, z);
    pos.setY(i, h);
    const t = Math.min(1, h / 3.0);
    if (t < 0.35) tmp.lerpColors(cTal, cHang, t / 0.35);
    else if (t < 0.8) tmp.lerpColors(cHang, cFels, (t - 0.35) / 0.45);
    else tmp.lerpColors(cFels, cSchnee, (t - 0.8) / 0.2);
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0
  }));
  scene.add(terrain);
  /* feine Linien-Textur obendrauf (Marken-Fineline) */
  const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    wireframe: true, color: 0xF3EBD9, transparent: true, opacity: 0.045
  }));
  scene.add(wire);
  /* Sockel-Platte */
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(SIZE + 0.3, 0.5, SIZE + 0.3),
    new THREE.MeshStandardMaterial({ color: 0x04140C, roughness: 1 })
  );
  plinth.position.y = -0.26;
  scene.add(plinth);

  /* ---- Serpentinen-Weg: Kehren zum Gipfel, auf Terrainhöhe ---- */
  const way = [
    [-3.6, 3.7], [0.4, 3.4], [2.9, 2.9], [3.3, 2.2], [1.2, 1.9], [-1.9, 1.8],
    [-2.6, 1.1], [-0.8, 0.7], [2.0, 0.6], [2.6, 0.0], [1.0, -0.4], [-1.2, -0.5],
    [-1.7, -1.0], [-0.3, -1.3], [0.9, -1.2], [1.1, -1.55], [0.2, -1.35], [PEAK.x, PEAK.z]
  ].map(([x, z]) => new THREE.Vector3(x, height(x, z) + 0.05, z));
  const rough = new THREE.CatmullRomCurve3(way, false, 'centripetal', 0.35);
  /* Route dicht samplen und JEDEN Punkt aufs Terrain projizieren —
     sonst schneidet die Kurve durch Haenge/haengt ueber Taelern */
  const proj = rough.getPoints(260).map(pt => new THREE.Vector3(pt.x, height(pt.x, pt.z) + 0.05, pt.z));
  const curve = new THREE.CatmullRomCurve3(proj, false, 'catmullrom', 0);
  /* Basis: gestrichelte Wanderkarten-Linie */
  const basePts = curve.getPoints(500);
  const baseGeo = new THREE.BufferGeometry().setFromPoints(basePts);
  const baseLine = new THREE.Line(baseGeo, new THREE.LineDashedMaterial({
    color: 0xF3EBD9, transparent: true, opacity: 0.55, dashSize: 0.12, gapSize: 0.09
  }));
  baseLine.computeLineDistances();
  scene.add(baseLine);
  /* Fortschritt: Emerald-Tube, drawRange waechst mit p */
  const TUBE_SEG = 600;
  const tubeGeo = new THREE.TubeGeometry(curve, TUBE_SEG, 0.028, 5, false);
  const tube = new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({ color: 0x50C878 }));
  const tubeIdx = tubeGeo.index.count;
  tube.geometry.setDrawRange(0, 0);
  scene.add(tube);

  /* ---- Overlays (HTML) an 3D-Ankern ---- */
  const WP_T = [0.02, 0.36, 0.7, 0.985];
  const anchors = [];
  function anchor(el, v3, oy) { if (el) anchors.push({ el, v3, oy: oy || 0 }); }
  const wps = Array.from(document.querySelectorAll('.wp'));
  wps.forEach((el, i) => anchor(el, curve.getPointAt(WP_T[i]), 0));
  anchor(document.querySelector('[data-poi="start"]'), curve.getPointAt(0.004).add(new THREE.Vector3(-0.5, 0.02, 0)), 0);
  anchor(document.querySelector('[data-poi="kapelle"]'), curve.getPointAt(0.36).add(new THREE.Vector3(0.45, 0, 0.25)), 0);
  anchor(document.querySelector('[data-poi="huette"]'), curve.getPointAt(0.7).add(new THREE.Vector3(0.4, 0, 0.3)), 0);
  const kreuzEl = document.querySelector('[data-poi="kreuz"]');
  anchor(kreuzEl, new THREE.Vector3(PEAK.x, height(PEAK.x, PEAK.z) + 0.04, PEAK.z), 0);
  const chip = document.querySelector('.wetter-hud');
  const smashy = document.querySelector('.grat-smashy');
  const smashyAnchor = { el: smashy, v3: curve.getPointAt(0).clone(), oy: 0 };
  if (smashy) anchors.push(smashyAnchor);

  /* ---- Panel-Inhalte ---- */
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

  /* ---- Scroll -> Ziel-Fortschritt (0..1) ---- */
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
  /* Klick auf Wegweiser/Pfeile -> scrollt zur Stelle (bzw. setzt direkt) */
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

  /* ---- Resize ---- */
  function resize() {
    const w = sticky.clientWidth, h = sticky.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  /* ---- Frame-Loop: Kamera-Orbit + Fortschritt + Projektion ---- */
  const center = new THREE.Vector3(0, 1.0, 0.2);
  const v = new THREE.Vector3();
  function frame() {
    p += (target - p) * 0.075;                       /* Daempfung */
    /* ~90 Grad Drehung ueber die Strecke + leichter Anstieg der Kamera */
    const az = -0.65 + p * 1.6;
    const el = 0.42 + p * 0.1;
    const R = 8.6;
    camera.position.set(
      center.x + R * Math.cos(el) * Math.sin(az),
      center.y + R * Math.sin(el),
      center.z + R * Math.cos(el) * Math.cos(az)
    );
    camera.lookAt(center);
    /* Weg-Fortschritt + Smashy auf der Kurve */
    tube.geometry.setDrawRange(0, Math.floor(tubeIdx * p));
    const sp = curve.getPointAt(Math.min(0.999, Math.max(0.001, p)));
    smashyAnchor.v3.copy(sp).y += 0.02;
    /* Abschnitt -> Panel */
    let idx = 0;
    for (let i = 1; i < 4; i++) if (p >= (WP_T[i - 1] + WP_T[i]) / 2) idx = i;
    setPanel(idx);
    /* Smashy hopst nur, wenn gewandert wird */
    if (smashy) {
      if (Math.abs(p - lastP) > 0.0004) walkT = 14;
      walkT = Math.max(0, walkT - 1);
      smashy.classList.toggle('walking', walkT > 0);
    }
    lastP = p;
    /* Overlays projizieren */
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

  /* ---- Wetterstation am Gipfel: Open-Meteo Kampenwand ---- */
  if (chip && window.fetch) {
    const WMO = c => c === 0 ? 'klar' : c <= 2 ? 'leicht bewölkt' : c === 3 ? 'bedeckt'
      : c <= 48 ? 'Nebel' : c <= 67 ? 'Regen' : c <= 77 ? 'Schneefall' : c <= 82 ? 'Schauer' : 'Gewitter';
    fetch('https://api.open-meteo.com/v1/forecast?latitude=47.7546&longitude=12.3537&current=temperature_2m,weather_code&daily=sunset&timezone=Europe%2FBerlin&forecast_days=1')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const s = (d.daily.sunset[0] || '').slice(11, 16);
        chip.querySelector('[data-w-temp]').textContent = Math.round(d.current.temperature_2m);
        chip.querySelector('[data-w-cond]').textContent = WMO(d.current.weather_code);
        chip.querySelector('[data-w-meta]').textContent = '1669 m' + (s ? ' · Sonne bis ' + s : '');
        chip.hidden = false;
      })
      .catch(() => {});
  }
}
