// Panik butonu sunucusu v2.1 - ek paket gerektirmez (Node 18+).
//   node server.js
//
// Cihaz (ESP32) uç noktaları - "X-Cihaz-Anahtari" başlığı ister:
//   POST /api/konum   canlı konum.  Cevap satır satır: D=normal|panik|goruldu, M=mesaj, K=bip
//   POST /api/panik   panik başlat (açık olay varsa "tekrar basıldı" olarak eklenir)
//   POST /api/iptal   cihazdan iptal (yanlış alarm)
// Panel uç noktaları - PANEL_SIFRE verilmişse tarayıcı şifre sorar:
//   GET  /api/durum, GET /api/akis (canlı akış), GET /api/olaylar.csv, GET /api/adres?enlem=&boylam=
//   POST /api/arac (kaydet/güncelle), DELETE /api/arac/:plaka, POST /api/arac/:plaka/komut
//   POST /api/olay/:id/gor | /kapat | /not | /asistan | /rapor
//   POST /api/asistan/soru

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  asistanAcik, adresAcik, GEMINI_MODEL, AsistanHatasi, olayOnerisi, olayRaporu, soruSor, adresBul,
} from './asistan.js';

const KOK = path.dirname(fileURLToPath(import.meta.url));
const GENEL = path.join(KOK, 'public');
const VERI_DIZINI = path.join(KOK, 'veri');
const DURUM_DOSYASI = path.join(VERI_DIZINI, 'durum.json');

const PORT = Number(process.env.PORT) || 3000;
const CIHAZ_ANAHTARI = process.env.CIHAZ_ANAHTARI || 'panik-1234'; // ESP32'dekiyle aynı olmalı
const PANEL_SIFRE = process.env.PANEL_SIFRE || '';                  // boşsa panel şifresiz
const ASISTAN_OTOMATIK = process.env.ASISTAN_OTOMATIK !== 'kapali'; // panik gelince asistan kendiliğinden öneri versin mi
const IZ_SINIRI = 3000;      // araç başına saklanan konum noktası
const OLAY_SINIRI = 1000;    // saklanan olay sayısı
const KOMUT_SINIRI = 20;     // araç başına saklanan komut sayısı
const KOPMA_MS = 20000;      // panik sürerken bu kadar sinyal gelmezse "bağlantı koptu"

/** plaka -> araç */
const araclar = new Map();
/** {id, surum, plaka, durum: acik|goruldu|kapandi|iptal, zaman, enlem, boylam, kaynak, adres, kopuk,
 *   gecmis: [{zaman, tur, metin, kim}], asistan, asistanDurumu, rapor, raporDurumu} */
let olaylar = [];
const dinleyiciler = new Set();

// ================================================================ yardımcılar

const saat = (t = Date.now()) => new Date(t).toLocaleTimeString('tr-TR');

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

const metin = (deger, sinir) => (typeof deger === 'string' ? deger.trim().slice(0, sinir) : '');

