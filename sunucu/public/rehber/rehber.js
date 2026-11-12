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
  kablolar[ad] = { geo, toplam: geo.index.count, SEG, RAD, egri };
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


// ---------------------------------------------------------- OLED ekran (masada, dişi-erkek kablolarla bağlı)
// Pinler ekranın üst kenarında: GND, VCC, SCL, SDA. Ekran içeriği canlı çizilir (oledCiz).
const OLED_PIN = {
  GND: new V3(22.5, -2.3, 11.3), VCC: new V3(23.5, -2.3, 11.3), SCL: new V3(24.5, -2.3, 11.3), SDA: new V3(25.5, -2.3, 11.3),
};
const oledTuval = document.createElement('canvas');
oledTuval.width = 512;
oledTuval.height = 256;
const oledDoku = new THREE.CanvasTexture(oledTuval);
oledDoku.colorSpace = THREE.SRGBColorSpace;
oledDoku.anisotropy = renderer.capabilities.getMaxAnisotropy();
{
  const g = new THREE.Group();
  const doku = tuval(10.6, 10.6, 48, (c, P) => {
    const X = x => (x - 18.7) * P, Z = z => (z - 10.7) * P;
    c.fillStyle = '#1b3a7a'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${0.4 * P}px Consolas, monospace`;
    Object.entries(OLED_PIN).forEach(([ad, p]) => {
      c.fillStyle = '#d6b25e'; c.beginPath(); c.arc(X(p.x), Z(11.3), 0.3 * P, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.fillText(ad, X(p.x), Z(12.15));
    });
    for (const [x, z] of [[19.4, 11.4], [28.6, 11.4], [19.4, 20.6], [28.6, 20.6]]) {
      c.fillStyle = '#c9a54a'; c.beginPath(); c.arc(X(x), Z(z), 0.45 * P, 0, 7); c.fill();
      c.fillStyle = '#0d1a33'; c.beginPath(); c.arc(X(x), Z(z), 0.25 * P, 0, 7); c.fill();
    }
  });
  g.add(kutu(10.6, 0.3, 10.6, ustDokulu(doku, toon(0x1b3a7a)), 24, -2.75, 16));
  g.add(kutu(10.0, 0.3, 6.6, toon(0x0b0b0b), 24, -2.45, 16.7));
  const ekran = new THREE.Mesh(new THREE.PlaneGeometry(8.8, 4.4), new THREE.MeshBasicMaterial({ map: oledDoku, toneMapped: false }));
  ekran.rotation.x = -Math.PI / 2;
  ekran.position.set(24, -2.29, 16.5);
  g.add(ekran);
  g.add(kutu(4.0, 0.2, 0.9, toon(0xc9a54a), 24, -2.55, 20.6, false));  // şerit kablo
  for (const p of Object.values(OLED_PIN)) g.add(kutu(0.3, 0.6, 0.3, toon(0xd6b25e), p.x, p.y, p.z, false));
  parca('oled', g, '0.96" OLED ekran (I2C, 128×64). GND → (−), VCC → (+), SCL → D22, SDA → D21.');
}
K.turkuaz = 0x1fb5b0;
K.pembe = 0xe0569b;
kablo('w_ognd', OLED_PIN.GND, ray(57, 'eksi'), K.siyah, 3, 'OLED GND → (−) hat (dişi-erkek kablo)');
kablo('w_ovcc', OLED_PIN.VCC, ray(58, 'arti'), K.kirmizi, 3.6, 'OLED VCC → (+) hat (dişi-erkek kablo)');
kablo('w_oscl', OLED_PIN.SCL, delik(15, 'j'), K.turkuaz, 7, 'OLED SCL → j15 (D22) (dişi-erkek kablo)');
kablo('w_osda', OLED_PIN.SDA, delik(12, 'j'), K.pembe, 8.5, 'OLED SDA → j12 (D21) (dişi-erkek kablo)');
for (const ad of ['oled', 'w_ognd', 'w_ovcc', 'w_oscl', 'w_osda']) {
  parcalar[ad].traverse(o => { if (o.isMesh && o.material.isMeshToonMaterial) { o.castShadow = true; o.receiveShadow = true; } });
}

// ============================================================ adımlar
const sw = renk => `<span class="kablo" style="background:#${renk.toString(16).padStart(6, '0')}"></span>`;
const HEPSI = ['esp', 'w_gnd', 'w_3v3', 'buton', 'w_d4', 'w_bgnd', 'w_d18', 'r_yesil', 'led_yesil', 'w_d19', 'r_sari', 'led_sari',
  'buzzer', 'w_d23', 'w_bvcc', 'w_bgnd2'];

const ADIMLAR = [
  {
    baslik: 'Ne yapıyoruz?', hepsi: true, kamera: [0, 52, 60, 0, -1, 5, 74],
    html: `
      <p>Arabaya takılacak bir <b>panik butonu</b>. Butona basınca ESP32, Wi-Fi üzerinden panele <b>plaka + konum</b> gönderir; panelde alarm çalar ve harita araca odaklanır. Her 5 saniyede bir konum da gider, yani araç panelden canlı izlenir.</p>
      <p><b>İki yönlü:</b> panel "Gördüm" deyince araçtaki sarı LED sürekli yanar ve buzzer özel bir bip çalar; sürücü yardımın yolda olduğunu anlar. Panel cihazı uzaktan da öttürebilir.</p>
      <ul>
        <li><b>Yeşil LED</b>: Wi-Fi bağlı. Yanıp sönüyorsa bağlanmaya çalışıyor.</li>
        <li><b>Sarı LED</b>: hızlı = gönderiliyor, yavaş = panel bekleniyor, sürekli = yardım geliyor.</li>
        <li><b>Buzzer</b>: basıldı, iletildi, panel gördü ve mesaj geldi için ayrı sesler.</li>
        <li><b>Yanlış alarm</b>: butonu 3 saniye basılı tut, iptal olur.</li>
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
      <div class="uyari">Setinde <b>GPS modülü yok</b>. Şimdilik sabit bir konum gönderilir. Gerçek konum için "GPS modülü" adımındaki parça gerekiyor.</div>
      <p><b>Sıra:</b> önce parçaları sahnede tek tek tanıyacağız (ne işe yarıyor, elektrik içinden nasıl akıyor), sonra devreyi adım adım kuracağız.</p>
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
      <p>Aynı buton iki iş daha yapar: panik sırasında <b>3 sn basılı tutmak iptal</b> eder; kartı açarken basılı tutmak <b>kurulum modunu</b> açar.</p>
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
    baslik: 'Sarı LED: panik durumu', ekle: ['w_d19', 'r_sari', 'led_sari'], kamera: [0, 27, 33, 0, 0, 3, 50],
    isaretler: [[delik(11, 'j'), 'j11 (D19)'], [delik(40, 'j'), 'j40'], [new V3(12, 5.6, 6.5), 'uzun bacak j44']],
    html: `
      <ol>
        <li>${sw(K.turuncu)}<b>Turuncu kablo:</b> <code>j11</code> (D19) → <code>j40</code></li>
        <li><b>220Ω direnç:</b> <code>h40</code> → <code>h44</code></li>
        <li><b>Sarı LED:</b> uzun bacak <code>j44</code>'e, kısa bacak mavi (−) hatta</li>
      </ol>
      <p>Bu LED panik durumunu gösterir: <b>hızlı</b> yanıp sönerse panik gönderiliyor (sunucuya ulaşamazsa 2 sn'de bir tekrar dener), <b>yavaş</b> yanıp sönerse panik iletildi ve panel bekleniyor, <b>sürekli</b> yanarsa panel gördü, yardım geliyor.</p>`,
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
      <p>Kodda <code>#define GPS_VAR 1</code> yap ve Arduino IDE'de Kütüphane Yöneticisi'nden <b>TinyGPSPlus</b>'ı kur. GPS hızı da panele gider.</p>
      <p class="not">GPS uyduları ilk açılışta açık havada 1–5 dakikada bulur, kapalı alanda çoğu zaman bulamaz. Bulana kadar panele "konum yok" gider ama panik yine de iletilir.</p>`,
  },
  {
    baslik: 'Kodu yükle ve kur', ekle: [], kamera: [-6, 34, 46, -4, -1, 5, 62],
    html: `
      <ol>
        <li><b>Arduino IDE 2</b>'yi kur (arduino.cc).</li>
        <li><b>Dosya → Tercihler → Ek kart yöneticisi URL'leri</b> kutusuna şunu yapıştır:<br><code>https://espressif.github.io/arduino-esp32/package_esp32_index.json</code></li>
        <li><b>Araçlar → Kart → Kart Yöneticisi</b>'nde "esp32" ara, <b>Espressif Systems</b>'inkini kur.</li>
        <li><code>firmware/panik_buton/panik_buton.ino</code> dosyasını aç. <b>Araçlar → Kart: "ESP32 Dev Module"</b>, Port: kartın COM portu. <b>Yükle</b>'ye bas. Kodda bir şey değiştirmen gerekmiyor.</li>
        <li>Bilgisayarda sunucuyu başlat: <code>sunucu</code> klasöründe <code>npm start</code>. Ekrana yazdığı <code>http://192.168…:3000</code> adresini not et.</li>
      </ol>
      <p><b>Kurulum modu (ilk açılış):</b> Ayar girilmemişse sarı ve yeşil LED sırayla yanıp söner; cihaz kurulum modundadır. Ağın tam adı seri monitörde de yazar.</p>
      <ol>
        <li>Telefonun Wi-Fi ayarlarından <code>PANIK-xxxx</code> ağına bağlan. "İnternet yok" derse bağlı kal.</li>
        <li>Kurulum sayfası kendiliğinden açılır. Açılmazsa tarayıcıda <code>192.168.4.1</code> adresine git.</li>
        <li>Wi-Fi adı ve şifresini, sunucu adresini ve plakayı yaz, <b>Kaydet</b>'e bas. Cihaz yeniden başlar ve bağlanır.</li>
      </ol>
      <p>Ayarları sonra değiştirmek için butona basılı tutarken kartın <b>EN</b> tuşuna bas, butonu 2 sn daha bırakma. Araçta telefonun erişim noktasına geçerken işine yarar.</p>
      <div class="uyari"><b>Sık takılınan yerler</b><br>
        • ESP32 sadece <b>2.4 GHz</b> Wi-Fi'ye bağlanır, 5 GHz ağı görmez.<br>
        • Bilgisayar ile ESP32 <b>aynı ağda</b> olmalı. Windows, Node için güvenlik duvarı izni sorarsa <b>Özel ağlar</b>'a izin ver.<br>
        • Port görünmüyorsa kartın USB çipinin sürücüsünü kur (<b>CP210x</b> ya da <b>CH340</b>, çipin üstünde yazar). Bazı USB kabloları sadece şarj eder, veri taşımaz.<br>
        • Yüklerken "Connecting…" yazısında takılırsa kartın <b>BOOT</b> tuşuna basılı tut.<br>
        • Buzzer sürekli ötüyorsa ya da hiç ötmüyorsa koddaki <code>BUZZER_ACIK</code> değerini <code>LOW</code> yap.<br>
        • Ne olduğunu görmek için <b>Araçlar → Seri Monitör</b>'ü 115200 baud ile aç.</div>`,
  },
  {
    baslik: 'Çalıştır', ekle: [], calistir: true, kamera: [0, 44, 52, 0, -1, 6, 74],
    html: `
      <p>Gerçek kartla aynı mantık çalışıyor. Sahnede cihaz, aşağıda küçük bir <b>operatör paneli</b>, kod ve seri monitör var.</p>
      <ul>
        <li><b>Butona tıkla</b> (3D'deki kırmızı buton ya da aşağıdaki düğme): panik gider.</li>
        <li>Operatör panelinde <b>Gördüm</b>'e bas. Cihaz bir sonraki bağlantıda (≈2 sn) öğrenir: sarı LED sürekli yanar, buzzer özel bip çalar.</li>
        <li>Panelden cihazı <b>öttür</b> ya da <b>mesaj</b> gönder (cihaz uzun bip çalar, mesaj seri monitörde yazar).</li>
        <li>Yanlış alarm için butonu <b>3 saniye basılı tut</b>; iptal olunca buzzer uzun bir bip çalar.</li>
      </ul>`,
  },
];

// ============================================================ kod paneli + seri monitör (Çalıştır adımı)
const KOD = [
  ['', 'void loop() {'],
  ['wifi', '  digitalWrite(YESIL_LED, WiFi.status() == WL_CONNECTED);'],
  ['', ''],
  ['basildi', '  if (butonaBasildi && durum == NORMAL) {   // kesme yakaladı'],
  ['basildi', '    durum = GONDERILIYOR;  CAL(BIP_BIR);'],
  ['basildi', '  }'],
  ['iptal', '  if (olayVar && basiliSure >= 3000) {   // yanlış alarm'],
  ['iptal', '    durum = IPTAL_EDILIYOR;'],
  ['iptal', '  }'],
  ['', ''],
  ['gonder', '  if (durum == GONDERILIYOR || durum == IPTAL_EDILIYOR) {'],
  ['gonder', '    kod = istekGonder(iptal ? "/api/iptal" : "/api/panik");'],
  ['tamam', '    if (kod == 200) durum = iptal ? NORMAL : ILETILDI;'],
  ['gonder', '  }   // olmazsa 2 sn sonra tekrar'],
  ['', ''],
  ['konum', '  if (millis() - sonDeneme >= aralik) {   // 5 sn, panikte 2 sn'],
  ['konum', '    istekGonder("/api/konum");'],
  ['cevap', '    sunucuDurumunaUy();   // D=goruldu: YARDIM GELIYOR'],
  ['konum', '  }'],
  ['', '}'],
  ['', ''],
  ['', '// Sunucunun cevabı: D=goruldu  M=mesaj  K=bip'],
  ['', 'void cevabiIsle(String cevap) {'],
  ['mesaj', '  if (satir.startsWith("M=")) sonMesaj = satir.substring(2);'],
  ['bip', '  if (satir == "K=bip") CAL(BIP_BUL);'],
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

// ---------------------------------------------------------- ses: firmware'deki buzzer desenleri (açık, kapalı, açık... ms)
let ses = null;
function sesHazirla() {
  try { ses ??= new AudioContext(); ses.resume(); } catch { /* ses yok */ }
}
const DESENLER = {
  BIR: [120], IKI: [120, 100, 120], YARDIM: [80, 80, 80, 80, 80, 80, 500], MESAJ: [400],
  BUL: [200, 150, 200, 150, 200, 150, 200, 150, 200, 150, 600], IPTAL: [700],
};
let buzzerAraliklari = [];
function desen(ad) {
  const t0 = performance.now();
  let ofset = 0;
  buzzerAraliklari = [];
  DESENLER[ad].forEach((ms, i) => {
    if (i % 2 === 0) {
      buzzerAraliklari.push([t0 + ofset, t0 + ofset + ms]);
      if (ses) {
        const o = ses.createOscillator(), g = ses.createGain();
        o.type = 'square'; o.frequency.value = 2300; g.gain.value = 0.03;
        o.connect(g).connect(ses.destination);
        o.start(ses.currentTime + ofset / 1000);
        o.stop(ses.currentTime + (ofset + ms) / 1000);
      }
    }
    ofset += ms;
  });
}
const buzzerCaliyor = t => buzzerAraliklari.some(([a, b]) => t >= a && t < b);

// ---------------------------------------------------------- OLED çizimi (firmware'deki ekranCiz() ile aynı yerleşim, 128×64)
const octx = oledTuval.getContext('2d');
const OS = 4, ACIK = '#cfeeff', SIYAH = '#04070b';
const oKutu = (x, y, w, h, renk = ACIK) => { octx.fillStyle = renk; octx.fillRect(x * OS, y * OS, w * OS, h * OS); };
function oYazi(x, y, metin, boyut = 1, renk = ACIK) {
  octx.save();
  octx.fillStyle = renk;
  octx.textBaseline = 'top';
  octx.font = `bold ${7 * boyut * OS}px Consolas, "Courier New", monospace`;
  const sx = (6 * boyut * OS) / octx.measureText('M').width;  // her karakter 6×boyut piksel, kart gibi
  octx.translate(x * OS, y * OS);
  octx.scale(sx, 1);
  octx.fillText(metin, 0, 0);
  octx.restore();
}
const oOrtala = (metin, y, boyut = 1, renk = ACIK) => oYazi(Math.max(0, Math.floor((128 - metin.length * 6 * boyut) / 2)), y, metin, boyut, renk);

function oledCiz(t) {
  oKutu(0, 0, 128, 64, SIYAH);
  const yanson = Math.floor(t / 400) % 2 === 1;
  const s = sim.calisiyor ? sim : { durum: 'NORMAL', bagli: true, sonKod: 200 };
  oYazi(0, 0, '34 ABC 123');
  if (s.bagli) for (let i = 0; i < 4; i++) { const h = 2 + i * 2; if (i < 3) oKutu(116 + i * 3, 8 - h, 2, h); else oKutu(116 + i * 3, 7, 1, 1); }
  else if (yanson) oYazi(116, 0, '--');
  oKutu(0, 10, 128, 1);

  const gecici = s.geciciBitis && t < s.geciciBitis;
  if (gecici) oOrtala(s.gecici, 26);
  else if (s.durum === 'NORMAL') {
    oOrtala('HAZIR', 16, 2);
    oYazi(0, 40, !s.bagli ? 'Wi-Fi baglaniyor...' : s.sonKod === 200 ? 'Sunucu: bagli' : 'Sunucu: ulasilamiyor');
    oYazi(0, 52, 'Konum: sabit');
  } else if (s.durum === 'GONDERILIYOR') {
    if (yanson) oKutu(0, 13, 128, 20);
    oOrtala('PANIK!', 16, 2, yanson ? SIYAH : ACIK);
    oOrtala(s.basarisiz === 0 ? 'Gonderiliyor...' : 'Sunucu yok, deneme ' + (s.basarisiz + 1), 38);
  } else if (s.durum === 'ILETILDI') {
    oOrtala('ILETILDI', 15, 2);
    oOrtala(yanson ? 'Panel bekleniyor...' : 'Panel bekleniyor', 38);
  } else if (s.durum === 'YARDIM') {
    oKutu(0, 13, 128, 11);
    oOrtala('YARDIM GELIYOR', 15, 1, SIYAH);
    const m = s.sonMesaj || 'Panel olayi gordu.';
    for (let i = 0; i * 21 < m.length && i < 3; i++) oYazi(0, 27 + i * 8, m.slice(i * 21, i * 21 + 21));
  } else if (s.durum === 'IPTAL') {
    oOrtala('IPTAL', 15, 2);
    oOrtala(s.basarisiz ? 'Sunucu yok, deneniyor' : 'Gonderiliyor...', 38);
  }

  const olayVar = ['GONDERILIYOR', 'ILETILDI', 'YARDIM'].includes(s.durum);
  if (olayVar && !gecici) {
    if (s.basili && !s.iptalKilidi) {
      const p = Math.min(1, (t - s.basmaAni) / 3000);
      oKutu(0, 56, 128, 1); oKutu(0, 63, 128, 1); oKutu(0, 56, 1, 8); oKutu(127, 56, 1, 8);
      oKutu(0, 56, Math.round(128 * p), 8);
    } else if (s.durum !== 'YARDIM' || !s.sonMesaj) oYazi(0, 56, 'Iptal: 3sn basili tut');
  }
  oledDoku.needsUpdate = true;
}

// ---------------------------------------------------------- sahte sunucu (operatör paneli canlandırması)
const srv = { olay: null, bekleyen: [] };
const srvAcik = () => srv.olay && (srv.olay.durum === 'acik' || srv.olay.durum === 'goruldu');
const srvDurum = () => !srvAcik() ? 'normal' : srv.olay.durum === 'goruldu' ? 'goruldu' : 'panik';

function srvIstek(yol) {
  if (yol === '/api/panik') {
    if (srvAcik()) srv.olay.durum = 'acik';
    else srv.olay = { durum: 'acik' };
  } else if (yol === '/api/iptal' && srvAcik()) {
    srv.olay.durum = 'iptal';
  }
  const satirlar = ['D=' + srvDurum()];
  for (const k of srv.bekleyen) satirlar.push(k.tur === 'mesaj' ? 'M=' + k.metin : 'K=bip');
  srv.bekleyen = [];
  opCiz();
  return satirlar;
}

function opCiz() {
  const k = $('#opPanel');
  if (!k) return;
  const o = srv.olay;
  let h = '<div class="op-ust">Operatör paneli <span>(canlandırma)</span></div>';
  if (!o) {
    h += '<div class="op-bos">Açık olay yok. Cihaz düzenli olarak konum gönderiyor.</div>';
  } else {
    const yazi = { acik: '🚨 PANİK', goruldu: 'Görüldü, yardım yönlendirildi', iptal: 'İptal edildi (yanlış alarm)', kapandi: 'Olay kapatıldı' }[o.durum];
    h += `<div class="op-olay ${o.durum}"><b>${yazi}</b> · <span class="plaka">34 ABC 123</span></div>`;
    if (srvAcik()) {
      h += `<div class="op-dugmeler">${o.durum === 'acik' ? '<button class="tehlike" data-op="gor">Gördüm</button>' : ''}
        <button data-op="mesaj">✉ "Yardım yolda"</button><button data-op="bip">🔊 Öttür</button><button data-op="kapat">Olayı kapat</button></div>`;
    }
    if (srv.bekleyen.length) {
      h += `<div class="op-not">Cihaza gidecek: ${srv.bekleyen.map(b => (b.tur === 'mesaj' ? 'mesaj' : 'öttürme')).join(', ')}. Cihaz bir sonraki bağlantıda alacak.</div>`;
    } else if (srvAcik() && o.durum === 'goruldu') {
      h += '<div class="op-not">Panel "gördüm" dedi. Cihaz bunu bir sonraki bağlantıda öğrenir.</div>';
    }
  }
  k.innerHTML = h;
}
function opTikla(e) {
  const b = e.target.closest('[data-op]');
  if (!b || !srvAcik()) return;
  sesHazirla();
  const islem = b.dataset.op;
  if (islem === 'gor') srv.olay.durum = 'goruldu';
  else if (islem === 'kapat') srv.olay.durum = 'kapandi';
  else if (islem === 'mesaj') srv.bekleyen.push({ tur: 'mesaj', metin: 'Yardim yolda' });
  else if (islem === 'bip') srv.bekleyen.push({ tur: 'bip' });
  opCiz();
}

// ---------------------------------------------------------- simülasyon (firmware'deki loop() ile aynı mantık)
const sim = { calisiyor: false };
function simBaslat() {
  const t = performance.now();
  Object.assign(sim, {
    calisiyor: true, wifiAcik: true, bagliZaman: t + 1800, bagli: false, durum: 'NORMAL', sonDeneme: t - 2500,
    basarisiz: 0, sonKod: 0, sonMesaj: '', gecici: '', geciciBitis: 0, istek: null, sunucuDurumu: '',
    basildi: false, basili: false, basmaAni: 0, iptalKilidi: false,
  });
  srv.olay = null;
  srv.bekleyen = [];
  opCiz();
  yaz('--- ESP32 acildi ---', 'baslik');
  yaz('Panik butonu v2.0');
  yaz('Plaka: 34 ABC 123');
  yaz("Wi-Fi'ye baglaniliyor: EvWifi");
}
function simDurdur() {
  sim.calisiyor = false;
  ledYak('led_yesil', false);
  ledYak('led_sari', false);
}
function geciciYaz(metin, ms) {
  sim.gecici = metin;
  sim.geciciBitis = performance.now() + ms;
}

function cevabiIsle(satirlar) {
  for (const satir of satirlar) {
    if (satir.startsWith('D=')) sim.sunucuDurumu = satir.slice(2);
    else if (satir.startsWith('M=')) {
      sim.sonMesaj = satir.slice(2);
      yaz('Panelden mesaj: ' + sim.sonMesaj);
      desen('MESAJ');
      vurgula('mesaj');
    } else if (satir === 'K=bip') {
      yaz('Panel cihazi otturuyor.');
      desen('BUL');
      vurgula('bip');
    }
  }
}

function sunucuDurumunaUy() {
  const d = sim.sunucuDurumu;
  if (d === 'goruldu' && (sim.durum === 'NORMAL' || sim.durum === 'ILETILDI')) {
    sim.durum = 'YARDIM';
    yaz('Panel olayi gordu: YARDIM GELIYOR');
    desen('YARDIM');
    vurgula('cevap');
  } else if (d === 'panik' && sim.durum === 'NORMAL') {
    sim.durum = 'ILETILDI';
  } else if (d === 'normal' && (sim.durum === 'ILETILDI' || sim.durum === 'YARDIM')) {
    sim.durum = 'NORMAL';
    sim.sonMesaj = '';
    geciciYaz('OLAY KAPATILDI', 4000);
    yaz('Panel olayi kapatti.');
  }
}

function simAdim(t) {
  if (!sim.calisiyor) return;

  // Wi-Fi -> yeşil LED
  const bagli = sim.wifiAcik && t >= sim.bagliZaman;
  if (bagli !== sim.bagli) {
    sim.bagli = bagli;
    yaz(bagli ? 'Wi-Fi baglandi, IP: 192.168.1.42' : 'Wi-Fi koptu, tekrar baglaniliyor...', bagli ? '' : 'kirmizi');
    vurgula('wifi');
  }
  ledYak('led_yesil', bagli || Math.floor(t / 250) % 2 === 1);

  // buton (kesme) ve basılı tutma
  if (sim.basildi) {
    sim.basildi = false;
    if (sim.durum === 'NORMAL') {
      yaz('PANIK! Butona basildi.', 'kirmizi');
      Object.assign(sim, { durum: 'GONDERILIYOR', sonDeneme: 0, basarisiz: 0, sonMesaj: '', geciciBitis: 0, iptalKilidi: true });
      desen('BIR');
      vurgula('basildi');
    }
  }
  const olayVar = ['GONDERILIYOR', 'ILETILDI', 'YARDIM'].includes(sim.durum);
  if (olayVar && sim.basili && !sim.iptalKilidi && t - sim.basmaAni >= 3000) {
    yaz('Iptal istendi.');
    Object.assign(sim, { iptalKilidi: true, durum: 'IPTAL', sonDeneme: 0, basarisiz: 0 });
    vurgula('iptal');
  }

  // biten istek
  if (sim.istek && t >= sim.istek.bitis) {
    const { yol, bagliydi } = sim.istek;
    sim.istek = null;
    if (bagliydi && sim.bagli) {
      const satirlar = srvIstek(yol);
      yaz(`POST ${yol} -> 200`);
      sim.sonKod = 200;
      cevabiIsle(satirlar);
      if (yol === '/api/panik') {
        sim.basarisiz = 0;
        sim.durum = 'ILETILDI';
        desen('IKI');
        vurgula('tamam');
        sunucuDurumunaUy();
      } else if (yol === '/api/iptal') {
        Object.assign(sim, { basarisiz: 0, durum: 'NORMAL', sonMesaj: '' });
        geciciYaz('IPTAL EDILDI', 3000);
        desen('IPTAL');
        vurgula('tamam');
      } else {
        sunucuDurumunaUy();
      }
    } else {
      sim.sonKod = -1;
      yaz(`POST ${yol} -> Wi-Fi yok`, 'kirmizi');
      if (yol !== '/api/konum') {
        sim.basarisiz++;
        yaz('Gonderilemedi, 2 sn sonra tekrar denenecek.', 'kirmizi');
      }
    }
  }

  // panik / iptal gönder
  if ((sim.durum === 'GONDERILIYOR' || sim.durum === 'IPTAL') && !sim.istek && (sim.sonDeneme === 0 || t - sim.sonDeneme >= 2000)) {
    sim.sonDeneme = t;
    sim.istek = { yol: sim.durum === 'IPTAL' ? '/api/iptal' : '/api/panik', bitis: t + (sim.bagli ? 600 : 60), bagliydi: sim.bagli };
    vurgula('gonder');
  }

  // canlı konum (cevapta panelin durumu gelir)
  const aralik = sim.durum === 'NORMAL' ? 5000 : 2000;
  if (['NORMAL', 'ILETILDI', 'YARDIM'].includes(sim.durum) && !sim.istek && t - sim.sonDeneme >= aralik) {
    sim.sonDeneme = t;
    sim.istek = { yol: '/api/konum', bitis: t + (sim.bagli ? 300 : 60), bagliydi: sim.bagli };
    vurgula('konum');
  }

  // sarı LED
  let sari = false;
  if (sim.durum === 'GONDERILIYOR' || sim.durum === 'IPTAL') sari = Math.floor(t / 150) % 2 === 1;
  else if (sim.durum === 'ILETILDI') sari = Math.floor(t / 600) % 2 === 1;
  else if (sim.durum === 'YARDIM') sari = true;
  ledYak('led_sari', sari);
}

// Buton: basınca kesme gibi davranır, basılı tutma süresi iptal için ölçülür
let butonBasili = false;
function butonaBas() {
  sesHazirla();
  butonBasili = true;
  sim.basili = true;
  sim.basmaAni = performance.now();
  if (sim.calisiyor) sim.basildi = true;
}
function butonuBirak() {
  if (!butonBasili) return;
  butonBasili = false;
  sim.basili = false;
  sim.iptalKilidi = false;
}

// ============================================================ parçaları tanıtma: odak, akım akışı, iç bağlantılar
// Her tanıtım adımında sahne aynı kalır; konu dışındaki parçalar soluklaşır, kamera parçaya gider
// ve parçanın işi canlı gösterilir (akan noktalar = elektrik ya da sinyal).

const V = (x, y, z) => new V3(x, y, z);
const TURUNCU = 0xffa133, MAVI_A = 0x4f95ff, KIRMIZI_A = 0xff5a4a;
const efektGrubu = new THREE.Group();
sahne.add(efektGrubu);
let efektler = [];

// Bir nokta listesini uzunluğuna göre yürünebilir bir yola çevirir
class Yol {
  constructor(noktalar) {
    this.p = noktalar;
    this.u = [0];
    for (let i = 1; i < noktalar.length; i++) this.u.push(this.u[i - 1] + noktalar[i].distanceTo(noktalar[i - 1]));
    this.L = this.u[this.u.length - 1] || 1;
  }
  nokta(t, hedef) {
    const d = (((t % 1) + 1) % 1) * this.L;
    let i = 1;
    while (i < this.u.length - 1 && this.u[i] < d) i++;
    const a = this.u[i - 1], b = this.u[i];
    return hedef.lerpVectors(this.p[i - 1], this.p[i], b > a ? (d - a) / (b - a) : 0);
  }
}
const egriNoktalari = (ad, ters = false) => {
  const p = kablolar[ad].egri.getPoints(40);
  return ters ? p.reverse() : p;
};
const yuzey = (s, satir) => delik(s, satir).setY(0.25);

// D18 → yeşil kablo → direnç → LED → (−) hat → siyah kablo → GND pini
const ledYolu = () => new Yol([
  pin('D18').setY(1.2), ...egriNoktalari('w_d18'), yuzey(30, 'h'), V(sutunX(30), 1.3, SATIR_Z.h), V(sutunX(34), 1.3, SATIR_Z.h),
  yuzey(34, 'h'), yuzey(34, 'j'), V(sutunX(34), 2.3, SATIR_Z.j), V(sutunX(34), 3.6, 6.55), V(sutunX(34), 2.3, RAY_Z.eksi),
  V(sutunX(34), 0.25, RAY_Z.eksi), V(sutunX(3), 0.25, RAY_Z.eksi), ...egriNoktalari('w_gnd', true), pin('GND').setY(1.2),
]);
// D4 → sarı kablo → buton (basılıyken) → siyah kablo → (−) hat → GND pini
const butonYolu = () => new Yol([
  pin('D4').setY(1.2), ...egriNoktalari('w_d4'), yuzey(22, 'f'), V(sutunX(22), 1.4, SATIR_Z.f), V(sutunX(24), 1.4, SATIR_Z.f),
  yuzey(24, 'f'), ...egriNoktalari('w_bgnd'), V(sutunX(3), 0.25, RAY_Z.eksi), ...egriNoktalari('w_gnd', true), pin('GND').setY(1.2),
]);
const buzzerYolu = () => new Yol([pin('D23').setY(1.2), ...egriNoktalari('w_d23'), yuzey(52, 'g'), V(sutunX(52), 1.3, SATIR_Z.g)]);
const sclYolu = () => new Yol([pin('D22').setY(1.2), ...egriNoktalari('w_oscl', true), OLED_PIN.SCL.clone()]);
const sdaYolu = geri => {
  const p = [pin('D21').setY(1.2), ...egriNoktalari('w_osda', true), OLED_PIN.SDA.clone()];
  return new Yol(geri ? p.reverse() : p);
};

// Yol üzerinde akan parlak noktalar. hiz: birim/saniye
const akisGeo = new THREE.SphereGeometry(0.32, 10, 8);
const gecV = new V3(), gecM = new THREE.Matrix4();
function akis(yol, renk, adet, hiz) {
  const mesh = new THREE.InstancedMesh(akisGeo, new THREE.MeshBasicMaterial({ color: renk, toneMapped: false, depthTest: false }), adet);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;  // kabloların içinde kalsa da görünsün
  efektGrubu.add(mesh);
  const e = {
    aktif: true,
    adim(t) {
      if (e.guncelle) e.guncelle(t);
      mesh.visible = e.aktif;
      if (!e.aktif) return;
      const taban = (t / 1000) * hiz / yol.L;
      for (let i = 0; i < adet; i++) {
        yol.nokta(taban + i / adet, gecV);
        mesh.setMatrixAt(i, gecM.makeTranslation(gecV.x, gecV.y, gecV.z));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
  return e;
}

// Bir noktadan yayılan halkalar (Wi-Fi yayını, ses)
const halkaGeo = new THREE.RingGeometry(0.9, 1.0, 48);
function halkalar(merkez, renk, sure = 1800) {
  const liste = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(halkaGeo, new THREE.MeshBasicMaterial({ color: renk, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(merkez);
    efektGrubu.add(m);
    return m;
  });
  return {
    adim(t) {
      liste.forEach((m, i) => {
        const p = ((t / sure) + i / 3) % 1;
        m.scale.setScalar(0.6 + p * 7);
        m.material.opacity = 0.85 * (1 - p);
      });
    },
  };
}

// Breadboard'un içindeki metal şerit (yarı saydam turuncu çubuk)
function serit(x, z1, z2, kalinlik = 0.75, renk = TURUNCU) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(kalinlik, 0.12, Math.abs(z2 - z1) + 0.7),
    new THREE.MeshBasicMaterial({ color: renk, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
  m.position.set(x, 0.08, (z1 + z2) / 2);
  efektGrubu.add(m);
}
function hatSeridi(z, renk) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(63.5, 0.12, 0.6),
    new THREE.MeshBasicMaterial({ color: renk, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
  m.position.set(0, 0.08, z);
  efektGrubu.add(m);
}

// Konu dışındaki parçaları soluklaştır (odak = null ise hepsi normal)
function soluklastir(odak) {
  for (const [ad, n] of Object.entries(parcalar)) {
    const sonuk = !!odak && ad !== 'bb' && !odak.includes(ad);
    n.traverse(o => {
      if (o.isLineSegments) { o.visible = !sonuk; return; }
      if (!o.material || o.isSprite) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.userData.asil === undefined) m.userData.asil = { op: m.opacity, tr: m.transparent };
        const tr = sonuk || m.userData.asil.tr;
        if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
        m.opacity = sonuk ? 0.09 : m.userData.asil.op;
        m.depthWrite = !sonuk;
      }
    });
  }
}

// Metni zamanla değişen etiket (ör. "D4 = HIGH")
function etiketEkle(p, metinFn) {
  const el = document.createElement('div');
  el.className = 'etiket';
  kap.append(el);
  etiketler.push({ el, p, guncelle: metinFn });
}

const BUTON_DONGU = 2600, BUTON_BASILI = 1200;
const EFEKTLER = {
  wifi() { efektler.push(halkalar(V(-13.9, 2.2, 0), MAVI_A)); },
  xray() {
    for (const s of [22, 24, 30, 34]) { serit(sutunX(s), SATIR_Z.f, SATIR_Z.j); serit(sutunX(s), SATIR_Z.a, SATIR_Z.e, 0.75, MAVI_A); }
  },
  ray() {
    hatSeridi(RAY_Z.eksi, MAVI_A);
    hatSeridi(RAY_Z.arti, KIRMIZI_A);
    efektler.push(akis(new Yol([V(31, 0.3, RAY_Z.eksi), V(-31, 0.3, RAY_Z.eksi)]), MAVI_A, 26, 7));
    efektler.push(akis(new Yol([V(-31, 0.3, RAY_Z.arti), V(31, 0.3, RAY_Z.arti)]), KIRMIZI_A, 26, 7));
  },
  buton() {
    const a = akis(butonYolu(), TURUNCU, 30, 11);
    a.guncelle = t => {
      const basili = t % BUTON_DONGU < BUTON_BASILI;
      butonBasili = basili;
      a.aktif = basili;
    };
    efektler.push(a);
    etiketEkle(pin('D4').setY(3.4), t => (t % BUTON_DONGU < BUTON_BASILI ? 'D4 = LOW (0) · basıldı' : 'D4 = HIGH (1) · bekliyor'));
  },
  led() {
    ledYak('led_yesil', true);
    efektler.push(akis(ledYolu(), TURUNCU, 46, 9));
  },
  buzzer() {
    desen('IKI');
    efektler.push(halkalar(V(21, 2.7, -1.4), TURUNCU, 1600));
    efektler.push(akis(buzzerYolu(), TURUNCU, 14, 10));
    let son = -1e9;
    efektler.push({ adim(t) { if (t - son > 1600) { son = t; buzzerAraliklari = [[t, t + 180]]; } } });
  },
  i2c() {
    efektler.push(akis(sclYolu(), 0xffe45c, 16, 12));
    efektler.push(akis(sdaYolu(), TURUNCU, 9, 8));
    efektler.push(akis(sdaYolu(true), TURUNCU, 3, 8));
  },
};

function efektleriKur(adim) {
  efektGrubu.clear();
  efektler = [];
  butonBasili = false;
  soluklastir(adim.odak || null);
  for (const tur of adim.efekt || []) EFEKTLER[tur]();
}

const TANIT = [
  {
    baslik: 'ESP32: beyin', odak: ['esp'], efekt: ['wifi'], kamera: [-23, 20, 24, -22, 1, 2, 32],
    isaretler: [[pin('D4'), 'D4 · buton'], [pin('D18'), 'D18-D19 · LED'], [pin('D23'), 'D23 · buzzer'],
      [V(sutunX(2.5), 1.9, 4.5), 'GND · 3V3'], [V(-33.6, 2.6, 0), 'USB'], [V(-13.9, 2.2, 0), 'Wi-Fi anteni']],
    html: `
      <p><b>ESP32 bu devrenin beyni.</b> Avuç içi kadar bir bilgisayar: yüklediğin kodu çalıştırır, kenarlarındaki <b>pin</b> denen bacaklardan elektrik sinyali okur ve gönderir.</p>
      <ul>
        <li><b>Gümüş kutu</b> (ESP32-WROOM): işlemci ve hafıza burada. Ucundaki zikzak çizgi Wi-Fi anteni; mavi halkalar Wi-Fi yayınını gösteriyor.</li>
        <li><b>Pin adları</b> kartın üstünde yazar: <code>D4</code> butonu okur, <code>D18</code>/<code>D19</code> LED'leri yakar ve <code>D23</code> buzzer'ı öttürür.</li>
        <li><code>GND</code> bütün elektriğin geri döndüğü yer, <code>3V3</code> 3,3 volt besleme çıkışı.</li>
        <li><b>USB girişi</b> hem elektrik verir hem kodu yüklemeye yarar.</li>
      </ul>
      <div class="uyari">Pinler 3,3 volt ile çalışır. 5 volt'luk bir şeyi doğrudan pine bağlama.</div>`,
  },
  {
    baslik: "Breadboard'un içi", odak: ['bb'], efekt: ['xray'], kamera: [-6, 20, 22, -6, 0, 2, 34],
    isaretler: [[delik(22, 'j'), 'f–j: hepsi bağlı'], [delik(22, 'a'), 'a–e: ayrı grup'], [V(sutunX(23), 0, 0), 'oluk iki yarıyı ayırır']],
    html: `
      <p>Breadboard'un deliklerinin altında <b>metal şeritler</b> var. Turuncu ve mavi çubuklar bu şeritleri gösteriyor; normalde göremezsin.</p>
      <ul>
        <li>Aynı numaralı sütunda <b>f-g-h-i-j</b> delikleri içeriden birbirine bağlıdır (turuncu). <b>a-b-c-d-e</b> de kendi arasında bağlıdır (mavi).</li>
        <li><b>Ortadaki oluk</b> iki yarıyı ayırır: e22 ile f22 bağlı değildir. Butonu bu yüzden oluğun üstüne takıyoruz.</li>
        <li>İki bacak aynı şeritteyse birbirine bağlıdır. Lehim gerekmez.</li>
      </ul>
      <div class="uyari">Devre kurmanın neredeyse tamamı "hangi bacak hangi şeritte" sorusudur. Bunu anladıysan işin yarısını anladın.</div>`,
  },
  {
    baslik: 'Güç hatları', odak: ['esp', 'w_gnd', 'w_3v3'], efekt: ['ray'], kamera: [0, 30, 40, 0, 0, 6, 70],
    isaretler: [[ray(40, 'eksi'), '(−) hat = GND'], [ray(48, 'arti'), '(+) hat = 3,3 V'], [delik(3, 'j'), 'GND pinine']],
    html: `
      <p>Kenardaki uzun hatlar <b>boydan boya</b> bağlıdır; içlerinden akan noktalar bunu gösteriyor.</p>
      <ul>
        <li><b>Mavi (−) hat = GND.</b> Bütün parçaların elektriği buradan ESP32'ye geri döner. Siyah kablo hattı ESP32'nin GND pinine bağlar.</li>
        <li><b>Kırmızı (+) hat = 3,3 V.</b> Buzzer beslemesini buradan alır. Kırmızı kablo hattı 3V3 pinine bağlar.</li>
      </ul>
      <div class="uyari">Bir parça çalışmıyorsa ilk bakılacak yer GND bağlantısıdır. Elektrik geri dönemezse hiçbir şey çalışmaz.</div>`,
  },
  {
    baslik: 'Buton: anahtar', odak: ['esp', 'buton', 'w_d4', 'w_bgnd', 'w_gnd'], efekt: ['buton'], kamera: [-14, 18, 24, -15, 0, 3, 32],
    html: `
      <p>Buton, basınca iki tarafını birbirine bağlayan bir <b>anahtar</b>. Sahnede kendiliğinden basılıp bırakılıyor; ESP32'nin pininin üstündeki yazıyı izle.</p>
      <ul>
        <li><b>Basılı değilken</b> D4 pini ESP32'nin içinden 3,3 V'a çekilir. Kod <b>HIGH</b> okur: "bekliyorum".</li>
        <li><b>Basınca</b> D4, sarı kablo, buton ve siyah kablo üzerinden GND'ye bağlanır. Turuncu noktalar bu yolu gösteriyor. Kod <b>LOW</b> okur ve paniği başlatır.</li>
      </ul>
      <div class="uyari">D4'ü içeriden 3,3 V'a çekme işine <b>pull-up</b> denir. Bu sayede buton için ayrı direnç gerekmez.</div>`,
  },
  {
    baslik: 'LED ve direnç: akım nasıl akar', odak: ['esp', 'w_d18', 'r_yesil', 'led_yesil', 'w_gnd'], efekt: ['led'], kamera: [-12, 24, 30, -13, 0, 4, 46],
    isaretler: [[V(0, 1.3, SATIR_Z.h), '220 Ω direnç'], [V(2, 4.6, 6.55), 'LED ≈ 6 mA']],
    html: `
      <p>Turuncu noktalar <b>elektrik akımını</b> gösteriyor. Yolu takip et:</p>
      <ol>
        <li>D18 pininden çıkar, yeşil kablodan geçer.</li>
        <li><b>Dirençten</b> geçer; direnç akımı sınırlar.</li>
        <li><b>LED'den</b> geçer ve onu yakar.</li>
        <li>Mavi (−) hattan ve siyah kablodan ESP32'nin GND'sine geri döner.</li>
      </ol>
      <p>Devre <b>kapalı bir halka</b> olmalı. Halkanın bir yeri koparsa akım duramaz, LED yanmaz.</p>
      <div class="uyari"><b>Neden 220 Ω?</b> LED'in üstünde yaklaşık 2 V düşer. Kalan 1,3 V ÷ 220 Ω ≈ 6 mA. LED'e yeter, pine zarar vermez. Direnç olmazsa LED ve pin yanabilir. LED tek yönlüdür: uzun bacak dirence giden tarafa.</div>`,
  },
  {
    baslik: 'Buzzer: ses', odak: ['esp', 'buzzer', 'w_d23', 'w_bvcc', 'w_bgnd2'], efekt: ['buzzer'], kamera: [16, 18, 26, 17, 0, 1, 28],
    isaretler: [[V(20, 1.6, SATIR_Z.g), 'I/O'], [V(21, 1.6, SATIR_Z.g), 'VCC'], [V(22, 1.6, SATIR_Z.g), 'GND']],
    html: `
      <p>Aktif buzzer'a güç verince kendi kendine öter. ESP32 sadece <b>"öt"</b> ya da <b>"sus"</b> der.</p>
      <ul>
        <li><b>I/O</b>: D23'ten gelen öt/sus sinyali (mavi kablo, akan noktalar).</li>
        <li><b>VCC</b>: kırmızı (+) hattan 3,3 V besleme. <b>GND</b>: mavi (−) hat.</li>
        <li>Kod farklı bip desenleri çalar: 1 bip butona basıldı, 2 bip panik iletildi, uzun desen panel gördü.</li>
      </ul>`,
  },
].map(a => ({ ...a, tanit: true, hepsi: true, ekle: [] }));

// ============================================================ seri üretim sahneleri
// Breadboard gizlenir; her adımda tek bir sahne masanın ortasında görünür.
const ZY = -3;  // masa yüzeyi

// Üstüne yazı basılmış kutu (modüller, etiketler)
function yaziKutusu(g, y, d, renk, yazi, yaziRenk = '#2b2520') {
  const doku = tuval(g, d, 48, (c, P) => {
    c.fillStyle = '#' + renk.toString(16).padStart(6, '0');
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.fillStyle = yaziRenk;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `700 ${Math.min(d * 0.3, (g * 1.55) / Math.max(3, yazi.length)) * P}px sans-serif`;
    c.fillText(yazi, c.canvas.width / 2, c.canvas.height / 2);
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(g, y, d), ustDokulu(doku, toon(renk)));
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), kenarMat));
  return m;
}
const yerlestir = (m, x, y, z) => { m.position.set(x, y, z); return m; };

// Ürünün elektronik kartı (yerel koordinat: kart altı y=0, 18 × 12 birim)
function urunKarti() {
  const g = new THREE.Group();
  g.add(kutu(18, 0.5, 12, toon(0x1d6a49), 0, 0.25, 0));
  g.add(yerlestir(yaziKutusu(4.6, 0.7, 5.4, 0xc3c8cf, 'ESP32'), -1.5, 0.85, -0.6));
  g.add(kutu(4.6, 0.12, 1.6, toon(0x151515), -1.5, 0.56, -4.4, false));
  g.add(yerlestir(yaziKutusu(5.2, 0.8, 5.2, 0xc3c8cf, '4G LTE'), 5.2, 0.9, -2.4));
  g.add(yerlestir(yaziKutusu(3.4, 1.0, 3.4, 0xc9a66b, 'GPS', '#3b2a10'), 5.6, 1.0, 3.4));
  g.add(kutu(2.2, 0.6, 2.2, toon(0x222222), -6.4, 0.8, 1.4));
  g.add(silindir(0.9, 1.2, toon(0x5a5f66), -6.4, 1.1, 4.1));
  g.add(kutu(3, 1.4, 1.8, toon(0xf0ece2), -7.9, 1.2, -3.6));
  g.add(kutu(2, 0.8, 1.2, toon(0xf0ece2), 1.6, 0.9, 4.8));
  const ped = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 12), toon(0xd6b25e), 8);
  for (let i = 0; i < 8; i++) ped.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-4.5 + i * 1.1, 0.53, 5.3));
  g.add(ped);
  return g;
}

