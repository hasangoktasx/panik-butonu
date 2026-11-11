// Panik butonu sunucusu - ek paket gerektirmez (Node 18+).
//   node server.js
// ESP32'ler buraya konum ve panik gonderir, panel (tarayici) canli izler.

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const GENEL = path.join(KOK, 'public');
const VERI_DOSYASI = path.join(KOK, 'veri', 'olaylar.json');

const PORT = Number(process.env.PORT) || 3000;
const CIHAZ_ANAHTARI = process.env.CIHAZ_ANAHTARI || 'panik-1234'; // ESP32 kodundakiyle ayni
const IZ_UZUNLUGU = 300;   // arac basina tutulan son konum sayisi
const OLAY_SINIRI = 500;   // dosyada tutulan son olay sayisi

/** plaka -> { plaka, enlem, boylam, kaynak, sonGorulme, iz: [[enlem, boylam, zaman]], panikId } */
const araclar = new Map();
/** { id, plaka, enlem, boylam, kaynak, zaman, onaylandi, onayZamani } */
let olaylar = [];
const dinleyiciler = new Set();

// ---------------------------------------------------------------- yardimcilar

function plakaDuzelt(deger) {
  if (typeof deger !== 'string') return null;
  const p = deger.trim().toUpperCase().replace(/\s+/g, ' ');
  return /^[0-9A-Z -]{2,20}$/.test(p) ? p : null;
}

function koordinat(deger, sinir) {
  if (deger === null || deger === undefined) return null;
  const n = Number(deger);
  return Number.isFinite(n) && Math.abs(n) <= sinir ? n : undefined;
}

function govdeOku(istek) {
  return new Promise((coz, reddet) => {
    let veri = '';
    istek.setEncoding('utf8');
    istek.on('data', parca => {
      veri += parca;
      if (veri.length > 10_000) { reddet(new Error('govde cok buyuk')); istek.destroy(); }
    });
    istek.on('end', () => {
      try { coz(veri ? JSON.parse(veri) : {}); } catch { reddet(new Error('gecersiz JSON')); }
    });
    istek.on('error', reddet);
  });
}

