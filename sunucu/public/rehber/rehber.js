// Panik butonu - 3D kurulum rehberi (Three.js)
// Her şey kodla çiziliyor; dışarıdan model dosyası yüklenmiyor.
// Birim: 1 = breadboard'daki iki delik arası (2.54 mm).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const V3 = THREE.Vector3;
const $ = s => document.querySelector(s);
const kap = $('#sahne');

// ============================================================ sahne
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
kap.prepend(renderer.domElement);

const sahne = new THREE.Scene();
sahne.background = new THREE.Color(0xf8f1e6);

const kamera = new THREE.PerspectiveCamera(35, 1, 0.5, 600);
kamera.position.set(0, 58, 62);
const kontrol = new OrbitControls(kamera, renderer.domElement);
kontrol.enableDamping = true;
kontrol.maxPolarAngle = Math.PI * 0.47;
kontrol.minDistance = 10;
kontrol.maxDistance = 170;

sahne.add(new THREE.HemisphereLight(0xffffff, 0xcdb99c, 1.6));
const gunes = new THREE.DirectionalLight(0xffffff, 2.2);
gunes.position.set(-25, 60, 35);
gunes.castShadow = true;
gunes.shadow.mapSize.set(2048, 2048);
Object.assign(gunes.shadow.camera, { left: -55, right: 55, top: 40, bottom: -40, near: 1, far: 160 });
gunes.shadow.bias = -0.0005;
sahne.add(gunes);

const zemin = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshToonMaterial({ color: 0xefe4d2 }));
zemin.rotation.x = -Math.PI / 2;
zemin.position.y = -3;
zemin.receiveShadow = true;
sahne.add(zemin);

// Çizgi film görünümü: 3 tonlu gölgelendirme
const gradyan = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
gradyan.minFilter = gradyan.magFilter = THREE.NearestFilter;
gradyan.needsUpdate = true;
const toon = (color, ek = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradyan, ...ek });
const kenarMat = new THREE.LineBasicMaterial({ color: 0x2a2420, transparent: true, opacity: 0.55 });

function kutu(g, y, d, mat, x, py, z, kenarli = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(g, y, d), mat);
  m.position.set(x, py, z);
  if (kenarli) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), kenarMat));
  return m;
}
function silindir(r, h, mat, x, y, z, kenarli = true, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.position.set(x, y, z);
  if (kenarli) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), kenarMat));
  return m;
}

