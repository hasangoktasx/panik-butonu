// ESP32 olmadan test: üç sahte araç gerçek cihaz gibi konuşur.
//   node simulator.js
// - Araçları sahibi/telefonuyla panele kaydeder (deneme verisi).
// - Her 2 sn konum gönderir, sunucunun cevabını (D=, M=, K=) gerçek cihaz gibi işler.
// - 20. saniyede "06 SIM 001" panik yapar. Panelden "Gördüm" ve "Mesaj" deneyebilirsin.
// - 60. saniyede "06 SIM 003" panik yapar, 10 sn sonra iptal eder (yanlış alarm).
const SUNUCU = process.env.SUNUCU || 'http://localhost:3000';
const ANAHTAR = process.env.CIHAZ_ANAHTARI || 'panik-1234';
const PANEL_SIFRE = process.env.PANEL_SIFRE || '';

// Ankara çevresi (deniz yok, rastgele yürüyüş karaya düşer)
const araclar = [
  { plaka: '06 SIM 001', enlem: 39.9208, boylam: 32.8541, yon: 0.5, sahip: 'Deneme Sürücü A', telefon: '0500 000 00 01', arac: 'Beyaz Fiat Egea' },
  { plaka: '06 SIM 002', enlem: 39.9334, boylam: 32.8597, yon: 2.1, sahip: 'Deneme Sürücü B', telefon: '0500 000 00 02', arac: 'Gri Renault Clio' },
  { plaka: '06 SIM 003', enlem: 39.9050, boylam: 32.8300, yon: 4.0, sahip: 'Deneme Sürücü C', telefon: '0500 000 00 03', arac: 'Kırmızı Ford Focus' },
];
for (const a of araclar) a.durum = 'normal';

const panelBasligi = PANEL_SIFRE ? { Authorization: 'Basic ' + Buffer.from('sim:' + PANEL_SIFRE).toString('base64') } : {};

async function cihazGonder(a, yol) {
  try {
    const r = await fetch(SUNUCU + yol, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cihaz-Anahtari': ANAHTAR },
      body: JSON.stringify({
        plaka: a.plaka, enlem: a.enlem, boylam: a.boylam, kaynak: 'simulasyon',
        rssi: -50 - Math.floor(Math.random() * 30), surum: '2.0-sim', sure: Math.floor(process.uptime()),
      }),
    });
    const cevap = await r.text();
    if (r.status !== 200) return console.log(`${a.plaka}  ${yol} -> ${r.status} ${cevap.trim()}`);
    for (const satir of cevap.split('\n')) {
      if (satir.startsWith('D=')) {
        const d = satir.slice(2);
        if (d !== a.durum) console.log(`${a.plaka}  durum: ${a.durum} -> ${d}${d === 'goruldu' ? '  (ekranda: YARDIM GELIYOR)' : ''}`);
        a.durum = d;
      } else if (satir.startsWith('M=')) console.log(`${a.plaka}  EKRANDA MESAJ: "${satir.slice(2)}"`);
      else if (satir === 'K=bip') console.log(`${a.plaka}  BIP BIP BIP (panel cihazi otturdu)`);
    }
    if (yol !== '/api/konum') console.log(`${a.plaka}  POST ${yol} -> 200`);
  } catch (e) {
    console.log(`${a.plaka}  POST ${yol} -> baglanamadi (${e.cause?.code ?? e.message})`);
  }
}

function ilerle(a) {
  a.yon += (Math.random() - 0.5) * 0.6;
  a.enlem += Math.cos(a.yon) * 0.00035;
  a.boylam += Math.sin(a.yon) * 0.00045;
}

async function kaydet() {
  for (const a of araclar) {
    try {
      await fetch(SUNUCU + '/api/arac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...panelBasligi },
        body: JSON.stringify({ plaka: a.plaka, sahip: a.sahip, telefon: a.telefon, arac: a.arac, not: 'Simülatör deneme aracı' }),
      });
    } catch { /* sunucu henüz açık değil, konum gönderince yine oluşur */ }
  }
}

await kaydet();
let tur = 0;
setInterval(() => {
  tur++;
  for (const a of araclar) { ilerle(a); cihazGonder(a, '/api/konum'); }
  if (tur === 10) cihazGonder(araclar[0], '/api/panik');
  if (tur === 30) cihazGonder(araclar[2], '/api/panik');
  if (tur === 35) cihazGonder(araclar[2], '/api/iptal');
}, 2000);

console.log(`Simulator -> ${SUNUCU}  (durdurmak icin Ctrl+C)`);
console.log('20. saniyede 06 SIM 001 panik yapacak; 60. saniyede 06 SIM 003 panik yapip 10 sn sonra iptal edecek.');