function json(yanit, kod, nesne) {
  yanit.writeHead(kod, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  yanit.end(JSON.stringify(nesne));
}

function yayinla(tur, veri) {
  const mesaj = `event: ${tur}\ndata: ${JSON.stringify(veri)}\n\n`;
  for (const d of dinleyiciler) d.write(mesaj);
}

async function olaylariKaydet() {
  await mkdir(path.dirname(VERI_DOSYASI), { recursive: true });
  await writeFile(VERI_DOSYASI, JSON.stringify(olaylar.slice(-OLAY_SINIRI), null, 2));
}

async function olaylariYukle() {
  try {
    olaylar = JSON.parse(await readFile(VERI_DOSYASI, 'utf8'));
  } catch {
    olaylar = [];
  }
}

const saat = () => new Date().toLocaleTimeString('tr-TR');

// Cihazdan gelen konum/panik govdesini dogrular ve araci gunceller.
function cihazVerisiIsle(govde) {
  const plaka = plakaDuzelt(govde.plaka);
  if (!plaka) return { hata: 'plaka gecersiz (2-20 karakter, harf/rakam/bosluk)' };
  const enlem = koordinat(govde.enlem, 90);
  const boylam = koordinat(govde.boylam, 180);
  if (enlem === undefined || boylam === undefined) return { hata: 'enlem/boylam gecersiz' };
  const kaynak = ['gps', 'sabit', 'yok', 'simulasyon'].includes(govde.kaynak) ? govde.kaynak : 'bilinmiyor';

  const simdi = Date.now();
  let arac = araclar.get(plaka);
  if (!arac) {
    arac = { plaka, enlem: null, boylam: null, kaynak, sonGorulme: simdi, iz: [], panikId: null };
    araclar.set(plaka, arac);
    console.log(`[${saat()}] Yeni arac: ${plaka}`);
  }
  arac.sonGorulme = simdi;
  arac.kaynak = kaynak;
  if (enlem !== null && boylam !== null) {
    arac.enlem = enlem;
    arac.boylam = boylam;
    arac.iz.push([enlem, boylam, simdi]);
    if (arac.iz.length > IZ_UZUNLUGU) arac.iz.splice(0, arac.iz.length - IZ_UZUNLUGU);
  }
  return { arac };
}

// ------------------------------------------------------------------- API

async function api(istek, yanit, yol) {
  if (istek.method === 'GET' && yol === '/api/durum') {
    return json(yanit, 200, { araclar: [...araclar.values()], olaylar: olaylar.slice(-100) });
  }

  if (istek.method === 'GET' && yol === '/api/akis') {
    yanit.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    yanit.write('retry: 2000\n\n');
    dinleyiciler.add(yanit);
    const nabiz = setInterval(() => yanit.write(': nabiz\n\n'), 20_000);
    istek.on('close', () => { clearInterval(nabiz); dinleyiciler.delete(yanit); });
    return;
  }

  if (istek.method === 'POST' && (yol === '/api/konum' || yol === '/api/panik')) {
    if (istek.headers['x-cihaz-anahtari'] !== CIHAZ_ANAHTARI) {
      console.log(`[${saat()}] Reddedildi: yanlis cihaz anahtari (${istek.socket.remoteAddress})`);
      return json(yanit, 401, { hata: 'cihaz anahtari yanlis' });
    }
    let govde;
    try { govde = await govdeOku(istek); } catch (e) { return json(yanit, 400, { hata: e.message }); }
    const { hata, arac } = cihazVerisiIsle(govde);
    if (hata) return json(yanit, 400, { hata });

    if (yol === '/api/konum') {
      yayinla('konum', arac);
      return json(yanit, 200, { tamam: true });
    }

    const olay = {
      id: randomUUID(),
      plaka: arac.plaka,
      enlem: arac.enlem,
      boylam: arac.boylam,
      kaynak: arac.kaynak,
      zaman: Date.now(),
      onaylandi: false,
      onayZamani: null,
    };
    olaylar.push(olay);
    arac.panikId = olay.id;
    console.log(`\x1b[41m\x1b[97m [${saat()}] PANIK! ${arac.plaka}  konum: ${arac.enlem ?? '?'}, ${arac.boylam ?? '?'} \x1b[0m`);
    yayinla('panik', { olay, arac });
    await olaylariKaydet();
    return json(yanit, 200, { tamam: true, id: olay.id });
  }

  const onay = yol.match(/^\/api\/olay\/([0-9a-f-]{36})\/onayla$/);
  if (istek.method === 'POST' && onay) {
    const olay = olaylar.find(o => o.id === onay[1]);
    if (!olay) return json(yanit, 404, { hata: 'olay bulunamadi' });
    if (!olay.onaylandi) {
      olay.onaylandi = true;
      olay.onayZamani = Date.now();
      const arac = araclar.get(olay.plaka);
      if (arac && arac.panikId === olay.id) arac.panikId = null;
      console.log(`[${saat()}] Onaylandi: ${olay.plaka}`);
      yayinla('onay', { olay, arac: arac ?? null });
      await olaylariKaydet();
    }
    return json(yanit, 200, { tamam: true });
  }

  json(yanit, 404, { hata: 'bulunamadi' });
}

// --------------------------------------------------------- statik dosyalar

const TURLER = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function statik(yanit, yol) {
  let dosya = path.normalize(path.join(GENEL, decodeURIComponent(yol)));
  if (dosya !== GENEL + path.sep && !dosya.startsWith(GENEL + path.sep)) { yanit.writeHead(403); return yanit.end(); }
  if (yol.endsWith('/')) dosya = path.join(dosya, 'index.html');
  try {
    const icerik = await readFile(dosya);
    yanit.writeHead(200, { 'Content-Type': TURLER[path.extname(dosya)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    yanit.end(icerik);
  } catch {
    yanit.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    yanit.end('Bulunamadi');
  }
}

// ------------------------------------------------------------------ baslat

const sunucu = http.createServer(async (istek, yanit) => {
  const yol = new URL(istek.url, 'http://x').pathname;
  try {
    if (yol.startsWith('/api/')) await api(istek, yanit, yol);
    else if (yol === '/rehber') { yanit.writeHead(301, { Location: '/rehber/' }); yanit.end(); }
    else await statik(yanit, yol);
  } catch (e) {
    console.error(e);
    if (!yanit.headersSent) json(yanit, 500, { hata: 'sunucu hatasi' });
  }
});

await olaylariYukle();
sunucu.listen(PORT, '0.0.0.0', () => {
  const ipler = Object.values(os.networkInterfaces()).flat()
    .filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log('\nPanik butonu sunucusu calisiyor.\n');
  console.log(`  Panel   : http://localhost:${PORT}/`);
  console.log(`  Rehber  : http://localhost:${PORT}/rehber/`);
  console.log('\n  ESP32 kodunda SUNUCU satirina bunlardan birini yaz:');
  for (const ip of ipler) console.log(`    const char* SUNUCU = "http://${ip}:${PORT}";`);
  console.log(`\n  Cihaz anahtari: ${CIHAZ_ANAHTARI}\n`);
});