// Cihaza giden mesajlarda Türkçe harf olmasın: ASCII'ye çevir
const TR = { ç: 'c', ğ: 'g', ı: 'i', İ: 'I', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', Ö: 'O', Ş: 'S', Ü: 'U' };
const asciiYap = s => s.replace(/[çğıİöşüÇĞÖŞÜ]/g, h => TR[h]).replace(/[^\x20-\x7E]/g, '').trim();

function mesafeM([e1, b1], [e2, b2]) {
  const R = 6371000, r = Math.PI / 180;
  const a = Math.sin((e2 - e1) * r / 2) ** 2 + Math.cos(e1 * r) * Math.cos(e2 * r) * Math.sin((b2 - b1) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function govdeOku(istek) {
  return new Promise((coz, reddet) => {
    let veri = '';
    istek.setEncoding('utf8');
    istek.on('data', parca => {
      veri += parca;
      if (veri.length > 20_000) { reddet(new Error('govde cok buyuk')); istek.destroy(); }
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

function duzMetin(yanit, kod, satirlar) {
  yanit.writeHead(kod, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  yanit.end(satirlar.join('\n') + '\n');
}

function yayinla(tur, veri) {
  const mesaj = `event: ${tur}\ndata: ${JSON.stringify(veri)}\n\n`;
  for (const d of dinleyiciler) d.write(mesaj);
}

// ================================================================ veri

function yeniArac(plaka) {
  return {
    plaka, sahip: '', telefon: '', arac: '', not: '',
    enlem: null, boylam: null, kaynak: null, hiz: null, rssi: null, surum: null, sure: null,
    sonGorulme: null, iz: [], komutlar: [],
  };
}

// Panele giden araç bilgisi; konum geçmişi (iz) ağır olduğu için ayrı gönderilir
const aracOzet = a => ({ ...a, iz: undefined });

const acikOlay = plaka => olaylar.findLast(o => o.plaka === plaka && (o.durum === 'acik' || o.durum === 'goruldu'));

function cihazDurumu(plaka) {
  const o = acikOlay(plaka);
  return !o ? 'normal' : o.durum === 'goruldu' ? 'goruldu' : 'panik';
}

let kayitZinciri = Promise.resolve();
let kayitZamanlayici = null;

async function diskeYaz() {
  const veri = JSON.stringify({ surum: 2, araclar: [...araclar.values()], olaylar: olaylar.slice(-OLAY_SINIRI) });
  await mkdir(VERI_DIZINI, { recursive: true });
  const gecici = DURUM_DOSYASI + '.tmp';
  await writeFile(gecici, veri);
  try { await rename(gecici, DURUM_DOSYASI); } catch { await writeFile(DURUM_DOSYASI, veri); }
}

// hemen=true: olaylar gibi önemli değişiklikler. Yoksa 3 sn içindeki değişiklikler tek yazımda toplanır.
function kaydet(hemen = false) {
  clearTimeout(kayitZamanlayici);
  const yaz = () => { kayitZinciri = kayitZinciri.then(diskeYaz).catch(e => console.error('Kayit hatasi:', e.message)); };
  if (hemen) yaz(); else kayitZamanlayici = setTimeout(yaz, 3000);
}

async function yukle() {
  try {
    const veri = JSON.parse(await readFile(DURUM_DOSYASI, 'utf8'));
    for (const a of veri.araclar || []) araclar.set(a.plaka, { ...yeniArac(a.plaka), ...a });
    olaylar = veri.olaylar || [];
    // yarıda kalmış asistan işleri yeniden başlatılınca "çalışıyor" görünmesin
    for (const o of olaylar) {
      if (o.asistanDurumu === 'calisiyor') o.asistanDurumu = null;
      if (o.raporDurumu === 'calisiyor') o.raporDurumu = null;
    }
    console.log(`Kayitli veri yuklendi: ${araclar.size} arac, ${olaylar.length} olay.`);
  } catch {
    // ilk çalıştırma: dosya yok
  }
}

function aracAl(plaka) {
  let a = araclar.get(plaka);
  if (!a) {
    a = yeniArac(plaka);
    araclar.set(plaka, a);
    console.log(`[${saat()}] Yeni arac: ${plaka}`);
  }
  return a;
}

function olayGecmisi(olay, tur, metinDeger, kim = '') {
  olay.gecmis.push({ zaman: Date.now(), tur, metin: metinDeger, kim });
}

// Her değişiklikte sürüm artar; panel eski kopyaları bununla ayırt eder
function olayDegisti(olay) {
  olay.surum = (olay.surum || 0) + 1;
  yayinla('olay', olay);
  kaydet(true);
}

// ================================================================ asistan + adres

async function asistanCalistir(olay) {
  if (!asistanAcik() || olay.asistanDurumu === 'calisiyor') return;
  olay.asistanDurumu = 'calisiyor';
  olay.asistanHata = null;
  olayDegisti(olay);
  try {
    olay.asistan = await olayOnerisi(olay, araclar.get(olay.plaka));
    olay.asistanDurumu = 'tamam';
  } catch (e) {
    olay.asistanDurumu = 'hata';
    olay.asistanHata = e.message;
    console.log(`[${saat()}] Asistan hatasi: ${e.message}`);
  }
  olayDegisti(olay);
}

async function raporOlustur(olay) {
  if (olay.raporDurumu === 'calisiyor') return;
  olay.raporDurumu = 'calisiyor';
  olay.raporHata = null;
  olayDegisti(olay);
  try {
    olay.rapor = await olayRaporu(olay, araclar.get(olay.plaka));
    olay.raporDurumu = 'tamam';
  } catch (e) {
    olay.raporDurumu = 'hata';
    olay.raporHata = e.message;
  }
  olayDegisti(olay);
}

// Yeni panikte: önce adresi bul, sonra (açıksa) asistandan öneri iste
async function yeniPanikIsleri(olay) {
  if (olay.enlem != null) {
    const adres = await adresBul(olay.enlem, olay.boylam);
    if (adres) { olay.adres = adres; olayDegisti(olay); }
  }
  if (ASISTAN_OTOMATIK) await asistanCalistir(olay);
}

// Panik sürerken cihazdan sinyal kesilirse olaya yaz ve panele haber ver
setInterval(() => {
  const simdi = Date.now();
  for (const o of olaylar) {
    if (o.durum !== 'acik' && o.durum !== 'goruldu') continue;
    const a = araclar.get(o.plaka);
    if (!a || !a.sonGorulme) continue;
    const kopuk = simdi - a.sonGorulme > KOPMA_MS;
    if (kopuk && !o.kopuk) {
      o.kopuk = true;
      olayGecmisi(o, 'baglanti', `Cihazla bağlantı koptu (son sinyal ${saat(a.sonGorulme)})`);
      console.log(`[${saat()}] Baglanti koptu: ${o.plaka}`);
      olayDegisti(o);
    } else if (!kopuk && o.kopuk) {
      o.kopuk = false;
      olayGecmisi(o, 'baglanti', 'Cihazla bağlantı geri geldi');
      olayDegisti(o);
    }
  }
}, 5000);

// ================================================================ cihaz uç noktaları

// Cihazdan gelen konum/telemetriyi işler. Hata varsa metin döner.
function telemetri(govde) {
  const plaka = plakaDuzelt(govde.plaka);
  if (!plaka) return { hata: 'plaka gecersiz (2-20 karakter, harf/rakam/bosluk)' };
  const enlem = koordinat(govde.enlem, 90);
  const boylam = koordinat(govde.boylam, 180);
  if (enlem === undefined || boylam === undefined) return { hata: 'enlem/boylam gecersiz' };

  const a = aracAl(plaka);
  const simdi = Date.now();
  let nokta = null;
  if (enlem !== null && boylam !== null) {
    const son = a.iz.at(-1);
    let hiz = Number(govde.hiz);
    hiz = Number.isFinite(hiz) && hiz >= 0 && hiz < 400 ? hiz : null;
    const mesafe = son ? mesafeM(son, [enlem, boylam]) : Infinity;
    if (hiz === null && son && simdi > son[2]) hiz = (mesafe / ((simdi - son[2]) / 1000)) * 3.6;
    a.hiz = hiz === null ? null : Math.round(hiz * 10) / 10;
    // yerinde duruyorsa yeni nokta ekleme, son noktanın zamanını güncelle
    if (son && mesafe < 3) son[2] = simdi;
    else {
      a.iz.push([enlem, boylam, simdi]);
      if (a.iz.length > IZ_SINIRI) a.iz.splice(0, a.iz.length - IZ_SINIRI);
    }
    nokta = a.iz.at(-1);
    a.enlem = enlem;
    a.boylam = boylam;
  }
  a.kaynak = ['gps', 'sabit', 'yok', 'simulasyon'].includes(govde.kaynak) ? govde.kaynak : 'bilinmiyor';
  const rssi = Number(govde.rssi);
  a.rssi = Number.isInteger(rssi) && rssi < 0 && rssi > -130 ? rssi : null;
  a.surum = metin(govde.surum, 12) || null;
  const sure = Number(govde.sure);
  a.sure = Number.isFinite(sure) && sure >= 0 ? Math.floor(sure) : null;
  a.sonGorulme = simdi;
  return { arac: a, nokta };
}

// Cihaza cevap: olay durumu + bekleyen komutlar (bir kez iletilir)
function cihazCevabi(a) {
  const satirlar = [`D=${cihazDurumu(a.plaka)}`];
  const olay = acikOlay(a.plaka);
  let degisti = false;
  for (const k of a.komutlar) {
    if (k.durum !== 'bekliyor') continue;
    satirlar.push(k.tur === 'mesaj' ? `M=${k.cihazMetni}` : 'K=bip');
    k.durum = 'iletildi';
    k.iletimZamani = Date.now();
    degisti = true;
    if (olay) olayGecmisi(olay, 'iletildi', k.tur === 'mesaj' ? `Mesaj cihaza ulaştı: "${k.metin}"` : 'Öttürme komutu cihaza ulaştı');
  }
  if (degisti) {
    if (olay) olayDegisti(olay);
    else kaydet(true);
  }
  return satirlar;
}

async function cihazIstegi(istek, yanit, yol) {
  if (istek.headers['x-cihaz-anahtari'] !== CIHAZ_ANAHTARI) {
    console.log(`[${saat()}] Reddedildi: yanlis cihaz anahtari (${istek.socket.remoteAddress})`);
    return json(yanit, 401, { hata: 'cihaz anahtari yanlis' });
  }
  let govde;
  try { govde = await govdeOku(istek); } catch (e) { return json(yanit, 400, { hata: e.message }); }
  const { hata, arac: a, nokta } = telemetri(govde);
  if (hata) return json(yanit, 400, { hata });

  if (yol === '/api/panik') {
    let olay = acikOlay(a.plaka);
    if (olay) {
      olay.durum = 'acik';  // görülmüş olsa bile tekrar basıldıysa yeniden alarm
      olayGecmisi(olay, 'tekrar', 'Butona tekrar basıldı');
      olayDegisti(olay);
    } else {
      olay = {
        id: randomUUID(), surum: 0, plaka: a.plaka, durum: 'acik', zaman: Date.now(),
        enlem: a.enlem, boylam: a.boylam, kaynak: a.kaynak, adres: null, kopuk: false, gecmis: [],
      };
      olayGecmisi(olay, 'panik', `Panik butonuna basıldı (konum: ${a.kaynak})`);
      olaylar.push(olay);
      if (olaylar.length > OLAY_SINIRI) olaylar.splice(0, olaylar.length - OLAY_SINIRI);
      olayDegisti(olay);
      yeniPanikIsleri(olay).catch(e => console.error('Panik isleri:', e.message));
    }
    console.log(`\x1b[41m\x1b[97m [${saat()}] PANIK! ${a.plaka} ${a.sahip ? '(' + a.sahip + ') ' : ''}konum: ${a.enlem ?? '?'}, ${a.boylam ?? '?'} \x1b[0m`);
  } else if (yol === '/api/iptal') {
    const olay = acikOlay(a.plaka);
    if (olay) {
      olay.durum = 'iptal';
      olayGecmisi(olay, 'iptal', 'Cihazdan iptal edildi (yanlış alarm)');
      console.log(`[${saat()}] Iptal: ${a.plaka} (yanlis alarm)`);
      olayDegisti(olay);
    }
  } else {
    kaydet();
  }

  const satirlar = cihazCevabi(a);
  yayinla('arac', { arac: aracOzet(a), nokta });
  duzMetin(yanit, 200, satirlar);
}

// ================================================================ panel uç noktaları

function panelIzni(istek) {
  if (!PANEL_SIFRE) return true;
  const [tur, deger] = (istek.headers.authorization || '').split(' ');
  if (tur !== 'Basic' || !deger) return false;
  const sifre = Buffer.from(deger, 'base64').toString().split(':').slice(1).join(':');
  const a = Buffer.from(sifre), b = Buffer.from(PANEL_SIFRE);
  return a.length === b.length && timingSafeEqual(a, b);
}

function csv(yanit) {
  const hucre = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const baslik = ['Zaman', 'Plaka', 'Sahip', 'Telefon', 'Durum', 'Adres', 'Enlem', 'Boylam', 'Tepki (sn)', 'Gecmis', 'Rapor'];
  const satirlar = [baslik.map(hucre).join(';')];
  for (const o of [...olaylar].reverse()) {
    const a = araclar.get(o.plaka) || {};
    const gor = o.gecmis.find(g => g.tur === 'goruldu');
    satirlar.push([
      new Date(o.zaman).toLocaleString('tr-TR'), o.plaka, a.sahip, a.telefon, o.durum, o.adres, o.enlem, o.boylam,
      gor ? Math.round((gor.zaman - o.zaman) / 1000) : '',
      o.gecmis.map(g => `${saat(g.zaman)} ${g.metin}${g.kim ? ' (' + g.kim + ')' : ''}`).join(' | '),
      o.rapor?.metin || '',
    ].map(hucre).join(';'));
  }
  yanit.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="panik-olaylari.csv"' });
  yanit.end('﻿' + satirlar.join('\r\n'));  // BOM: Excel Türkçe karakterleri doğru açsın
}

async function panelIstegi(istek, yanit, yol, url) {
  const y = istek.method;

  if (y === 'GET' && yol === '/api/durum') {
    return json(yanit, 200, {
      araclar: [...araclar.values()],
      olaylar: olaylar.slice(-300),
      ozellikler: { asistan: asistanAcik(), model: asistanAcik() ? GEMINI_MODEL : null, adres: adresAcik() },
    });
  }

  if (y === 'GET' && yol === '/api/akis') {
    yanit.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    yanit.write('retry: 2000\n\n');
    dinleyiciler.add(yanit);
    const nabiz = setInterval(() => yanit.write(': nabiz\n\n'), 20_000);
    istek.on('close', () => { clearInterval(nabiz); dinleyiciler.delete(yanit); });
    return;
  }

  if (y === 'GET' && yol === '/api/olaylar.csv') return csv(yanit);

  if (y === 'GET' && yol === '/api/adres') {
    const enlem = koordinat(url.searchParams.get('enlem'), 90), boylam = koordinat(url.searchParams.get('boylam'), 180);
    if (enlem == null || boylam == null) return json(yanit, 400, { hata: 'enlem/boylam gerekli' });
    return json(yanit, 200, { adres: await adresBul(enlem, boylam) });
  }

  let govde = {};
  if (y === 'POST') {
    try { govde = await govdeOku(istek); } catch (e) { return json(yanit, 400, { hata: e.message }); }
  }
  const kim = metin(govde.kim, 40);

  // asistana serbest soru
  if (y === 'POST' && yol === '/api/asistan/soru') {
    const soru = metin(govde.soru, 300);
    if (!soru) return json(yanit, 400, { hata: 'Soru boş.' });
    try {
      return json(yanit, 200, { cevap: await soruSor(soru, olaylar, [...araclar.values()]) });
    } catch (e) {
      return json(yanit, e instanceof AsistanHatasi ? e.kod : 500, { hata: e.message });
    }
  }

  // araç kaydı: oluştur / güncelle
  if (y === 'POST' && yol === '/api/arac') {
    const plaka = plakaDuzelt(govde.plaka);
    if (!plaka) return json(yanit, 400, { hata: 'Plaka geçersiz. Harf, rakam ve boşluk kullan (2-20 karakter).' });
    const a = aracAl(plaka);
    a.sahip = metin(govde.sahip, 60);
    a.telefon = metin(govde.telefon, 30);
    a.arac = metin(govde.arac, 60);
    a.not = metin(govde.not, 300);
    yayinla('arac', { arac: aracOzet(a), nokta: null });
    kaydet(true);
    return json(yanit, 200, { arac: aracOzet(a) });
  }

  const aracYolu = yol.match(/^\/api\/arac\/([^/]+)(\/komut)?$/);
  if (aracYolu) {
    let plaka;
    try { plaka = plakaDuzelt(decodeURIComponent(aracYolu[1])); } catch { plaka = null; }
    const a = plaka && araclar.get(plaka);
    if (!a) return json(yanit, 404, { hata: 'araç bulunamadı' });

    if (y === 'DELETE' && !aracYolu[2]) {
      araclar.delete(plaka);
      yayinla('arac-sil', { plaka });
      kaydet(true);
      return json(yanit, 200, { tamam: true });
    }

    if (y === 'POST' && aracYolu[2]) {
      const tur = govde.tur === 'mesaj' ? 'mesaj' : govde.tur === 'bip' ? 'bip' : null;
      if (!tur) return json(yanit, 400, { hata: 'komut türü bip ya da mesaj olmalı' });
      const yazi = metin(govde.metin, 120);
      const cihazMetni = asciiYap(yazi).slice(0, 80);
      if (tur === 'mesaj' && !cihazMetni) return json(yanit, 400, { hata: 'mesaj boş' });
      const k = { id: randomUUID(), tur, metin: yazi, cihazMetni, kim, zaman: Date.now(), durum: 'bekliyor', iletimZamani: null };
      a.komutlar.push(k);
      if (a.komutlar.length > KOMUT_SINIRI) a.komutlar.splice(0, a.komutlar.length - KOMUT_SINIRI);
      const olay = acikOlay(a.plaka);
      if (olay) {
        olayGecmisi(olay, 'komut', tur === 'mesaj' ? `Mesaj gönderildi: "${yazi}"` : 'Cihaz öttürüldü', kim);
        olayDegisti(olay);
      }
      yayinla('arac', { arac: aracOzet(a), nokta: null });
      kaydet(true);
      return json(yanit, 200, { komut: k });
    }
  }

  const olayYolu = yol.match(/^\/api\/olay\/([0-9a-f-]{36})\/(gor|kapat|not|asistan|rapor)$/);
  if (y === 'POST' && olayYolu) {
    const olay = olaylar.find(o => o.id === olayYolu[1]);
    if (!olay) return json(yanit, 404, { hata: 'olay bulunamadı' });
    const islem = olayYolu[2];

    if (islem === 'asistan' || islem === 'rapor') {
      if (!asistanAcik()) return json(yanit, 503, { hata: 'Asistan kapalı: sunucuyu GEMINI_API_KEY ile başlat (README).' });
      // uzun sürer: hemen cevap ver, sonuç canlı akıştan gelsin
      (islem === 'asistan' ? asistanCalistir(olay) : raporOlustur(olay)).catch(e => console.error(e));
      return json(yanit, 202, { olay });
    }

    const not = metin(govde.not, 300);
    const acik = olay.durum === 'acik' || olay.durum === 'goruldu';
    if (islem === 'gor' && olay.durum === 'acik') {
      olay.durum = 'goruldu';
      olayGecmisi(olay, 'goruldu', not ? `Görüldü: ${not}` : 'Görüldü, cihaza "yardım geliyor" bildirildi', kim);
      console.log(`[${saat()}] Goruldu: ${olay.plaka}${kim ? ' (' + kim + ')' : ''}`);
    } else if (islem === 'kapat' && acik) {
      olay.durum = 'kapandi';
      olayGecmisi(olay, 'kapandi', not ? `Kapatıldı: ${not}` : 'Olay kapatıldı', kim);
      console.log(`[${saat()}] Kapatildi: ${olay.plaka}`);
    } else if (islem === 'not' && not) {
      olayGecmisi(olay, 'not', not, kim);
    } else {
      return json(yanit, 409, { hata: 'bu işlem olayın şu anki durumunda yapılamaz', olay });
    }
    olayDegisti(olay);
    return json(yanit, 200, { olay });
  }

  json(yanit, 404, { hata: 'bulunamadı' });
}

// ================================================================ statik dosyalar

const TURLER = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
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

// ================================================================ başlat

const CIHAZ_YOLLARI = new Set(['/api/konum', '/api/panik', '/api/iptal']);

const sunucu = http.createServer(async (istek, yanit) => {
  const url = new URL(istek.url, 'http://x');
  const yol = url.pathname;
  try {
    if (istek.method === 'POST' && CIHAZ_YOLLARI.has(yol)) return await cihazIstegi(istek, yanit, yol);
    // 3D rehber herkese açık; panel ve panel API'si şifreli olabilir
    const acik = yol.startsWith('/rehber');
    if (!acik && !panelIzni(istek)) {
      yanit.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Panik Paneli", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' });
      return yanit.end('Panel sifresi gerekli');
    }
    if (yol.startsWith('/api/')) await panelIstegi(istek, yanit, yol, url);
    else if (yol === '/rehber') { yanit.writeHead(301, { Location: '/rehber/' }); yanit.end(); }
    else await statik(yanit, yol);
  } catch (e) {
    console.error(e);
    if (!yanit.headersSent) json(yanit, 500, { hata: 'sunucu hatasi' });
  }
});

await yukle();
sunucu.listen(PORT, '0.0.0.0', () => {
  const ipler = Object.values(os.networkInterfaces()).flat()
    .filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log('\nPanik butonu sunucusu v2.1 calisiyor.\n');
  console.log(`  Panel   : http://localhost:${PORT}/${PANEL_SIFRE ? '   (sifreli: kullanici adi farketmez)' : ''}`);
  console.log(`  Rehber  : http://localhost:${PORT}/rehber/`);
  console.log('\n  ESP32 kurulum sayfasinda sunucu adresi olarak bunlardan birini yaz:');
  for (const ip of ipler) console.log(`    http://${ip}:${PORT}`);
  console.log(`\n  Cihaz anahtari : ${CIHAZ_ANAHTARI}`);
  console.log(`  Asistan        : ${asistanAcik() ? `acik (Gemini, ${GEMINI_MODEL})` : 'kapali (acmak icin GEMINI_API_KEY, README)'}`);
  console.log(`  Adres bulma    : ${adresAcik() ? 'acik (OpenStreetMap)' : 'kapali'}`);
  if (!PANEL_SIFRE) console.log('  Panel sifresiz. Sifre icin: PANEL_SIFRE ortam degiskenini ayarla (README).');
  console.log('');
});