// Canvas'a çizip doku yapar. ciz(ctx, P) - P: birim başına piksel.
function tuval(g, d, P, ciz) {
  const c = document.createElement('canvas');
  c.width = Math.round(g * P);
  c.height = Math.round(d * P);
  ciz(c.getContext('2d'), P);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
// Kutunun sadece üst yüzüne doku (BoxGeometry yüz sırası: +x -x +y -y +z -z)
const ustDokulu = (doku, yan) => [yan, yan, toon(0xffffff, { map: doku }), yan, yan, yan];

// ============================================================ koordinatlar
const SATIR_Z = { a: -5.5, b: -4.5, c: -3.5, d: -2.5, e: -1.5, f: 1.5, g: 2.5, h: 3.5, i: 4.5, j: 5.5 };
const RAY_Z = { eksi: 7.6, arti: 8.6, uzakEksi: -7.6, uzakArti: -8.6 };
const sutunX = s => s - 32;
const delik = (s, satir) => new V3(sutunX(s), 0, SATIR_Z[satir]);
const ray = (s, tur) => new V3(sutunX(s), 0, RAY_Z[tur]);

// ESP32 pin sıraları (USB solda, yakın taraf = bizim kullandığımız taraf), 2..16. sütun
const YAKIN_PINLER = ['3V3', 'GND', 'D15', 'D2', 'D4', 'RX2', 'TX2', 'D5', 'D18', 'D19', 'D21', 'RX0', 'TX0', 'D22', 'D23'];
const UZAK_PINLER = ['VIN', 'GND', 'D13', 'D12', 'D14', 'D27', 'D26', 'D25', 'D33', 'D32', 'D35', 'D34', 'VN', 'VP', 'EN'];
const pin = ad => new V3(sutunX(2 + YAKIN_PINLER.indexOf(ad)), 1.9, SATIR_Z.i);

// ============================================================ parçalar
const parcalar = {};   // ad -> Object3D
function parca(ad, nesne, aciklama) {
  nesne.userData.ad = ad;
  nesne.userData.aciklama = aciklama;
  nesne.visible = false;
  parcalar[ad] = nesne;
  sahne.add(nesne);
  return nesne;
}

// ---------------------------------------------------------- breadboard
{
  const doku = tuval(66, 20, 24, (c, P) => {
    const X = x => (x + 33) * P, Z = z => (z + 10) * P;
    c.fillStyle = '#f3efe7'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.fillStyle = '#ddd5c7'; c.fillRect(0, Z(-0.85), c.canvas.width, 1.7 * P);
    const d = (x, z) => { c.fillStyle = '#4b443c'; c.fillRect(X(x) - 0.21 * P, Z(z) - 0.21 * P, 0.42 * P, 0.42 * P); };
    for (let s = 1; s <= 63; s++) {
      for (const r in SATIR_Z) d(sutunX(s), SATIR_Z[r]);
      for (const r in RAY_Z) d(sutunX(s), RAY_Z[r]);
    }
    c.lineWidth = 0.12 * P;
    for (const [z, renk] of [[7.05, '#2f6fd6'], [-7.05, '#2f6fd6'], [9.2, '#d33a2c'], [-9.2, '#d33a2c']]) {
      c.strokeStyle = renk; c.beginPath(); c.moveTo(X(-31.5), Z(z)); c.lineTo(X(31.5), Z(z)); c.stroke();
    }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${0.9 * P}px sans-serif`;
    for (const x of [-32.4, 32.4]) {
      c.fillStyle = '#2f6fd6'; c.fillText('−', X(x), Z(7.6)); c.fillText('−', X(x), Z(-7.6));
      c.fillStyle = '#d33a2c'; c.fillText('+', X(x), Z(8.6)); c.fillText('+', X(x), Z(-8.6));
    }
    c.fillStyle = '#8a8076';
    c.font = `600 ${0.6 * P}px sans-serif`;
    for (let s = 1; s <= 63; s++) {
      if (s !== 1 && s % 5) continue;
      c.fillText(String(s), X(sutunX(s)), Z(6.4));
      c.fillText(String(s), X(sutunX(s)), Z(-6.4));
    }
    for (const r in SATIR_Z) { c.fillText(r, X(-32.4), Z(SATIR_Z[r])); c.fillText(r, X(32.4), Z(SATIR_Z[r])); }
  });
  const bb = new THREE.Mesh(new THREE.BoxGeometry(66, 3, 20), ustDokulu(doku, toon(0xebe4d8)));
  bb.position.y = -1.5;
  bb.add(new THREE.LineSegments(new THREE.EdgesGeometry(bb.geometry), kenarMat));
  const g = new THREE.Group();
  g.add(bb);
  parca('bb', g, '830 delikli breadboard. Aynı sütundaki a–e delikleri kendi aralarında, f–j delikleri kendi aralarında bağlıdır. Kenardaki + ve − hatları boydan boya bağlıdır.');
}

// ---------------------------------------------------------- ESP32
{
  const g = new THREE.Group();
  const siyah = toon(0x1c1c1c);
  // pin başlıkları (siyah plastik) - breadboard'a giren kısım
  g.add(kutu(15, 1, 1, siyah, -23, 0.5, SATIR_Z.i));
  g.add(kutu(15, 1, 1, siyah, -23, 0.5, SATIR_Z.b));
  // kart
  const pcbDoku = tuval(20.4, 11.2, 48, (c, P) => {
    const X = x => (x + 33.2) * P, Z = z => (z + 5.6) * P;
    c.fillStyle = '#1e2936'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.strokeStyle = '#2c3b4c'; c.lineWidth = 0.08 * P;
    for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(X(-31 + i * 1.6), Z(-2.6)); c.lineTo(X(-30 + i * 1.6), Z(2.6)); c.stroke(); }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${0.46 * P}px Consolas, ui-monospace, monospace`;
    for (let i = 0; i < 15; i++) {
      const x = sutunX(2 + i);
      for (const z of [4.5, -4.5]) {
        c.fillStyle = '#d6b25e'; c.beginPath(); c.arc(X(x), Z(z), 0.38 * P, 0, 7); c.fill();
        c.fillStyle = '#0d1116'; c.beginPath(); c.arc(X(x), Z(z), 0.17 * P, 0, 7); c.fill();
      }
      c.fillStyle = '#f4f1ea';
      c.fillText(YAKIN_PINLER[i], X(x), Z(3.75));
      c.fillText(UZAK_PINLER[i], X(x), Z(-3.75));
    }
  });
  g.add(kutu(20.4, 0.6, 11.2, ustDokulu(pcbDoku, toon(0x16202b)), -23, 1.3, 0));
  // üstte görünen pin uçları
  const pinUc = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.5, 0.3), toon(0xd6b25e), 30);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 15; i++) {
    pinUc.setMatrixAt(i, mtx.makeTranslation(sutunX(2 + i), 1.85, 4.5));
    pinUc.setMatrixAt(15 + i, mtx.makeTranslation(sutunX(2 + i), 1.85, -4.5));
  }
  g.add(pinUc);
  // ESP32-WROOM modülü + anten
  const tabanDoku = tuval(9.8, 6.6, 48, (c, P) => {
    const X = x => (x + 22.6) * P, Z = z => (z + 3.3) * P;
    c.fillStyle = '#151515'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.strokeStyle = '#c9a54a'; c.lineWidth = 0.22 * P; c.beginPath();
    let z = -2.6; c.moveTo(X(-14.8), Z(z));
    for (let i = 0; i < 7; i++) { z += 0.8; c.lineTo(X(i % 2 ? -14.8 : -13.4), Z(z - 0.4)); c.lineTo(X(i % 2 ? -14.8 : -13.4), Z(z)); }
    c.stroke();
  });
  g.add(kutu(9.8, 0.3, 6.6, ustDokulu(tabanDoku, toon(0x151515)), -17.7, 1.75, 0));
  const kalkanDoku = tuval(6.8, 6.0, 60, (c, P) => {
    c.fillStyle = '#cdd1d6'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.strokeStyle = '#a9aeb5'; c.lineWidth = 0.1 * P; c.strokeRect(0.3 * P, 0.3 * P, 6.2 * P, 5.4 * P);
    c.fillStyle = '#3b3f45'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `700 ${0.62 * P}px sans-serif`; c.fillText('ESP32-WROOM-32', 3.4 * P, 2.5 * P);
    c.font = `500 ${0.42 * P}px sans-serif`; c.fillText('Wi-Fi + Bluetooth', 3.4 * P, 3.4 * P);
  });
  g.add(kutu(6.8, 0.85, 6.0, ustDokulu(kalkanDoku, toon(0xb9bec5)), -19.0, 2.33, 0));
  // USB, regülatör, USB çipi, EN/BOOT tuşları, LED'ler
  g.add(kutu(2.2, 1.0, 2.8, toon(0xc4c8cd), -32.7, 2.1, 0));
  g.add(kutu(1.6, 0.6, 2.4, siyah, -29.4, 1.9, 1.3));
  g.add(kutu(1.8, 0.4, 1.8, siyah, -26.0, 1.8, -1.0));
  for (const z of [2.3, -2.3]) {
    g.add(kutu(1.2, 0.5, 1.6, toon(0xd9d9d9), -27.0, 1.85, z));
    g.add(silindir(0.35, 0.3, siyah, -27.0, 2.2, z, false));
  }
  g.add(kutu(0.5, 0.25, 0.3, toon(0xff3b30, { emissive: 0xff2200, emissiveIntensity: 0.8 }), -30.6, 1.72, -1.6, false));
  parca('esp', g, 'ESP32 geliştirme kartı (30 pin). Pin adları kartın üstünde yazar.');
}

// ---------------------------------------------------------- buton
let butonKapak;
{
  const g = new THREE.Group();
  g.add(kutu(2.6, 1.2, 2.6, toon(0x2b2b2b), -9, 0.6, 0));
  g.add(kutu(2.6, 0.12, 2.6, toon(0xc7c9cc), -9, 1.26, 0));
  butonKapak = silindir(0.8, 1.0, toon(0xd93025), -9, 1.8, 0);
  g.add(butonKapak);
  for (const x of [-10, -8]) for (const z of [-1.45, 1.45]) g.add(kutu(0.3, 0.6, 0.35, toon(0xb8bcc2), x, 0.3, z, false));
  parca('buton', g, 'Panik butonu. Bacakları e22, e24, f22, f24 deliklerinde.');
}

