// Yapay zekâ asistanı (Google Gemini API) ve adres bulma (OpenStreetMap Nominatim).
// İkisi de isteğe bağlı; ek paket gerekmez.
//
// Gizlilik: Gemini'ye plaka, sahip adı ve telefon GÖNDERİLMEZ. Araçlar "Araç 1, Araç 2" diye
// takma adla gider; cevaptaki takma adlar burada gerçek plakaya geri çevrilir.
// Gemini'nin ücretsiz katmanında gönderilen veriler Google tarafından ürün geliştirmede kullanılabilir.

const GEMINI_ANAHTAR = process.env.GEMINI_API_KEY || '';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const GEMINI_ADRES = process.env.GEMINI_URL || 'https://generativelanguage.googleapis.com/v1beta';
const ADRES_ACIK = process.env.ADRES === 'acik';  // varsayılan kapalı: açıksa konum OpenStreetMap'e gider
const NOMINATIM = process.env.ADRES_URL || 'https://nominatim.openstreetmap.org';

export const asistanAcik = () => Boolean(GEMINI_ANAHTAR);
export const adresAcik = () => ADRES_ACIK;

export class AsistanHatasi extends Error {
  constructor(mesaj, kod = 502) { super(mesaj); this.kod = kod; }
}

const SISTEM = [
  'Sen, araçlara takılan bir panik butonu sisteminde acil durum operatörüne yardım eden bir asistansın.',
  'Her zaman Türkçe yaz. Kısa, net ve sakin ol.',
  'Sadece sana verilen verilere dayan; verilmeyen bilgiyi (isim, telefon, olayın nedeni gibi) uydurma.',
  'Hayati tehlike ihtimali varsa operatöre 112 Acil Çağrı Merkezini aramasını hatırlat.',
  'Araçlardan sadece sana verilen takma adlarla ("Araç 1" gibi) bahset.',
].join(' ');