// Kapaklı panik butonu (yerel: alt y=0)
function urunButonu() {
  const g = new THREE.Group();
  g.add(kutu(5, 1.6, 5, toon(0x232323), 0, 0.8, 0));
  g.add(silindir(1.6, 0.9, toon(0xd93025), 0, 2.0, 0));
  const kapak = kutu(4.4, 0.25, 4.4, toon(0xcfe8ff, { transparent: true, opacity: 0.35 }), 0, 3.6, -1.6);
  kapak.rotation.x = -0.9;
  g.add(kapak);
  return g;
}

// Ürünün kutusu (kapalı hâli)
function urunKutusu() {
  const g = new THREE.Group();
  g.add(kutu(20, 2.6, 14, toon(0x3a3d42), 0, 1.3, 0));
  g.add(yerlestir(yaziKutusu(20, 1.6, 14, 0x44484e, 'PANİK BUTONU', '#e8e2d6'), 0, 3.4, 0));
  g.add(silindir(0.5, 0.3, toon(0xffc21a, { emissive: 0xffc21a, emissiveIntensity: 0.6 }), 7.5, 4.3, -5));
  for (const x of [-11, 11]) g.add(kutu(2, 0.4, 3, toon(0x3a3d42), x, 0.2, 0));
  return g;
}