// ---------------------------------------------------------- LED'ler
const ledler = {};
function led(ad, renk, s, aciklama) {
  const x = sutunX(s), za = SATIR_Z.j, zk = RAY_Z.eksi, zm = (za + zk) / 2;
  const g = new THREE.Group();
  const bacak = toon(0xb8bcc2);
  for (const z of [za, zk]) g.add(silindir(0.08, 2.2, bacak, x, 1.1, z, false, 6));
  g.add(kutu(0.16, 0.16, zk - za, bacak, x, 2.2, zm, false));
  const mat = toon(renk, { transparent: true, opacity: 0.9, emissive: renk, emissiveIntensity: 0 });
  g.add(silindir(1.1, 0.3, mat, x, 2.45, zm));
  g.add(silindir(1.0, 1.8, mat, x, 3.5, zm));
  const kubbe = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  kubbe.position.set(x, 4.4, zm);
  g.add(kubbe);
  const hale = new THREE.Sprite(new THREE.SpriteMaterial({ map: haleDokusu, color: renk, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  hale.scale.set(9, 9, 1);
  hale.position.set(x, 3.8, zm);
  g.add(hale);
  const isik = new THREE.PointLight(renk, 0, 9, 2);
  isik.position.set(x, 4, zm);
  g.add(isik);
  ledler[ad] = { mat, hale, isik, acik: null };
  return parca(ad, g, aciklama);
}
const haleDokusu = tuval(1, 1, 128, (c, P) => {
  const gr = c.createRadialGradient(P / 2, P / 2, 0, P / 2, P / 2, P / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gr; c.fillRect(0, 0, P, P);
});
led('led_yesil', 0x2fd15a, 34, 'Yeşil LED (Wi-Fi durumu). Uzun bacak j34, kısa bacak (−) hat.');
led('led_sari', 0xffc21a, 44, 'Sarı LED (panik gönderiliyor). Uzun bacak j44, kısa bacak (−) hat.');

function ledYak(ad, acik) {
  const l = ledler[ad];
  if (!l || l.acik === acik) return;
  l.acik = acik;
  l.mat.emissiveIntensity = acik ? 1.4 : 0;
  l.hale.material.opacity = acik ? 0.85 : 0;
  l.isik.intensity = acik ? 14 : 0;
}

// ---------------------------------------------------------- dirençler (220Ω: kırmızı-kırmızı-kahverengi-altın)
function direnc(ad, s1, s2, satir, aciklama) {
  const x1 = sutunX(s1), x2 = sutunX(s2), z = SATIR_Z[satir], xm = (x1 + x2) / 2, y = 1.3;
  const g = new THREE.Group();
  const govde = silindir(0.42, 2.2, toon(0xd8c39a), xm, y, z, true, 16);
  govde.rotation.z = Math.PI / 2;
  g.add(govde);
  [[-0.7, 0xc0392b], [-0.38, 0xc0392b], [-0.06, 0x7a4a1c], [0.7, 0xc9a24a]].forEach(([dx, renk]) => {
    const b = silindir(0.45, 0.18, toon(renk), xm + dx, y, z, false, 16);
    b.rotation.z = Math.PI / 2;
    g.add(b);
  });
  const yol = new THREE.CurvePath();
  yol.add(new THREE.LineCurve3(new V3(x1, 0, z), new V3(x1, y, z)));
  yol.add(new THREE.LineCurve3(new V3(x1, y, z), new V3(x2, y, z)));
  yol.add(new THREE.LineCurve3(new V3(x2, y, z), new V3(x2, 0, z)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(yol, 30, 0.08, 6), toon(0xb8bcc2)));
  return parca(ad, g, aciklama);
}
direnc('r_yesil', 30, 34, 'h', '220Ω direnç (kırmızı-kırmızı-kahverengi): h30 → h34');
direnc('r_sari', 40, 44, 'h', '220Ω direnç (kırmızı-kırmızı-kahverengi): h40 → h44');

// ---------------------------------------------------------- aktif buzzer modülü (pinler g52, g53, g54)
let buzzerGrup;
{
  const g = new THREE.Group();
  g.add(kutu(3, 0.9, 1, toon(0x1c1c1c), 21, 0.45, SATIR_Z.g));
  const doku = tuval(3.6, 6.4, 64, (c, P) => {
    const X = x => (x - 19.2) * P, Z = z => (z + 3.4) * P;
    c.fillStyle = '#1d4fa3'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${0.36 * P}px Consolas, monospace`;
    ['I/O', 'VCC', 'GND'].forEach((t, i) => {
      c.fillStyle = '#d6b25e'; c.beginPath(); c.arc(X(20 + i), Z(2.5), 0.32 * P, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.fillText(t, X(20 + i), Z(1.75));
    });
  });
  g.add(kutu(3.6, 0.25, 6.4, ustDokulu(doku, toon(0x1d4fa3)), 21, 1.02, -0.2));
  for (let i = 0; i < 3; i++) g.add(kutu(0.3, 0.4, 0.3, toon(0xd6b25e), 20 + i, 1.3, SATIR_Z.g, false));
  g.add(silindir(1.3, 1.4, toon(0x1a1a1a), 21, 1.85, -1.4, true, 32));
  g.add(silindir(0.35, 0.05, toon(0xeeeeee), 21, 2.57, -1.4, false));
  g.add(kutu(0.8, 0.4, 0.6, toon(0x222222), 20.1, 1.35, 0.6, false));
  buzzerGrup = parca('buzzer', g, 'Aktif buzzer modülü: I/O → D23, VCC → (+) hat, GND → (−) hat.');
}

// ---------------------------------------------------------- GPS modülü (setinde yok - isteğe bağlı)
const GPS_PIN = { VCC: new V3(-23.5, -2.35, 13.3), RX: new V3(-22.5, -2.35, 13.3), TX: new V3(-21.5, -2.35, 13.3), GND: new V3(-20.5, -2.35, 13.3) };
{
  const g = new THREE.Group();
  const doku = tuval(6.2, 4.2, 64, (c, P) => {
    const X = x => (x + 25.1) * P, Z = z => (z - 12.9) * P;
    c.fillStyle = '#2357b0'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${0.36 * P}px Consolas, monospace`;
    Object.entries(GPS_PIN).forEach(([ad, p]) => {
      c.fillStyle = '#d6b25e'; c.beginPath(); c.arc(X(p.x), Z(13.3), 0.3 * P, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.fillText(ad, X(p.x), Z(13.95));
    });
    c.font = `700 ${0.42 * P}px sans-serif`; c.fillText('GPS NEO-6M', X(-22), Z(16.6));
  });
  g.add(kutu(6.2, 0.3, 4.2, ustDokulu(doku, toon(0x2357b0)), -22, -2.75, 15));
  g.add(kutu(2.4, 0.5, 2.4, toon(0xc4c8cd), -22, -2.35, 15.3));
  for (const p of Object.values(GPS_PIN)) g.add(kutu(0.3, 0.5, 0.3, toon(0xd6b25e), p.x, p.y, p.z, false));
  g.add(kutu(3.4, 0.9, 3.4, toon(0xc9a66b), -14, -2.55, 16));
  g.add(silindir(0.5, 0.1, toon(0xd6b25e), -14, -2.05, 16, false));
  const anten = new THREE.CatmullRomCurve3([new V3(-14, -2.0, 16), new V3(-16, -1.6, 17.2), new V3(-19.5, -2.3, 16.4)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(anten, 20, 0.1, 6), toon(0x333333)));
  parca('gps', g, 'GPS modülü (GY-NEO6MV2). Setinde YOK, ayrıca alınması gerekir.');
}

// ---------------------------------------------------------- kablolar
const kablolar = {};
function kablo(ad, a, b, renk, h, aciklama) {
  const ust = Math.max(a.y, b.y) + h;
  const orta = a.clone().lerp(b, 0.5); orta.y = ust;
  const egri = new THREE.CatmullRomCurve3([
    a.clone(), a.clone().setY(a.y + 1.3), orta, b.clone().setY(b.y + 1.3), b.clone(),
  ], false, 'centripetal');
  const SEG = 80, RAD = 8;
  const geo = new THREE.TubeGeometry(egri, SEG, 0.3, RAD);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, toon(renk)));
  for (const p of [a, b]) g.add(kutu(0.6, 1.3, 0.6, toon(0x1c1c1c), p.x, p.y + 0.65, p.z, false));
  kablolar[ad] = { geo, toplam: geo.index.count, SEG, RAD };
  return parca(ad, g, aciklama);
}
const K = { siyah: 0x262626, kirmizi: 0xd8352a, sari: 0xf2c230, yesil: 0x2fa84f, turuncu: 0xf28a1e, mavi: 0x2f6fd6, beyaz: 0xeeeeee, mor: 0x8a4fd6 };
kablo('w_gnd', delik(3, 'j'), ray(3, 'eksi'), K.siyah, 3, 'Siyah kablo: j3 (GND) → (−) hat');
kablo('w_3v3', delik(2, 'j'), ray(2, 'arti'), K.kirmizi, 4, 'Kırmızı kablo: j2 (3V3) → (+) hat');
kablo('w_d4', delik(6, 'j'), delik(22, 'j'), K.sari, 5, 'Sarı kablo: j6 (D4) → j22 (buton)');
kablo('w_bgnd', delik(24, 'j'), ray(24, 'eksi'), K.siyah, 3, 'Siyah kablo: j24 (buton) → (−) hat');
kablo('w_d18', delik(10, 'j'), delik(30, 'j'), K.yesil, 6.5, 'Yeşil kablo: j10 (D18) → j30');
kablo('w_d19', delik(11, 'j'), delik(40, 'j'), K.turuncu, 8, 'Turuncu kablo: j11 (D19) → j40');
kablo('w_d23', delik(16, 'j'), delik(52, 'j'), K.mavi, 9.5, 'Mavi kablo: j16 (D23) → j52 (buzzer I/O)');
kablo('w_bvcc', ray(53, 'arti'), delik(53, 'j'), K.kirmizi, 4, 'Kırmızı kablo: (+) hat → j53 (buzzer VCC)');
kablo('w_bgnd2', delik(54, 'j'), ray(54, 'eksi'), K.siyah, 3, 'Siyah kablo: j54 (buzzer GND) → (−) hat');
kablo('w_gvcc', GPS_PIN.VCC, ray(12, 'arti'), K.kirmizi, 3, 'GPS VCC → (+) hat');
kablo('w_ggnd', GPS_PIN.GND, ray(14, 'eksi'), K.siyah, 3, 'GPS GND → (−) hat');
kablo('w_gtx', GPS_PIN.TX, delik(7, 'j'), K.beyaz, 4.5, 'GPS TX → j7 (RX2 / GPIO16)');
kablo('w_grx', GPS_PIN.RX, delik(8, 'j'), K.mor, 5.5, 'GPS RX → j8 (TX2 / GPIO17)');

sahne.traverse(o => { if (o.isMesh && o !== zemin) { o.castShadow = true; o.receiveShadow = true; } });
for (const l of Object.values(ledler)) l.hale.castShadow = false;

// ============================================================ adımlar
const sw = renk => `<span class="kablo" style="background:#${renk.toString(16).padStart(6, '0')}"></span>`;
const HEPSI = ['esp', 'w_gnd', 'w_3v3', 'buton', 'w_d4', 'w_bgnd', 'w_d18', 'r_yesil', 'led_yesil', 'w_d19', 'r_sari', 'led_sari', 'buzzer', 'w_d23', 'w_bvcc', 'w_bgnd2'];

const ADIMLAR = [
  {
    baslik: 'Ne yapıyoruz?', hepsi: true, kamera: [0, 52, 60, 0, 0, 2, 72],
    html: `
      <p>Arabaya takılacak bir <b>panik butonu</b>. Butona basınca ESP32, Wi-Fi üzerinden bilgisayarındaki panele <b>plaka + konum</b> gönderir; panelde alarm çalar ve harita araca odaklanır. Butona basılmasa da her 5 saniyede bir konum gönderir, böylece aracı panelden canlı izlersin.</p>
      <ul>
        <li><b>Yeşil LED</b>: Wi-Fi bağlı. Yanıp sönüyorsa bağlanmaya çalışıyor.</li>
        <li><b>Sarı LED</b>: panik gönderiliyor. Uzun süre yanıp sönüyorsa sunucuya ulaşamıyor, 2 sn'de bir tekrar deniyor.</li>
        <li><b>Buzzer</b>: 1 bip = butona basıldı, 2 bip = panik panele ulaştı.</li>
      </ul>
      <table class="parca">
        <tr><td>ESP32 geliştirme kartı</td><td>1</td></tr>
        <tr><td>830 delikli breadboard</td><td>1</td></tr>
        <tr><td>Buton</td><td>1</td></tr>
        <tr><td>Yeşil LED, sarı LED</td><td>1 + 1</td></tr>
        <tr><td>220Ω direnç (kırmızı-kırmızı-kahverengi)</td><td>2</td></tr>
        <tr><td>Aktif buzzer modülü</td><td>1</td></tr>
        <tr><td>Erkek-erkek kablo</td><td>9</td></tr>
        <tr><td>Micro USB kablo</td><td>1</td></tr>
      </table>
      <div class="uyari">Setinde <b>GPS modülü yok</b>. Şimdilik kodda yazdığın sabit bir konum gönderilir. Gerçek konum için 8. adımdaki GPS modülü gerekiyor.</div>
      <p class="not">Sahnede bitmiş hâlini görüyorsun. Parçaların üstüne gelince ne olduklarını yazar.</p>`,
  },
  {
    baslik: "ESP32'yi breadboard'a tak", ekle: ['esp'], kamera: [-21, 26, 34, -21, 0, 2, 40],
    isaretler: [[delik(6, 'j'), 'j6 = D4'], [delik(3, 'j'), 'j3 = GND'], [new V3(-33.6, 2.6, 0), 'USB']],
    html: `
      <p>Kartı breadboard'un sol ucuna, <b>ortadaki oluğun iki yanına</b> basacak şekilde tak. USB girişi sola baksın.</p>
      <p>Kartın üstünde <code>D4</code>, <code>D18</code>, <code>D19</code>, <code>D23</code> yazan pin sırası <b>sana yakın tarafta</b> olsun.</p>
      <div class="uyari">ESP32 geniş bir kart, breadboard'un sadece bir tarafında tek sıra boş delik kalır. Kabloları o boş sıraya (çizimde <b>j</b> sırası) takacağız, bu yüzden boş sıra D4'lü tarafın önünde kalmalı.</div>
      <p><b>Breadboard kuralı:</b> aynı numaralı sütunda <b>f-g-h-i-j</b> delikleri içeriden birbirine bağlıdır (a–e de kendi aralarında). Yani D4 pini 6. sütundaysa, <code>j6</code>'ya taktığın kablo D4'e bağlanmış olur.</p>
      <p>Pinleri eşit bastırarak oturt, eğri girmesin.</p>
      <p class="not">Senin kartın 38 pinliyse sütun numaraları kayar. O zaman numaralara değil, kartın üstündeki yazılara göre git ("D4'ün önündeki boş delik" gibi).</p>`,
  },
  {
    baslik: 'Güç hatları', ekle: ['w_gnd', 'w_3v3'], kamera: [-26, 17, 25, -27, 0, 5, 18],
    isaretler: [[delik(3, 'j'), 'j3'], [delik(2, 'j'), 'j2'], [ray(3, 'eksi'), '− hat'], [ray(2, 'arti'), '+ hat']],
    html: `
      <p>Breadboard'un uzun kenarındaki hatlar boydan boya bağlıdır. Mavi çizgili <b>(−) hattı GND</b>, kırmızı çizgili <b>(+) hattı 3.3V</b> yapacağız.</p>
      <ol>
        <li>${sw(K.siyah)}<b>Siyah kablo:</b> <code>j3</code> (GND'nin önü) → mavi <b>(−)</b> hat</li>
        <li>${sw(K.kirmizi)}<b>Kırmızı kablo:</b> <code>j2</code> (3V3'ün önü) → kırmızı <b>(+)</b> hat</li>
      </ol>
      <div class="uyari">Kartın diğer tarafındaki <code>VIN</code> pinini kullanma. O 5V'tur, bu devrede gerek yok.</div>
      <p class="not">Bazı 830'luk breadboard'larda kenar hatları ortadan ikiye bölünür (renkli çizgide boşluk olur). Seninkinde öyleyse iki yarıyı kısa bir kabloyla birleştir.</p>`,
  },
  {
    baslik: 'Panik butonu', ekle: ['buton', 'w_d4', 'w_bgnd'], kamera: [-16, 24, 30, -16, 0, 2, 34],
    isaretler: [[delik(6, 'j'), 'j6 (D4)'], [delik(22, 'j'), 'j22'], [delik(24, 'j'), 'j24'], [ray(24, 'eksi'), '− hat']],
    html: `
      <ol>
        <li>Butonu ortadaki oluğun üstüne tak: bacakları <code>e22</code>, <code>e24</code>, <code>f22</code>, <code>f24</code> deliklerine girsin.</li>
        <li>${sw(K.sari)}<b>Sarı kablo:</b> <code>j6</code> (D4) → <code>j22</code></li>
        <li>${sw(K.siyah)}<b>Siyah kablo:</b> <code>j24</code> → mavi <b>(−)</b> hat</li>
      </ol>
      <p><b>Nasıl çalışır?</b> Kod D4'ü içeriden "pull-up" ile HIGH tutar. Butona basınca D4 GND'ye bağlanır ve LOW olur. ESP32 bu düşüşü <b>kesme (interrupt)</b> ile anında yakalar; kod o an başka bir işle meşgul olsa bile basış kaybolmaz.</p>
      <p class="not">Buton sadece bir yönde rahat oturur. Test sırasında basınca seri monitörde "PANIK!" yazmıyorsa butonu 90° çevirip tekrar tak.</p>`,
  },
  {
    baslik: 'Yeşil LED: Wi-Fi durumu', ekle: ['w_d18', 'r_yesil', 'led_yesil'], kamera: [-6, 25, 31, -6, 0, 3, 42],
    isaretler: [[delik(10, 'j'), 'j10 (D18)'], [delik(30, 'j'), 'j30'], [new V3(2, 5.6, 6.5), 'uzun bacak j34']],
    html: `
      <ol>
        <li>${sw(K.yesil)}<b>Yeşil kablo:</b> <code>j10</code> (D18) → <code>j30</code></li>
        <li><b>220Ω direnç</b> (bantlar: kırmızı-kırmızı-kahverengi): <code>h30</code> → <code>h34</code></li>
        <li><b>Yeşil LED:</b> <b>uzun bacak (+)</b> <code>j34</code>'e, <b>kısa bacak (−)</b> mavi (−) hatta</li>
      </ol>
      <p>Akımın yolu: D18 → kablo → direnç → LED → GND. Direnç akımı sınırlar. <b>Direnç olmadan LED bağlama</b>, hem LED hem pin zarar görebilir.</p>
      <p class="not">LED ters takılırsa yanmaz ama bozulmaz; çevirip takman yeter. Kısa bacak tarafında LED'in kenarı düzdür.</p>`,
  },
  {
    baslik: 'Sarı LED: gönderim durumu', ekle: ['w_d19', 'r_sari', 'led_sari'], kamera: [0, 27, 33, 0, 0, 3, 50],
    isaretler: [[delik(11, 'j'), 'j11 (D19)'], [delik(40, 'j'), 'j40'], [new V3(12, 5.6, 6.5), 'uzun bacak j44']],
    html: `
      <ol>
        <li>${sw(K.turuncu)}<b>Turuncu kablo:</b> <code>j11</code> (D19) → <code>j40</code></li>
        <li><b>220Ω direnç:</b> <code>h40</code> → <code>h44</code></li>
        <li><b>Sarı LED:</b> uzun bacak <code>j44</code>'e, kısa bacak mavi (−) hatta</li>
      </ol>
      <p>Butona basınca bu LED hızlı yanıp söner, yani "panik gönderiliyor". Sunucuya ulaşınca söner. Ulaşamazsa yanıp sönmeye devam eder ve kod 2 saniyede bir yeniden dener.</p>`,
  },
  {
    baslik: 'Buzzer', ekle: ['buzzer', 'w_d23', 'w_bvcc', 'w_bgnd2'], kamera: [4, 32, 38, 4, 0, 2, 64],
    isaretler: [[delik(16, 'j'), 'j16 (D23)'], [new V3(20, 1.6, 2.5), 'I/O'], [new V3(21, 1.6, 2.5), 'VCC'], [new V3(22, 1.6, 2.5), 'GND']],
    html: `
      <p><b>Aktif</b> buzzer modülünü kullan. Aktif buzzer güç verince kendi kendine öter; pasif buzzer ötmez, ona ayrıca sinyal gerekir. Emin değilsen sonra test ederiz.</p>
      <ol>
        <li>Modülü <code>g52</code>, <code>g53</code>, <code>g54</code> deliklerine tak. Çizimde pinler soldan sağa <b>I/O · VCC · GND</b>. Kabloları <b>kendi modülünün üstünde yazan sıraya göre</b> tak; bazılarında <code>S</code>, <code>+</code>, <code>−</code> yazar.</li>
        <li>${sw(K.mavi)}<b>Mavi kablo:</b> <code>j16</code> (D23) → <code>j52</code> (I/O)</li>
        <li>${sw(K.kirmizi)}<b>Kırmızı kablo:</b> kırmızı <b>(+)</b> hat → <code>j53</code> (VCC)</li>
        <li>${sw(K.siyah)}<b>Siyah kablo:</b> <code>j54</code> (GND) → mavi <b>(−)</b> hat</li>
      </ol>
      <p class="not">Modülün pinleri breadboard'a girmiyorsa dişi-erkek kablolarla bağla; bağlantılar aynı kalır.</p>`,
  },
  {
    baslik: '(İsteğe bağlı) GPS modülü', ekle: ['gps', 'w_gvcc', 'w_ggnd', 'w_gtx', 'w_grx'], gecici: true, kamera: [-20, 30, 44, -18, -1, 7, 46],
    isaretler: [[delik(7, 'j'), 'j7 (RX2)'], [delik(8, 'j'), 'j8 (TX2)']],
    html: `
      <div class="uyari"><b>Bu parça setinde yok.</b> Gerçek konum için <b>GY-NEO6MV2 (NEO-6M) GPS modülü</b> gerekiyor. Almadan da devam edebilirsin; sistem sabit konumla çalışır.</div>
      <ol>
        <li>${sw(K.kirmizi)}GPS <b>VCC</b> → kırmızı (+) hat</li>
        <li>${sw(K.siyah)}GPS <b>GND</b> → mavi (−) hat</li>
        <li>${sw(K.beyaz)}GPS <b>TX</b> → <code>j7</code> (RX2 / GPIO16)</li>
        <li>${sw(K.mor)}GPS <b>RX</b> → <code>j8</code> (TX2 / GPIO17)</li>
      </ol>
      <p>TX ile RX <b>çapraz</b> bağlanır: birinin "konuşan" ucu diğerinin "dinleyen" ucuna gider. Modülün pinleri için dişi-erkek kablo kullan.</p>
      <p>Kodda <code>#define GPS_VAR 1</code> yap ve Arduino IDE'de Kütüphane Yöneticisi'nden <b>TinyGPSPlus</b>'ı kur.</p>
      <p class="not">GPS uyduları ilk açılışta açık havada 1–5 dakikada bulur, kapalı alanda çoğu zaman bulamaz. Bulana kadar panele "konum yok" gider ama panik yine de iletilir.</p>`,
  },
  {
    baslik: 'Kodu yükle', ekle: [], kamera: [-14, 34, 42, -12, 0, 2, 52],
    html: `
      <ol>
        <li><b>Arduino IDE 2</b>'yi kur (arduino.cc).</li>
        <li><b>Dosya → Tercihler → Ek kart yöneticisi URL'leri</b> kutusuna şunu yapıştır:<br><code>https://espressif.github.io/arduino-esp32/package_esp32_index.json</code></li>
        <li><b>Araçlar → Kart → Kart Yöneticisi</b>'nde "esp32" ara, <b>Espressif Systems</b>'inkini kur.</li>
        <li>Bilgisayarda sunucuyu başlat: <code>sunucu</code> klasöründe <code>npm start</code>. Ekrana yazdığı <code>SUNUCU = "http://192.168…"</code> satırını kopyala.</li>
        <li><code>firmware/panik_buton/panik_buton.ino</code> dosyasını aç. En üstteki <b>AYARLAR</b> kısmını doldur: Wi-Fi adı ve şifresi, <code>SUNUCU</code>, <code>PLAKA</code>.</li>
        <li><b>Araçlar → Kart: "ESP32 Dev Module"</b>, Port: kartın COM portu. <b>Yükle</b>'ye bas.</li>
        <li><b>Araçlar → Seri Monitör</b>'ü 115200 baud ile aç.</li>
      </ol>
      <div class="uyari"><b>Sık takılınan yerler</b><br>
        • ESP32 sadece <b>2.4 GHz</b> Wi-Fi'ye bağlanır, 5 GHz ağı görmez.<br>
        • Bilgisayar ile ESP32 <b>aynı ağda</b> olmalı. Windows, Node için güvenlik duvarı izni sorarsa <b>Özel ağlar</b>'a izin ver.<br>
        • Port görünmüyorsa kartın USB çipinin sürücüsünü kur (<b>CP210x</b> ya da <b>CH340</b>, çipin üstünde yazar). Bazı USB kabloları sadece şarj eder, veri taşımaz.<br>
        • Yüklerken "Connecting…" yazısında takılırsa kartın <b>BOOT</b> tuşuna basılı tut.<br>
        • Buzzer sürekli ötüyorsa ya da hiç ötmüyorsa koddaki <code>BUZZER_ACIK</code> değerini <code>LOW</code> yap.</div>`,
  },
  {
    baslik: 'Çalıştır', ekle: [], calistir: true, kamera: [0, 40, 46, 0, 0, 2, 72],
    html: `<p>Kod çalışırken ne olduğunu burada görebilirsin. 3D'deki <b>kırmızı butona tıkla</b> ya da aşağıdaki düğmeyi kullan. O an çalışan kod satırı turuncu ile işaretlenir.</p>`,
  },
];

// ============================================================ kod paneli + seri monitör (Çalıştır adımı)
const KOD = [
  ['isr', 'void IRAM_ATTR butonKesmesi() {   // basıldığı an'],
  ['isr', '  butonaBasildi = true;'],
  ['isr', '}'],
  ['', ''],
  ['', 'void loop() {'],
  ['wifi', '  bool bagli = WiFi.status() == WL_CONNECTED;'],
  ['wifi', '  digitalWrite(YESIL_LED, bagli ? HIGH : yanSon);'],
  ['', ''],
  ['basildi', '  if (butonaBasildi) {'],
  ['basildi', '    butonaBasildi = false;'],
  ['basildi', '    bekleyenPanik = true;'],
  ['basildi', '    bip(1);'],
  ['basildi', '  }'],
  ['', ''],
  ['panik', '  if (bekleyenPanik) {'],
  ['panik', '    digitalWrite(SARI_LED, yanSon);   // 2 sn arayla'],
  ['gonder', '    int kod = gonder("/api/panik");'],
  ['tamam', '    if (kod == 200) {'],
  ['tamam', '      bekleyenPanik = false;'],
  ['tamam', '      bip(2);'],
  ['tamam', '    }'],
  ['panik', '  }'],
  ['', ''],
  ['konum', '  if (millis() - sonKonum >= 5000) {   // canlı konum'],
  ['konum', '    gonder("/api/konum");'],
  ['konum', '  }'],
  ['', '}'],
];

const kacis = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function kodHtml() {
  return KOD.map(([id, t]) => {
    const i = t.indexOf('//');
    const govde = i >= 0 ? kacis(t.slice(0, i)) + `<span class="yorum">${kacis(t.slice(i))}</span>` : kacis(t);
    return `<div class="satir" data-id="${id}">${govde || ' '}</div>`;
  }).join('');
}

let vurguZamani = null;
function vurgula(...idler) {
  for (const el of document.querySelectorAll('#kod .satir')) el.classList.toggle('aktif', idler.includes(el.dataset.id));
  clearTimeout(vurguZamani);
  vurguZamani = setTimeout(() => { for (const el of document.querySelectorAll('#kod .satir.aktif')) el.classList.remove('aktif'); }, 1100);
}

function yaz(metin, sinif = '') {
  const s = $('#seri');
  if (!s) return;
  const d = document.createElement('div');
  if (sinif) d.className = sinif;
  d.textContent = metin;
  s.append(d);
  while (s.childElementCount > 200) s.firstElementChild.remove();
  s.scrollTop = s.scrollHeight;
}

// ---------------------------------------------------------- ses
let ses = null;
function sesHazirla() {
  try { ses ??= new AudioContext(); ses.resume(); } catch { /* ses yok */ }
}
let buzzerBitis = 0;
function bip(adet) {
  for (let i = 0; i < adet; i++) {
    setTimeout(() => {
      buzzerBitis = performance.now() + 120;
      if (!ses) return;
      const o = ses.createOscillator(), g = ses.createGain();
      o.type = 'square'; o.frequency.value = 2300;
      g.gain.value = 0.03;
      o.connect(g).connect(ses.destination);
      o.start(); o.stop(ses.currentTime + 0.12);
    }, i * 220);
  }
}

// ---------------------------------------------------------- simülasyon (firmware'deki loop() ile aynı mantık)
const sim = { calisiyor: false };
function simBaslat() {
  const t = performance.now();
  Object.assign(sim, {
    calisiyor: true, wifiAcik: true, bagliZaman: t + 1800, bagli: false, basildi: false,
    bekleyen: false, sonDeneme: 0, sonKonum: t - 2500, istek: null,
  });
  yaz('--- ESP32 acildi ---', 'baslik');
  yaz('Plaka: 34 ABC 123');
  yaz("Wi-Fi'ye baglaniliyor: EvWifi");
}
function simDurdur() {
  sim.calisiyor = false;
  ledYak('led_yesil', false);
  ledYak('led_sari', false);
}
function simAdim(t) {
  if (!sim.calisiyor) return;
  const bagli = sim.wifiAcik && t >= sim.bagliZaman;
  if (bagli !== sim.bagli) {
    sim.bagli = bagli;
    yaz(bagli ? 'Wi-Fi baglandi, IP: 192.168.1.42' : 'Wi-Fi koptu, tekrar baglaniliyor...', bagli ? '' : 'kirmizi');
    vurgula('wifi');
  }
  ledYak('led_yesil', bagli || Math.floor(t / 250) % 2 === 1);

  if (sim.basildi) {
    sim.basildi = false;
    yaz('PANIK! Butona basildi.', 'kirmizi');
    sim.bekleyen = true;
    sim.sonDeneme = 0;
    bip(1);
    vurgula('isr', 'basildi');
  }

  if (sim.istek && t >= sim.istek.bitis) {
    const { yol, bagliydi } = sim.istek;
    sim.istek = null;
    if (bagliydi && sim.bagli) {
      yaz(`POST ${yol} -> 200`);
      if (yol === '/api/panik') { sim.bekleyen = false; bip(2); vurgula('tamam'); }
    } else {
      yaz(`POST ${yol} -> Wi-Fi yok`, 'kirmizi');
      if (yol === '/api/panik') yaz('Gonderilemedi, 2 sn sonra tekrar denenecek.', 'kirmizi');
    }
  }

  if (sim.bekleyen) {
    ledYak('led_sari', Math.floor(t / 150) % 2 === 1);
    if (!sim.istek && (sim.sonDeneme === 0 || t - sim.sonDeneme >= 2000)) {
      sim.sonDeneme = t;
      sim.istek = { yol: '/api/panik', bitis: t + (sim.bagli ? 700 : 60), bagliydi: sim.bagli };
      vurgula('panik', 'gonder');
    }
  } else {
    ledYak('led_sari', false);
  }

  if (!sim.bekleyen && !sim.istek && t - sim.sonKonum >= 5000) {
    sim.sonKonum = t;
    sim.istek = { yol: '/api/konum', bitis: t + (sim.bagli ? 350 : 60), bagliydi: sim.bagli };
    vurgula('konum');
  }
}

let basmaZamani = -1e9;
function butonaBas() {
  sesHazirla();
  basmaZamani = performance.now();
  if (sim.calisiyor) sim.basildi = true;
}

// ============================================================ adım gösterimi
let simdiki = -1;
const isaretGrubu = new THREE.Group();
sahne.add(isaretGrubu);
let etiketler = [];
const animasyonlar = [];

function gorunurler(i) {
  if (ADIMLAR[i].hepsi) return new Set(['bb', ...HEPSI]);
  const s = new Set(['bb']);
  for (let k = 1; k <= i; k++) {
    if (ADIMLAR[k].gecici && k !== i) continue;
    for (const ad of ADIMLAR[k].ekle) s.add(ad);
  }
  return s;
}

function adimGoster(i) {
  i = Math.max(0, Math.min(ADIMLAR.length - 1, i));
  if (i === simdiki) return;
  const ileriGidiyor = i > simdiki;
  const adim = ADIMLAR[i];
  simdiki = i;

  // parçalar
  const gor = gorunurler(i);
  for (const [ad, n] of Object.entries(parcalar)) n.visible = gor.has(ad);
  animasyonlar.length = 0;
  for (const ad of Object.values(parcalar)) { ad.position.y = 0; }
  for (const k of Object.values(kablolar)) k.geo.setDrawRange(0, Infinity);
  if (ileriGidiyor && adim.ekle) {
    adim.ekle.forEach((ad, sira) => animasyonlar.push({ ad, basla: performance.now() + sira * 350 }));
  }

  // işaretler
  isaretGrubu.clear();
  for (const e of etiketler) e.el.remove();
  etiketler = [];
  for (const [p, yazi] of adim.isaretler || []) {
    const halka = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.8, 32), new THREE.MeshBasicMaterial({ color: 0xe2561b, transparent: true, side: THREE.DoubleSide, depthTest: false }));
    halka.rotation.x = -Math.PI / 2;
    halka.position.copy(p).setY(p.y + 0.06);
    halka.renderOrder = 10;
    isaretGrubu.add(halka);
    const el = document.createElement('div');
    el.className = 'etiket';
    el.textContent = yazi;
    kap.append(el);
    etiketler.push({ el, p: p.clone().setY(p.y + 0.8) });
  }

  // LED'ler / simülasyon
  simDurdur();
  if (adim.hepsi) ledYak('led_yesil', true);

  // panel
  $('#adimNo').textContent = `Adım ${i + 1} / ${ADIMLAR.length}`;
  $('#baslik').textContent = adim.baslik;
  const icerik = $('#icerik');
  icerik.innerHTML = adim.html;
  if (adim.calistir) {
    icerik.insertAdjacentHTML('beforeend', `
      <div class="kontroller">
        <button class="panik" id="basBtn">🔴 Panik butonuna bas</button>
        <button id="wifiBtn">📶 Wi-Fi'yi kes</button>
        <button id="bastanBtn">↺ Baştan başlat</button>
      </div>
      <div id="kod">${kodHtml()}</div>
      <div id="seri"></div>
      <p class="not">Bu bir canlandırma, gerçek kart da aynı şekilde davranır. Gerçeğini denemek için <a href="../" target="_blank">Panik Paneli</a>'ni aç. Kartın hazır değilse <code>npm run sim</code> ile sahte araçlar gönderebilirsin.</p>`);
    $('#basBtn').onclick = butonaBas;
    $('#wifiBtn').onclick = () => {
      sesHazirla();
      sim.wifiAcik = !sim.wifiAcik;
      if (sim.wifiAcik) sim.bagliZaman = performance.now() + 1500;
      $('#wifiBtn').textContent = sim.wifiAcik ? "📶 Wi-Fi'yi kes" : "📶 Wi-Fi'yi geri getir";
    };
    $('#bastanBtn').onclick = () => { $('#seri').innerHTML = ''; simBaslat(); };
    simBaslat();
  }
  icerik.scrollTop = 0;

  // gezinme
  $('#geri').disabled = i === 0;
  $('#ileri').disabled = i === ADIMLAR.length - 1;
  $('#ileri').textContent = i === 0 ? 'Başla →' : 'İleri →';
  $('#noktalar').innerHTML = ADIMLAR.map((_, k) => `<span class="${k === i ? 'simdi' : k < i ? 'tamam' : ''}" data-k="${k}" title="${ADIMLAR[k].baslik}"></span>`).join('');
  for (const n of $('#noktalar').children) n.onclick = () => adimGoster(Number(n.dataset.k));

  kameraGit(adim.kamera);
  try { history.replaceState(null, '', '#' + (i + 1)); } catch { /* önemsiz */ }
}

$('#geri').onclick = () => { sesHazirla(); adimGoster(simdiki - 1); };
$('#ileri').onclick = () => { sesHazirla(); adimGoster(simdiki + 1); };
addEventListener('keydown', e => {
  if (e.target.closest('button, input, textarea')) return;
  if (e.key === 'ArrowRight') adimGoster(simdiki + 1);
  if (e.key === 'ArrowLeft') adimGoster(simdiki - 1);
});

// ============================================================ kamera geçişi
let gecis = null;
// k = [kamera x,y,z, hedef x,y,z, sığdırılacak genişlik]. Kamera, o genişlik ekrana sığacak uzaklığa konur.
function kameraGit(k) {
  const hedef = new V3(k[3], k[4], k[5]);
  const yon = new V3(k[0], k[1], k[2]).sub(hedef).normalize();
  const dikeyYarim = THREE.MathUtils.degToRad(kamera.fov) / 2;
  const yatayYarim = Math.atan(Math.tan(dikeyYarim) * kamera.aspect);
  const mesafe = Math.max((k[6] / 2) / Math.tan(yatayYarim), (k[6] * 0.24) / Math.tan(dikeyYarim)) * 1.08;
  gecis = { t0: performance.now(), p0: kamera.position.clone(), h0: kontrol.target.clone(), p1: hedef.clone().addScaledVector(yon, mesafe), h1: hedef };
}
kontrol.addEventListener('start', () => { gecis = null; });
addEventListener('hashchange', () => {
  const n = Number(location.hash.slice(1)) - 1;
  if (Number.isInteger(n)) adimGoster(n);
});

// ============================================================ fare: balon + butona tıklama
const isin = new THREE.Raycaster();
const fare = new THREE.Vector2();
const balon = $('#balon');
let basNokta = null;

function vurulan(e) {
  const r = renderer.domElement.getBoundingClientRect();
  fare.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  isin.setFromCamera(fare, kamera);
  const hedefler = Object.values(parcalar).filter(p => p.visible && p.userData.ad !== 'bb');
  hedefler.push(parcalar.bb);
  for (const h of isin.intersectObjects(hedefler, true)) {
    if (!h.object.isMesh) continue;
    let o = h.object;
    while (o && !o.userData.ad) o = o.parent;
    if (o) return o;
  }
  return null;
}
renderer.domElement.addEventListener('pointermove', e => {
  if (e.buttons) { balon.style.display = 'none'; return; }
  const o = vurulan(e);
  if (o) {
    const r = kap.getBoundingClientRect();
    balon.textContent = o.userData.aciklama;
    balon.style.left = (e.clientX - r.left) + 'px';
    balon.style.top = (e.clientY - r.top) + 'px';
    balon.style.display = 'block';
  } else balon.style.display = 'none';
  renderer.domElement.style.cursor = o && o.userData.ad === 'buton' && ADIMLAR[simdiki].calistir ? 'pointer' : '';
});
renderer.domElement.addEventListener('pointerleave', () => { balon.style.display = 'none'; });
renderer.domElement.addEventListener('pointerdown', e => { basNokta = [e.clientX, e.clientY]; sesHazirla(); });
renderer.domElement.addEventListener('pointerup', e => {
  if (!basNokta || Math.hypot(e.clientX - basNokta[0], e.clientY - basNokta[1]) > 5) return;
  const o = vurulan(e);
  if (o && o.userData.ad === 'buton') butonaBas();
});

// ============================================================ boyut + döngü
function boyutla() {
  const g = kap.clientWidth, y = kap.clientHeight;
  renderer.setSize(g, y, false);
  kamera.aspect = g / Math.max(1, y);
  kamera.updateProjectionMatrix();
}
new ResizeObserver(boyutla).observe(kap);
boyutla();

const yumusak = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const gecici = new V3();

function kare(t) {
  requestAnimationFrame(kare);

  if (gecis) {
    const p = Math.min(1, (t - gecis.t0) / 1000), e = yumusak(p);
    kamera.position.lerpVectors(gecis.p0, gecis.p1, e);
    kontrol.target.lerpVectors(gecis.h0, gecis.h1, e);
    if (p >= 1) gecis = null;
  }
  kontrol.update();

  // yeni parçalar: düşerek gelir, kablolar uçtan uca çizilir
  for (const a of animasyonlar) {
    const p = Math.max(0, Math.min(1, (t - a.basla) / 650)), e = yumusak(p);
    const k = kablolar[a.ad];
    if (k) {
      const seg = Math.floor(e * k.SEG);
      k.geo.setDrawRange(0, p >= 1 ? Infinity : seg * k.RAD * 6);
    } else {
      parcalar[a.ad].position.y = (1 - e) * 9;
    }
  }

  // buton basma
  const bp = (t - basmaZamani) / 180;
  butonKapak.position.y = 1.8 - (bp < 1 ? Math.sin(bp * Math.PI) * 0.35 : 0);

  // buzzer titreşimi
  buzzerGrup.position.x = t < buzzerBitis ? Math.sin(t * 0.9) * 0.08 : 0;

  simAdim(t);

  // işaret halkaları nabız
  const nabiz = 1 + 0.25 * Math.sin(t * 0.006);
  for (const h of isaretGrubu.children) { h.scale.setScalar(nabiz); h.material.opacity = 0.65 + 0.3 * Math.sin(t * 0.006); }

  // HTML etiketleri
  const g = kap.clientWidth, y = kap.clientHeight;
  for (const e of etiketler) {
    gecici.copy(e.p).project(kamera);
    const gizli = gecici.z > 1;
    e.el.classList.toggle('gizli', gizli);
    if (!gizli) {
      e.el.style.left = ((gecici.x + 1) / 2 * g) + 'px';
      e.el.style.top = ((1 - gecici.y) / 2 * y) + 'px';
    }
  }

  renderer.render(sahne, kamera);
}

$('#yukleniyor').remove();
const bas = Number(location.hash.slice(1)) - 1;
adimGoster(Number.isInteger(bas) && bas >= 0 ? bas : 0);
requestAnimationFrame(kare);