// ------------------------------------------------------------------ Gemini
async function gemini(istem, sema) {
  if (!GEMINI_ANAHTAR) throw new AsistanHatasi('Asistan kapalı: sunucuyu GEMINI_API_KEY ile başlat (README).', 503);
  const govde = {
    systemInstruction: { parts: [{ text: SISTEM }] },
    contents: [{ role: 'user', parts: [{ text: istem }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1500,
      ...(sema ? { responseMimeType: 'application/json', responseSchema: sema } : {}),
    },
  };
  let r;
  try {
    r = await fetch(`${GEMINI_ADRES}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_ANAHTAR },
      body: JSON.stringify(govde),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new AsistanHatasi(`Gemini'ye ulaşılamadı (${e.name === 'TimeoutError' ? 'zaman aşımı' : e.cause?.code || e.message}). İnternet bağlantısını kontrol et.`);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = j.error?.message || '';
    if (r.status === 429) throw new AsistanHatasi('Gemini ücretsiz kotası doldu. Biraz bekleyip tekrar dene; günlük kota gece sıfırlanır.', 429);
    if (r.status === 400 && /api key/i.test(m)) throw new AsistanHatasi('Gemini API anahtarı geçersiz. Google AI Studio\'dan aldığın anahtarı kontrol et.', 401);
    if (r.status === 403) throw new AsistanHatasi('Bu API anahtarının Gemini\'yi kullanma izni yok.', 403);
    if (r.status === 404) throw new AsistanHatasi(`"${GEMINI_MODEL}" modeli bulunamadı. GEMINI_MODEL ile başka bir model seç (README).`, 404);
    throw new AsistanHatasi(`Gemini hatası (${r.status}): ${m.slice(0, 200)}`);
  }
  const aday = j.candidates?.[0];
  const metin = (aday?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
  if (!metin) {
    const neden = aday?.finishReason || j.promptFeedback?.blockReason || 'boş cevap';
    throw new AsistanHatasi(`Gemini cevap vermedi (${neden}).`);
  }
  if (!sema) return metin;
  try {
    return JSON.parse(metin.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    throw new AsistanHatasi('Gemini beklenen biçimde cevap vermedi, tekrar dene.');
  }
}

// ------------------------------------------------------------------ veriyi anonimleştirme
const DURUM = { acik: 'açık (henüz görülmedi)', goruldu: 'görüldü', kapandi: 'kapandı', iptal: 'cihazdan iptal edildi' };
const saatTR = t => new Date(t).toLocaleTimeString('tr-TR');
const tarihTR = t => new Date(t).toLocaleString('tr-TR');
const sn = ms => `${Math.round(ms / 1000)} sn`;

function tepkiSuresi(olay) {
  const g = olay.gecmis.find(x => x.tur === 'goruldu');
  return g ? g.zaman - olay.zaman : null;
}

// Tek olay: plaka/isim/telefon yok, operatör adları yok
function olayMetni(olay, arac) {
  const satirlar = [
    'Araç: Araç 1',
    `Olay durumu: ${DURUM[olay.durum] || olay.durum}`,
    `Başlangıç: ${tarihTR(olay.zaman)} (şu an: ${tarihTR(Date.now())})`,
    `Konum kaynağı: ${olay.kaynak === 'sabit' ? 'sabit konum (GPS yok, gerçek konum bilinmiyor)' : olay.kaynak}`,
    `Yaklaşık adres: ${olay.adres || 'bilinmiyor'}`,
  ];
  if (arac) {
    satirlar.push(`Cihazdan son sinyal: ${arac.sonGorulme ? sn(Date.now() - arac.sonGorulme) + ' önce' : 'yok'}`);
    if (arac.hiz != null) satirlar.push(`Son hız: ${arac.hiz} km/s`);
    if (arac.rssi != null) satirlar.push(`Wi-Fi sinyali: ${arac.rssi} dBm`);
  }
  const tepki = tepkiSuresi(olay);
  if (tepki != null) satirlar.push(`Operatör tepki süresi: ${sn(tepki)}`);
  satirlar.push('Zaman çizelgesi (başlangıçtan itibaren):');
  for (const g of olay.gecmis) satirlar.push(`  +${sn(g.zaman - olay.zaman)} ${g.metin}`);
  return satirlar.join('\n');
}

// ------------------------------------------------------------------ asistan işlevleri
const ONERI_SEMASI = {
  type: 'OBJECT',
  properties: {
    ozet: { type: 'STRING', description: 'Durumun 1-2 cümlelik özeti' },
    oneriler: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Operatörün şimdi yapması gereken 2-4 somut adım, en önemlisi önce' },
    mesajlar: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Sürücünün araçtaki küçük ekranında gösterilecek 3 kısa mesaj, her biri en fazla 50 karakter' },
  },
  required: ['ozet', 'oneriler', 'mesajlar'],
};

export async function olayOnerisi(olay, arac) {
  const cevap = await gemini(
    'Aşağıdaki panik olayını değerlendir.\n'
    + '- ozet: durumun 1-2 cümlelik özeti (ne oldu, ne kadar süredir, şu an ne durumda).\n'
    + '- oneriler: operatörün şimdi yapması gereken 2-4 somut adım. Sürücüyü telefonla aramayı ve gerekirse 112\'yi aramayı değerlendir.\n'
    + '- mesajlar: sürücünün araçtaki 128x64 piksellik ekranında görünecek 3 kısa, sakinleştirici mesaj (en fazla 50 karakter).\n\n'
    + olayMetni(olay, arac),
    ONERI_SEMASI,
  );
  const temiz = (dizi, sinir, adet) => (Array.isArray(dizi) ? dizi : []).map(s => String(s).trim()).filter(Boolean).slice(0, adet).map(s => s.slice(0, sinir));
  return {
    zaman: Date.now(),
    ozet: String(cevap.ozet || '').trim().slice(0, 600),
    oneriler: temiz(cevap.oneriler, 240, 5),
    mesajlar: temiz(cevap.mesajlar, 50, 3),
  };
}

export async function olayRaporu(olay, arac) {
  const metin = await gemini(
    'Aşağıdaki panik olayı için kısa ve resmi bir olay raporu yaz. '
    + 'Bu başlıkları kullan: Özet, Zaman Akışı, Yapılanlar, Sonuç, Değerlendirme. '
    + 'Düz metin yaz (markdown işareti kullanma), en fazla 250 kelime. Verilmeyen bilgiyi yazma.\n\n'
    + olayMetni(olay, arac),
  );
  return { zaman: Date.now(), metin: metin.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').slice(0, 4000) };
}

// Serbest soru: son olaylar ve araçlar takma adlarla gider, cevapta plakaya geri çevrilir
export async function soruSor(soru, olaylar, araclar) {
  const takma = new Map();
  const ad = plaka => {
    if (!takma.has(plaka)) takma.set(plaka, `Araç ${takma.size + 1}`);
    return takma.get(plaka);
  };
  const simdi = Date.now();
  const aracSatirlari = araclar.map(a => {
    const durum = !a.sonGorulme ? 'hiç bağlanmadı' : simdi - a.sonGorulme > 20000 ? `çevrimdışı (son sinyal ${tarihTR(a.sonGorulme)})` : 'çevrimiçi';
    return `${ad(a.plaka)}: ${durum}${a.hiz != null ? `, hız ${a.hiz} km/s` : ''}, konum kaynağı ${a.kaynak || '?'}`;
  });
  const olaySatirlari = olaylar.slice(-200).map(o => {
    const tepki = tepkiSuresi(o);
    const son = o.gecmis.at(-1);
    return `${tarihTR(o.zaman)} | ${ad(o.plaka)} | ${DURUM[o.durum] || o.durum} | tepki: ${tepki != null ? sn(tepki) : 'yok'}`
      + ` | süre: ${son ? sn(son.zaman - o.zaman) : '0 sn'} | adres: ${o.adres || 'bilinmiyor'} | kayıt sayısı: ${o.gecmis.length}`;
  });
  const cevap = await gemini(
    `Şu an: ${tarihTR(simdi)}\n\nARAÇLAR (${aracSatirlari.length}):\n${aracSatirlari.join('\n') || 'yok'}\n\n`
    + `OLAYLAR (eskiden yeniye, ${olaySatirlari.length}):\n${olaySatirlari.join('\n') || 'yok'}\n\n`
    + `Operatörün sorusu: ${soru}\n\nSadece bu verilere dayanarak kısa yanıt ver. Hesap gerekiyorsa yap. Veride yoksa "veride yok" de. Markdown kullanma.`,
  );
  // "Araç 12" gibi takma adları gerçek plakaya çevir (önce uzun numaralar)
  let sonuc = cevap.replace(/\*\*/g, '');
  const ters = [...takma].sort((x, y) => y[1].length - x[1].length);
  for (const [plaka, takmaAd] of ters) sonuc = sonuc.replace(new RegExp(`${takmaAd}(?!\\d)`, 'g'), plaka);
  return sonuc.slice(0, 3000);
}

// ------------------------------------------------------------------ adres (OpenStreetMap Nominatim)
// Kullanım kuralı: saniyede en fazla 1 istek ve tanıtıcı bir User-Agent. Sonuçlar ~10 m hassasiyetle saklanır.
const adresOnbellek = new Map();
let adresSirasi = Promise.resolve();
let sonAdresIstegi = 0;

function adresBicimle(j) {
  const a = j.address || {};
  const cadde = [a.road, a.house_number].filter(Boolean).join(' ');
  const mahalle = a.neighbourhood || a.suburb || a.quarter || a.village;
  const ilce = a.city_district || a.town || a.district || a.county;
  const il = a.province || a.city || a.state;
  const parcalar = [...new Set([cadde, mahalle, ilce, il].filter(Boolean))];
  if (parcalar.length) return parcalar.join(', ');
  return (j.display_name || '').split(',').slice(0, 4).map(s => s.trim()).join(', ') || null;
}

export function adresBul(enlem, boylam) {
  if (!ADRES_ACIK || enlem == null || boylam == null) return Promise.resolve(null);
  const anahtar = `${enlem.toFixed(4)},${boylam.toFixed(4)}`;
  if (adresOnbellek.has(anahtar)) return Promise.resolve(adresOnbellek.get(anahtar));
  const is = adresSirasi.then(async () => {
    if (adresOnbellek.has(anahtar)) return adresOnbellek.get(anahtar);
    await new Promise(coz => setTimeout(coz, Math.max(0, 1100 - (Date.now() - sonAdresIstegi))));
    sonAdresIstegi = Date.now();
    try {
      const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${enlem}&lon=${boylam}&zoom=18&addressdetails=1&accept-language=tr`, {
        headers: { 'User-Agent': 'PanikButonu/2.1 (yerel ogrenme projesi)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return null;
      const adres = adresBicimle(await r.json());
      if (adresOnbellek.size > 1000) adresOnbellek.delete(adresOnbellek.keys().next().value);
      adresOnbellek.set(anahtar, adres);
      return adres;
    } catch {
      return null;  // adres bulunamazsa koordinat gösterilir, sorun değil
    }
  });
  adresSirasi = is.catch(() => null);
  return is;
}