const UR = {};  // animasyonların ihtiyaç duyduğu parçalar

// 1 · prototip ile ürün yan yana
{
  const g = new THREE.Group();
  const kutuU = urunKutusu(); kutuU.position.set(56, ZY, -2); g.add(kutuU);
  const btn = urunButonu(); btn.position.set(56, ZY, 13); g.add(btn);
  const kablo1 = new THREE.CatmullRomCurve3([V(48, ZY + 1, 4), V(48, ZY + 0.4, 10), V(53, ZY + 0.4, 13)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(kablo1, 30, 0.3, 8), toon(0x262626)));
  const kablo2 = new THREE.CatmullRomCurve3([V(66, ZY + 1, -6), V(74, ZY + 0.4, -10), V(80, ZY + 0.4, -10)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(kablo2, 30, 0.3, 8), toon(0xd8352a)));
  g.add(kutu(4, 3, 3, toon(0x1c1c1c), 82, ZY + 1.5, -10));
  parca('u_urun', g, 'Seri üretim ürünü: kapalı kutu, ayrı panik butonu, araç aküsüne giden kablo.');
}
// 2 · ürünün kartı
{
  const g = urunKarti();
  g.position.set(0, ZY + 1, 0);
  for (const [x, z] of [[-8, -5], [8, -5], [-8, 5], [8, 5]]) g.add(silindir(0.4, 1, toon(0xb8bcc2), x, -0.5, z, false));
  parca('u_kart', g, 'Ürün kartı: breadboard\'daki her şey tek bir devre kartında.');
}
// 3 · kartın katmanları
{
  const g = new THREE.Group();
  UR.katmanlar = [
    [0x1d6a49, 'üst: parçalar'], [0xc8793a, 'toprak (GND)'], [0xb5652c, 'güç'], [0x1d6a49, 'alt: sinyal'],
  ].map(([renk, ad], i) => {
    const m = kutu(18, 0.3, 12, toon(renk), 0, 0, 0);
    g.add(m);
    return { m, ad, taban: ZY + 9 - i * 0.4 };
  });
  const ust = urunKarti();
  ust.position.y = 0.15;
  UR.katmanlar[0].m.add(ust);
  parca('u_katman', g, 'Dört katmanlı devre kartı: iki iç katman toprak ve güç taşır.');
}
// 4 · dizgi hattı
{
  const g = new THREE.Group();
  const BY = ZY + 3.5;
  g.add(kutu(86, 1, 9, toon(0x45484d), 0, ZY + 3, 0));
  for (const x of [-40, -14, 12, 38]) for (const z of [-3.5, 3.5]) g.add(kutu(1, 2.5, 1, toon(0x2f3236), x, ZY + 1.25, z, false));
  const istasyon = (x, en, h, renk) => {
    g.add(kutu(en, h, 1, toon(renk), x, BY + h / 2, -5.4));  // önü açık: içinden geçen kart görünsün
    g.add(kutu(en, 1.2, 11.8, toon(renk), x, BY + h + 0.6, 0));
  };
  istasyon(-28, 9, 6, 0xd9d4ca);
  istasyon(-6, 12, 8, 0xe2ddd3);
  istasyon(16, 16, 5, 0x55595f);
  istasyon(36, 8, 6, 0xd9d4ca);
  UR.kafa = kutu(2, 2.2, 2, toon(0xe2561b), -6, BY + 5.5, 0);
  g.add(UR.kafa);
  UR.firinIsigi = new THREE.PointLight(0xff7a2a, 30, 14, 1.5);
  UR.firinIsigi.position.set(16, BY + 3, 0);
  g.add(UR.firinIsigi);
  g.add(kutu(1.2, 1.2, 1.2, toon(0x222222), 36, BY + 5.4, 0));
  UR.kartlar = [0, 1, 2].map(() => {
    const k = new THREE.Group();
    k.add(kutu(6, 0.3, 4, toon(0x1d6a49), 0, 0.15, 0));
    const parcalarK = new THREE.Group();
    parcalarK.add(kutu(1.6, 0.4, 1.8, toon(0xc3c8cf), -1.2, 0.5, -0.4));
    parcalarK.add(kutu(1.8, 0.4, 1.8, toon(0xc3c8cf), 1.4, 0.5, -0.6));
    parcalarK.add(kutu(1.1, 0.5, 1.1, toon(0xc9a66b), 1.6, 0.55, 1.2));
    parcalarK.add(kutu(0.8, 0.3, 0.8, toon(0x222222), -1.8, 0.45, 1.2));
    k.add(parcalarK);
    k.userData.parcalar = parcalarK;
    k.position.y = BY;
    g.add(k);
    return k;
  });
  parca('u_hat', g, 'Yüzey dizgi hattı: krem lehim → dizgi makinesi → fırın → optik kontrol.');
}
// 5 · programlama ve test yatağı
{
  const g = new THREE.Group();
  g.add(kutu(22, 3, 15, toon(0x2f3236), 0, ZY + 1.5, 0));
  g.add(kutu(20, 0.4, 13, toon(0x5a5f66), 0, ZY + 3.2, 0));
  const igne = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, 1.4, 8), toon(0xd6b25e), 8);
  for (let i = 0; i < 8; i++) igne.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-4.5 + i * 1.1, ZY + 4.1, 5.3));
  g.add(igne);
  UR.testKarti = urunKarti();
  g.add(UR.testKarti);
  UR.lamba = new THREE.Mesh(new THREE.SphereGeometry(0.9, 20, 12), toon(0x888888, { emissive: 0x000000 }));
  UR.lamba.position.set(9, ZY + 4.2, -6);
  g.add(UR.lamba);
  g.add(yerlestir(yaziKutusu(8, 5, 0.6, 0x26292e, 'TEST', '#9fe39f'), 15, ZY + 5.5, -4));
  parca('u_fikstur', g, 'İğneli test yatağı: kart iğnelere oturur, birkaç saniyede her şey ölçülür.');
}
// 6 · kutunun katmanları
{
  const g = new THREE.Group();
  const alt = new THREE.Group();
  alt.add(kutu(20, 2.4, 14, toon(0x3a3d42), 0, 1.2, 0));
  for (const x of [-11, 11]) alt.add(kutu(2, 0.4, 3, toon(0x3a3d42), x, 0.2, 0));
  const pil = yaziKutusu(8, 1.2, 5, 0x2f68c8, 'PİL', '#ffffff');
  const kart = urunKarti();
  const conta = kutu(19.6, 0.25, 13.6, toon(0xe2561b), 0, 0, 0);
  const ust = new THREE.Group();
  ust.add(yerlestir(yaziKutusu(20, 1.6, 14, 0x44484e, 'PANİK BUTONU', '#e8e2d6'), 0, 0, 0));
  ust.add(silindir(0.5, 0.3, toon(0xffc21a), 7.5, 0.9, -5));
  UR.kutuParcalari = [
    [alt, ZY, 0, 'alt kapak, montaj kulakları'], [pil, ZY + 2.2, 4, 'yedek pil'], [kart, ZY + 2.6, 8, 'elektronik kart'],
    [conta, ZY + 4.2, 12, 'conta: toz ve nem'], [ust, ZY + 5.2, 16, 'üst kapak, LED penceresi'],
  ].map(([m, taban, ayrilma, ad]) => { g.add(m); return { m, taban, ayrilma, ad }; });
  parca('u_kutu', g, 'Kutunun katmanları: alt kapak, pil, kart, conta, üst kapak.');
}
// 7 · araçta montaj
{
  const g = new THREE.Group();
  const cam = toon(0xbcd7ea, { transparent: true, opacity: 0.18, depthWrite: false });
  g.add(kutu(42, 6, 18, cam, 0, ZY + 6, 0));
  g.add(kutu(20, 6, 17, cam, -4, ZY + 12, 0));
  for (const x of [-13, 13]) for (const z of [-9.5, 9.5]) {
    const t = silindir(3, 1.6, toon(0x222222), x, ZY + 3, z, false, 24);
    t.rotation.x = Math.PI / 2;
    g.add(t);
  }
  g.add(kutu(3, 3, 16, toon(0x5a5048), 7, ZY + 9.5, 0));
  const direksiyon = new THREE.Mesh(new THREE.TorusGeometry(2, 0.35, 10, 30), toon(0x2a2a2a));
  direksiyon.position.set(4.5, ZY + 11, -4.5);
  direksiyon.rotation.y = Math.PI / 2;
  direksiyon.rotation.x = 0.4;
  g.add(direksiyon);
  g.add(yerlestir(yaziKutusu(4, 1.4, 3, 0x3a3d42, 'P', '#e8e2d6'), 8.5, ZY + 7.2, 3));
  UR.aracButon = silindir(0.7, 0.6, toon(0xd93025, { emissive: 0xd93025, emissiveIntensity: 0.3 }), 4.6, ZY + 8.6, -7);
  g.add(UR.aracButon);
  g.add(kutu(4, 3, 4, toon(0x1c1c1c), 16, ZY + 7.5, 5));
  g.add(silindir(0.4, 0.6, toon(0xd8352a), 15, ZY + 9.3, 4.2, false));
  const kablo = new THREE.CatmullRomCurve3([V(10, ZY + 7.2, 3), V(12, ZY + 6.2, 4), V(15, ZY + 8.6, 4.2)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(kablo, 20, 0.2, 6), toon(0xd8352a)));
  g.add(kutu(1, 0.6, 0.6, toon(0xd9c49c), 12.2, ZY + 6.4, 4, false));
  const kablo2 = new THREE.CatmullRomCurve3([V(7.5, ZY + 7.2, 1.6), V(6, ZY + 7.6, -4), V(4.6, ZY + 8.4, -7)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(kablo2, 20, 0.18, 6), toon(0x262626)));
  parca('u_arac', g, 'Araçta: cihaz gösterge panelinin arkasında, buton sürücünün elinin altında.');
}
// 8 · bulut ve panel
const BULUT_YOLU = [V(-34, ZY + 2.5, 0), V(-22, ZY + 18, 0), V(-14, ZY + 22, 0), V(4, ZY + 14, 0), V(20, ZY + 7, 0), V(36, ZY + 6, 0)];
{
  const g = new THREE.Group();
  g.add(yerlestir(yaziKutusu(6, 2, 4, 0x3a3d42, 'P', '#e8e2d6'), -34, ZY + 1, 0));
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [0, 1.8]]) {
    const ayak = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 22, 6), toon(0x9aa0a8));
    ayak.position.set(-14 + x * 0.5, ZY + 11, z * 0.5);
    ayak.rotation.z = -x * 0.06;
    ayak.rotation.x = z * 0.06;
    g.add(ayak);
  }
  for (const a of [0, 2.1, 4.2]) g.add(kutu(0.6, 3, 1.4, toon(0xe8e4dc), -14 + Math.cos(a) * 1.2, ZY + 21, Math.sin(a) * 1.2));
  for (const [x, y, z, r] of [[2, 14, 0, 3.2], [6, 15.5, 0.5, 3.8], [10, 14, -0.5, 3], [6, 12.6, 0, 3.4]]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), toon(0xf4f1ea));
    b.position.set(x, ZY + y, z);
    g.add(b);
  }
  for (const x of [18, 23]) g.add(yerlestir(yaziKutusu(4, 10, 4, 0x2f3236, '', '#ffffff'), x, ZY + 5, 0));
  g.add(kutu(12, 8, 1, toon(0x2a2a2a), 38, ZY + 7, 0));
  const ekranP = yerlestir(yaziKutusu(11, 0.2, 7, 0xd93025, 'PANİK', '#ffffff'), 38, ZY + 7, 0.6);
  ekranP.rotation.x = Math.PI / 2;
  g.add(ekranP);
  g.add(kutu(2, 3, 2, toon(0x2a2a2a), 38, ZY + 1.5, 0));
  parca('u_bulut', g, 'Cihaz 4G baz istasyonuna, oradan internetle buluttaki sunucuya, oradan operatör paneline ulaşır.');
}
// 9 · test kabinleri
{
  const g = new THREE.Group();
  // iklim kabini: önü camlı, içi görünsün diye duvar duvar
  const beyaz = toon(0xe8e4dc);
  g.add(kutu(16, 16, 0.6, beyaz, -10, ZY + 8, -6.2));
  for (const x of [-17.7, -2.3]) g.add(kutu(0.6, 16, 13, beyaz, x, ZY + 8, 0));
  for (const y of [ZY + 0.3, ZY + 15.7]) g.add(kutu(16, 0.6, 13, beyaz, -10, y, 0));
  g.add(kutu(13, 12, 0.3, toon(0xcfe8ff, { transparent: true, opacity: 0.3, depthWrite: false }), -10, ZY + 8.5, 6.6));
  g.add(yerlestir(yaziKutusu(6, 1.6, 4, 0x3a3d42, 'P', '#e8e2d6'), -10, ZY + 6, 1));
  UR.kabinIsigi = new THREE.PointLight(0x4f95ff, 25, 14, 1.5);
  UR.kabinIsigi.position.set(-10, ZY + 11, 2);
  g.add(UR.kabinIsigi);
  g.add(kutu(12, 3, 12, toon(0x2f3236), 14, ZY + 1.5, 0));
  UR.sarsilan = new THREE.Group();
  UR.sarsilan.add(kutu(11, 0.8, 11, toon(0x9aa0a8), 0, 0, 0));
  UR.sarsilan.add(yerlestir(yaziKutusu(6, 1.6, 4, 0x3a3d42, 'P', '#e8e2d6'), 0, 1.2, 0));
  UR.sarsilan.position.set(14, ZY + 3.6, 0);
  g.add(UR.sarsilan);
  parca('u_test', g, 'Test: iklim kabininde −30 ile +85 °C, titreşim tablasında sarsıntı.');
}
// 10 · paketli ürünler
{
  const g = new THREE.Group();
  g.add(kutu(26, 1.5, 19, toon(0xa0784c), 0, ZY + 0.75, 0));
  for (let kat = 0; kat < 3; kat++) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    g.add(yerlestir(yaziKutusu(7.6, 5, 5.6, 0xc9a26b, 'PANİK BUTONU · SN 0' + (kat * 9 + i * 3 + j + 101), '#4a3418'), -8.3 + i * 8.3, ZY + 4 + kat * 5.2, -6 + j * 6));
  }
  UR.palet = g;
  parca('u_paket', g, 'Test edilmiş, seri numaralı ve paketlenmiş cihazlar.');
}
sahne.traverse(o => { if (o.isMesh && o !== zemin && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });

Object.assign(EFEKTLER, {
  katman() {
    efektler.push({ adim(t) {
      const e = 0.5 - 0.5 * Math.cos(t * 0.0012);
      UR.katmanlar.forEach((k, i) => { k.m.position.y = ZY + 4 + (3 - i) * (0.35 + e * 3); });
    } });
    UR.katmanlar.forEach((k, i) => etiketEkle(V(10.5, 0, 0), () => k.ad));
    const son = etiketler.slice(-4);
    efektler.push({ adim() { son.forEach((e, i) => { e.p.y = UR.katmanlar[i].m.position.y; }); } });
  },
  hat() {
    efektler.push({ adim(t) {
      UR.kartlar.forEach((k, i) => {
        const x = -43 + ((t / 1000) * 7 + i * 28.6) % 86;
        k.position.x = x;
        k.userData.parcalar.visible = x > -6;
      });
      UR.kafa.position.x = -6 + Math.sin(t * 0.004) * 3;
      UR.kafa.position.z = Math.cos(t * 0.003) * 2.5;
      UR.firinIsigi.intensity = 26 + Math.sin(t * 0.01) * 6;
    } });
  },
  fikstur() {
    let durum = '';
    efektler.push({ adim(t) {
      const p = (t % 6000) / 6000;
      const inis = Math.min(1, p / 0.25);
      UR.testKarti.position.y = ZY + 4.8 + (1 - yumusak(inis)) * 7 + (p > 0.9 ? (p - 0.9) * 60 : 0);
      const m = UR.lamba.material;
      if (p < 0.25) { durum = 'kart iğnelere iniyor'; m.color.setHex(0x888888); m.emissive.setHex(0x000000); }
      else if (p < 0.75) { durum = 'test ediliyor: güç · LED · buton · 4G · GPS'; const y = Math.floor(t / 200) % 2; m.color.setHex(0xffb000); m.emissive.setHex(y ? 0xffb000 : 0x000000); }
      else { durum = 'GEÇTİ ✓ · yazılım + seri no yüklendi'; m.color.setHex(0x2fd15a); m.emissive.setHex(0x2fd15a); }
    } });
    etiketEkle(V(0, ZY + 12, 0), () => durum);
  },
  kutu() {
    const ets = UR.kutuParcalari.map(k => { etiketEkle(V(12, 0, 0), () => k.ad); return etiketler.at(-1); });
    efektler.push({ adim(t) {
      const e = 0.5 - 0.5 * Math.cos(t * 0.0011);
      UR.kutuParcalari.forEach((k, i) => {
        k.m.position.y = k.taban + e * k.ayrilma;
        ets[i].p.y = k.m.position.y + 1;
      });
    } });
  },
  arac() {
    efektler.push({ adim(t) { UR.aracButon.scale.setScalar(1 + 0.25 * Math.max(0, Math.sin(t * 0.005))); } });
  },
  bulut() {
    efektler.push(akis(new Yol(BULUT_YOLU), TURUNCU, 18, 14));
    efektler.push(akis(new Yol([...BULUT_YOLU].reverse().map(p => p.clone().add(V(0, -1.2, 1.5)))), MAVI_A, 8, 9));
  },
  test() {
    let derece = '';
    efektler.push({ adim(t) {
      const s = 0.5 - 0.5 * Math.cos(t * 0.0009);
      const c = Math.round(-30 + s * 115);
      derece = `iklim kabini: ${c > 0 ? '+' : ''}${c} °C`;
      UR.kabinIsigi.color.setHex(c < 20 ? 0x4f95ff : 0xff6a2a);
      UR.sarsilan.position.x = 14 + Math.sin(t * 0.08) * 0.25;
      UR.sarsilan.position.z = Math.cos(t * 0.07) * 0.25;
    } });
    etiketEkle(V(-10, ZY + 17.5, 0), () => derece);
  },
  paket() {
    efektler.push({ adim(t) { UR.palet.rotation.y = Math.sin(t * 0.0004) * 0.5; } });
  },
});

const URETIM = [
  {
    baslik: 'Prototipten ürüne', goster: ['bb', ...HEPSI, 'u_urun'], kamera: [22, 42, 62, 22, -1, 3, 116],
    isaretler: [[V(0, 3, -8), 'senin prototipin'], [V(56, ZY + 4.5, -2), 'seri üretim ürünü'], [V(56, ZY + 3, 13), 'kapaklı panik butonu'], [V(82, ZY + 3, -10), 'araç aküsüne']],
    html: `
      <p>Solda masandaki prototip, sağda aynı işi yapan <b>satılabilir ürün</b>. Bu bölümde birinden ötekine nasıl gidildiğini sahne sahne göreceğiz.</p>
      <ul>
        <li><b>Bağlantı:</b> araçta Wi-Fi yok. Ürünün içinde bir <b>4G modem</b> ve SIM kart olur; cihaz her yerden kendi başına internete çıkar.</li>
        <li><b>Konum:</b> sabit koordinat yerine <b>GPS</b>.</li>
        <li><b>Güç:</b> USB yerine <b>araç aküsü</b> (12 ya da 24 V). İçinde yedek pil olur; kablo kesilse de çalışır.</li>
        <li><b>Buton:</b> ayrı, kapaklı ve sürücünün elinin altında. Gerçek bir saldırıda ses çıkarmayan <b>sessiz alarm</b> tercih edilebilir.</li>
      </ul>`,
  },
  {
    baslik: 'Ürünün kartı', goster: ['u_kart'], kamera: [0, 22, 26, 0, ZY + 1, 1, 34],
    isaretler: [[V(-1.5, ZY + 2.4, -0.6), 'ESP32: beyin'], [V(5.2, ZY + 2.5, -2.4), '4G modem'], [V(5.6, ZY + 2.6, 3.4), 'GPS'],
      [V(-6.4, ZY + 2.6, 2.6), 'güç: 12 V → 3,3 V'], [V(-7.9, ZY + 2.8, -3.6), 'araç kablosu'], [V(-0.7, ZY + 1.6, 5.3), 'test noktaları']],
    html: `
      <p>Breadboard'daki modüllerin ve kabloların yerini <b>tek bir devre kartı</b> alır. Kartı bir donanım (elektronik) tasarımcısı çizer.</p>
      <ul>
        <li><b>ESP32 modülü:</b> aynı beyin, bu kez karta lehimli. Ucundaki siyah bölge anten; altında bakır bırakılmaz.</li>
        <li><b>4G modem:</b> Wi-Fi'nin yerini alır. Veri gönderirken anlık olarak çok akım çeker; güç devresi buna göre tasarlanır.</li>
        <li><b>GPS:</b> uydulardan konum alan parça ve anteni.</li>
        <li><b>Güç bölümü:</b> aracın 12 V'unu 3,3 V'a indirir. Marşta düşen, bazen ani yükselen araç elektriğine karşı korumalıdır.</li>
        <li><b>Test noktaları:</b> fabrikada her kartı birkaç saniyede test etmek için küçük altın pedler.</li>
      </ul>`,
  },
  {
    baslik: 'Kartın katmanları', goster: ['u_katman'], kamera: [0, 18, 28, 0, ZY + 7, 0, 34],
    html: `
      <p>Gerçek devre kartı tek bir levha değil, üst üste yapıştırılmış <b>katmanlardan</b> oluşur. Sahnede katmanlar ayrılıp birleşiyor.</p>
      <ul>
        <li><b>Üst ve alt katman:</b> parçalar ve aralarındaki bakır yollar.</li>
        <li><b>İç katmanlar:</b> biri baştan sona <b>toprak (GND)</b>, biri <b>güç</b>. Breadboard'daki mavi ve kırmızı hatların kart içindeki hâli.</li>
      </ul>
      <p>Tasarım bitince üç dosya çıkar: kartın çizimi (Gerber), parça listesi (BOM) ve parçaların kart üzerindeki yerleri. Fabrikaya giden şey bunlardır.</p>
      <div class="uyari">İlk kart neredeyse hiç kusursuz çıkmaz. Genelde 2–3 düzeltme (revizyon) yapılır; her seferinde 5–10 kart ürettirilip denenir.</div>`,
  },
  {
    baslik: 'Kartlar fabrikada dizilir', goster: ['u_hat'], kamera: [0, 34, 60, 0, ZY + 4, 0, 96],
    isaretler: [[V(-28, ZY + 12, 0), '1 krem lehim'], [V(-6, ZY + 14, 0), '2 dizgi makinesi'], [V(16, ZY + 11, 0), '3 fırın'], [V(36, ZY + 12, 0), '4 optik kontrol']],
    html: `
      <p>Kartlar bir bantta ilerler ve sırayla dört istasyondan geçer. Bunu genelde sen değil, dosyalarını gönderdiğin <b>sözleşmeli elektronik üretici</b> yapar.</p>
      <ol>
        <li><b>Krem lehim:</b> bir metal şablonla, parçaların oturacağı yerlere lehim macunu sürülür.</li>
        <li><b>Dizgi makinesi:</b> turuncu kafa parçaları alıp kartın üstüne koyar; saatte binlerce parça. Kartın üstünde parçaların belirdiğini izle.</li>
        <li><b>Fırın:</b> lehim erir, parçalar karta yapışır.</li>
        <li><b>Optik kontrol:</b> bir kamera her lehim noktasına bakar; eksik ya da kaymış parçayı yakalar.</li>
      </ol>`,
  },
  {
    baslik: 'Programlama ve test', goster: ['u_fikstur'], kamera: [4, 22, 30, 3, ZY + 5, 0, 38],
    html: `
      <p>Lehimlenen her kart bir <b>iğneli test yatağına</b> oturur. Altın iğneler kartın test noktalarına dokunur.</p>
      <ul>
        <li>Birkaç saniyede kartın içine <b>yazılım</b> yüklenir, ona özel bir <b>seri numarası</b> ve dijital kimlik yazılır.</li>
        <li>Yazılımın gizli "fabrika test modu" her şeyi dener: güç gerilimleri, LED, buton, 4G modem, GPS.</li>
        <li>Lamba: sarı = test ediliyor, yeşil = geçti. Geçemeyen kart ayrılır ve incelenir.</li>
      </ul>
      <div class="uyari">Bu, senin Bölüm "Kur"daki "her parçayı tek tek test et" yaklaşımının fabrikadaki hâli.</div>`,
  },
  {
    baslik: 'Kutu', goster: ['u_kutu'], kamera: [0, 24, 42, 0, ZY + 9, 0, 56],
    html: `
      <p>Kart, araç içinde yıllarca korunacağı bir <b>kutuya</b> girer. Sahnede kutu parçalarına ayrılıp birleşiyor.</p>
      <ul>
        <li><b>Alt kapak:</b> montaj kulaklarıyla araca vidalanır.</li>
        <li><b>Yedek pil:</b> araç kablosu kesilse de cihaz çalışmaya devam eder.</li>
        <li><b>Conta:</b> toz ve nemi içeri almaz.</li>
        <li><b>Üst kapak:</b> küçük bir LED penceresi.</li>
      </ul>
      <p>Kutu önce bilgisayarda çizilir ve 3D yazıcıyla birkaç tane basılıp denenir. Binlerce adet için plastik <b>enjeksiyon kalıbı</b> yapılır: ilk maliyeti yüksek, sonra her kutu saniyeler içinde ve ucuza çıkar.</p>`,
  },
  {
    baslik: 'Araçta montaj', goster: ['u_arac'], kamera: [26, 36, 44, 4, ZY + 8, 0, 56],
    isaretler: [[V(8.5, ZY + 8.5, 3), 'cihaz: panelin arkasında'], [V(4.6, ZY + 9.6, -7), 'panik butonu'], [V(16, ZY + 10, 5), 'akü'], [V(12.2, ZY + 7.2, 4), 'sigorta']],
    html: `
      <p>Eğitimli bir montaj ekibi cihazı araca takar:</p>
      <ul>
        <li><b>Cihaz</b> göze görünmeyen bir yere, gösterge panelinin arkasına vidalanır.</li>
        <li><b>Buton</b> sürücünün kolayca ama dışarıdan fark edilmeden ulaşacağı yere, kabloyla bağlanır.</li>
        <li><b>Güç kablosu</b> sigortayla aküye gider.</li>
      </ul>
      <p>Montajın sonunda bir <b>deneme paniği</b> gönderilir ve panelde göründüğü kontrol edilir.</p>`,
  },
  {
    baslik: 'Bulut ve panel', goster: ['u_bulut'], kamera: [2, 26, 64, 2, ZY + 10, 0, 92],
    isaretler: [[V(-34, ZY + 4, 0), 'araçtaki cihaz'], [V(-14, ZY + 24, 0), '4G baz istasyonu'], [V(6, ZY + 19.5, 0), 'internet'], [V(20.5, ZY + 11, 0), 'sunucu (bulut)'], [V(38, ZY + 12, 0), 'operatör paneli']],
    html: `
      <p>Turuncu noktalar paniği, mavi noktalar cevabı gösteriyor. Prototipteki yolculuğun aynısı; yalnızca Wi-Fi yerine <b>4G baz istasyonu</b>, bilgisayarın yerine <b>buluttaki sunucu</b> var.</p>
      <ul>
        <li>Sunucu kiralık ve yedekli sunuculara taşınır; senin bilgisayarın kapanınca sistem durmaz.</li>
        <li>Her müşteri yalnızca kendi araçlarını görür. Kimse "Gördüm" demezse alarm SMS ya da arama ile bir üst yetkiliye gider.</li>
        <li>Her cihaz için operatörle bir <b>M2M SIM</b> hattı açılır; bu yüzden ürün genelde <b>cihaz + aylık abonelik</b> olarak satılır.</li>
        <li>Konum kişisel veridir: <b>KVKK</b> belgeleri bir hukukçuyla hazırlanır.</li>
      </ul>`,
  },
  {
    baslik: 'Test ve sertifika', goster: ['u_test'], kamera: [2, 24, 46, 2, ZY + 7, 0, 52],
    isaretler: [[V(14, ZY + 7, 0), 'titreşim tablası']],
    html: `
      <p>Satıştan önce ürün zorlanır. Sahnede iklim kabininin sıcaklığı −30 ile +85 °C arasında gidip geliyor, yandaki tabla cihazı sarsıyor.</p>
      <ol>
        <li><b>EVT</b> (5–20 kart): her özellik çalışıyor mu?</li>
        <li><b>DVT</b> (50–200 cihaz): sıcak, soğuk, titreşim, düşme; sonra 10–50 gerçek araçta haftalarca <b>saha denemesi</b>.</li>
        <li><b>PVT</b> (200–1000 cihaz): fabrika bunu doğru ve tekrar tekrar üretebiliyor mu?</li>
      </ol>
      <p>Bunlarla birlikte satış için belgeler alınır: <b>CE</b> (Wi-Fi/4G içeren cihaz), <b>RoHS</b>, araç için <b>E-işareti</b>, SIM'li cihaz için <b>BTK IMEI kaydı</b>.</p>
      <div class="uyari">Kesin liste ürüne ve ülkeye göre değişir. Akredite bir test laboratuvarıyla tasarım aşamasında konuşmaya başla.</div>`,
  },
  {
    baslik: 'Seri üretim ve sonrası', goster: ['u_paket'], kamera: [0, 30, 48, 0, ZY + 8, 0, 64],
    html: `
      <p>Her cihaz üretildi, test edildi, seri numarası ve kaydı tutuldu, paketlendi. Artık seri üretim:</p>
      <ul>
        <li>Parçalar önceden sipariş edilir; teslimi uzun süren parçalar (modem gibi) için yedek seçenek hazır tutulur.</li>
        <li>Her cihazın hangi gün, hangi parçayla, hangi test sonucuyla üretildiği kayıtlıdır; sahada sorun çıkarsa etkilenen cihazlar bulunur.</li>
      </ul>
      <p><b>Satış sonrası</b> döngü başlar: kurulum → aktivasyon → izleme (sessizleşen cihaz uyarısı) → uzaktan yazılım güncellemesi → destek ve arızalı cihaz değişimi → abonelik.</p>
      <p class="not">Yol boyunca gereken kişiler: donanım tasarımcısı, gömülü yazılımcı, backend geliştirici, mekanik tasarımcı, test laboratuvarı, hukukçu ve sözleşmeli üretici. Senin ilk adımın: prototipi kurmak ve bir hafta araçta denemek.</p>`,
  },
].map(a => ({ ...a, uretim: true, ekle: [], bolum: 'Seri üretim', efekt: a.efekt ?? [] }));
URETIM[2].efekt = ['katman'];
URETIM[3].efekt = ['hat'];
URETIM[4].efekt = ['fikstur'];
URETIM[5].efekt = ['kutu'];
URETIM[6].efekt = ['arac'];
URETIM[7].efekt = ['bulut'];
URETIM[8].efekt = ['test'];
URETIM[9].efekt = ['paket'];

ADIMLAR.splice(1, 0, ...TANIT);
ADIMLAR.push(...URETIM);
ADIMLAR.forEach(a => { a.bolum ??= a.tanit ? 'Parçaları tanı' : a.calistir ? 'Çalıştır' : a.hepsi ? 'Giriş' : 'Kur'; });

// ============================================================ adım gösterimi
let simdiki = -1;
const isaretGrubu = new THREE.Group();
sahne.add(isaretGrubu);
let etiketler = [];
const animasyonlar = [];

function gorunurler(i) {
  if (ADIMLAR[i].goster) return new Set(ADIMLAR[i].goster);
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
  butonuBirak();
  if (adim.hepsi) ledYak('led_yesil', !adim.tanit);
  efektleriKur(adim);

  // panel
  $('#adimNo').textContent = `Adım ${i + 1} / ${ADIMLAR.length} · ${adim.bolum}`;
  $('#baslik').textContent = adim.baslik;
  const icerik = $('#icerik');
  icerik.innerHTML = adim.html;
  if (adim.calistir) {
    icerik.insertAdjacentHTML('beforeend', `
      <div class="kontroller">
        <button class="panik" id="basBtn">🔴 Panik butonu (bas / basılı tut)</button>
        <button id="wifiBtn">📶 Wi-Fi'yi kes</button>
        <button id="bastanBtn">↺ Baştan</button>
      </div>
      <div class="op" id="opPanel"></div>
      <div id="kod">${kodHtml()}</div>
      <div id="seri"></div>
      <p class="not">Bu bir canlandırma, gerçek kart da aynı şekilde davranır. Gerçeğini denemek için <a href="../" target="_blank">Panik Paneli</a>'ni aç. Kartın hazır değilse <code>npm run sim</code> ile sahte araçlar gönderebilirsin.</p>`);
    const bb = $('#basBtn');
    bb.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { bb.setPointerCapture(e.pointerId); } catch { /* parmak düğmeden kaysa da basılı sayılsın diye; olmazsa sorun değil */ }
      butonaBas();
    });
    for (const olay of ['pointerup', 'pointercancel', 'lostpointercapture']) bb.addEventListener(olay, butonuBirak);
    bb.addEventListener('contextmenu', e => e.preventDefault());
    $('#wifiBtn').onclick = () => {
      sesHazirla();
      sim.wifiAcik = !sim.wifiAcik;
      if (sim.wifiAcik) sim.bagliZaman = performance.now() + 1500;
      $('#wifiBtn').textContent = sim.wifiAcik ? "📶 Wi-Fi'yi kes" : "📶 Wi-Fi'yi geri getir";
    };
    $('#bastanBtn').onclick = () => {
      $('#seri').innerHTML = '';
      $('#wifiBtn').textContent = "📶 Wi-Fi'yi kes";
      simBaslat();
    };
    $('#opPanel').onclick = opTikla;
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
  const yatayYarim = Math.atan(Math.tan(dikeyYarim) * Math.max(0.3, kamera.aspect || 1));
  const mesafe = Math.max((k[6] / 2) / Math.tan(yatayYarim), (k[6] * 0.24) / Math.tan(dikeyYarim)) * 1.08;
  const p1 = hedef.clone().addScaledVector(yon, mesafe);
  // kamera bir şekilde bozulduysa (NaN/sonsuz) geçiş yapmadan doğrudan yerine koy
  const saglam = v => Number.isFinite(v.x + v.y + v.z);
  if (!saglam(kamera.position) || !saglam(kontrol.target)) { kamera.position.copy(p1); kontrol.target.copy(hedef); }
  gecis = { t0: performance.now(), p0: kamera.position.clone(), h0: kontrol.target.clone(), p1, h1: hedef };
}
kontrol.addEventListener('start', () => { gecis = null; });
addEventListener('hashchange', () => {
  const n = Number(location.hash.slice(1)) - 1;
  if (Number.isInteger(n)) adimGoster(n);
});

