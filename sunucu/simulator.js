// ESP32 olmadan test: iki sahte arac konum gonderir, biri 15 sn sonra panik yapar.
//   node simulator.js
const SUNUCU = process.env.SUNUCU || 'http://localhost:3000';
const ANAHTAR = process.env.CIHAZ_ANAHTARI || 'panik-1234';

const araclar = [
  { plaka: '34 SIM 001', enlem: 41.0370, boylam: 28.9850, yon: 0.6 },
  { plaka: '34 SIM 002', enlem: 41.0082, boylam: 28.9784, yon: 2.2 },
];

async function gonder(yol, a) {
  try {
    const r = await fetch(SUNUCU + yol, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Cihaz-Anahtari': ANAHTAR },
      body: JSON.stringify({ plaka: a.plaka, enlem: a.enlem, boylam: a.boylam, kaynak: 'simulasyon' }),
    });
    console.log(`${a.plaka}  POST ${yol} -> ${r.status}`);
  } catch (e) {
    console.log(`${a.plaka}  POST ${yol} -> baglanamadi (${e.cause?.code ?? e.message})`);
  }
}

function ilerle(a) {
  a.yon += (Math.random() - 0.5) * 0.5;
  a.enlem += Math.cos(a.yon) * 0.0006;
  a.boylam += Math.sin(a.yon) * 0.0008;
}

let tur = 0;
setInterval(() => {
  tur++;
  for (const a of araclar) { ilerle(a); gonder('/api/konum', a); }
  if (tur === 8) gonder('/api/panik', araclar[0]);
}, 2000);

console.log(`Simulator -> ${SUNUCU}  (durdurmak icin Ctrl+C)`);