// ============================================================ fare: balon + 3D butona basma
const isin = new THREE.Raycaster();
const fare = new THREE.Vector2();
const balon = $('#balon');

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
  renderer.domElement.style.cursor = o && o.userData.ad === 'buton' ? 'pointer' : '';
});
renderer.domElement.addEventListener('pointerleave', () => { balon.style.display = 'none'; });
// 3D butona basınca sahne dönmesin; bırakana kadar basılı sayılır (iptal için basılı tutulabilir)
renderer.domElement.addEventListener('pointerdown', e => {
  sesHazirla();
  const o = vurulan(e);
  if (o && o.userData.ad === 'buton') {
    kontrol.enabled = false;
    butonaBas();
  }
}, { capture: true });
addEventListener('pointerup', () => { if (butonBasili) { butonuBirak(); kontrol.enabled = true; } });
addEventListener('pointercancel', () => { if (butonBasili) { butonuBirak(); kontrol.enabled = true; } });

// ============================================================ boyut + döngü
function boyutla() {
  const g = kap.clientWidth, y = kap.clientHeight;
  if (!g || !y) return;  // sayfa henüz yerleşmedi; en-boy oranı 0 olursa kamera sonsuza gider
  const eskiOran = kamera.aspect;
  renderer.setSize(g, y, false);
  kamera.aspect = g / y;
  kamera.updateProjectionMatrix();
  // pencere boyu belirgin değiştiyse sahneyi yeniden sığdır
  if (simdiki >= 0 && Math.abs(kamera.aspect - eskiOran) / eskiOran > 0.05) kameraGit(ADIMLAR[simdiki].kamera);
}
new ResizeObserver(boyutla).observe(kap);
boyutla();

const yumusak = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const gecici = new V3();
let sonOled = -1e9;
let kapakY = 1.8;

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

  // buton: basılıyken aşağıda kalır
  kapakY += ((butonBasili ? 1.45 : 1.8) - kapakY) * 0.5;
  butonKapak.position.y = kapakY;

  // buzzer titreşimi
  buzzerGrup.position.x = buzzerCaliyor(t) ? Math.sin(t * 0.9) * 0.08 : 0;

  simAdim(t);
  for (const e of efektler) e.adim(t);

  // OLED: görünürse saniyede ~7 kez yeniden çiz
  if (parcalar.oled.visible && t - sonOled > 140) { sonOled = t; oledCiz(t); }

  // işaret halkaları nabız
  const nabiz = 1 + 0.25 * Math.sin(t * 0.006);
  for (const h of isaretGrubu.children) { h.scale.setScalar(nabiz); h.material.opacity = 0.65 + 0.3 * Math.sin(t * 0.006); }

  // HTML etiketleri
  const g = kap.clientWidth, y = kap.clientHeight;
  for (const e of etiketler) {
    if (e.guncelle) {
      const m = e.guncelle(t);
      if (e.el.textContent !== m) e.el.textContent = m;
    }
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
