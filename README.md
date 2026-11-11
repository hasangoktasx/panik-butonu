# Panik Butonu (ESP32)

Butona basınca ESP32 Wi-Fi üzerinden **plaka + konum** gönderir. Bilgisayardaki panelde alarm çalar ve harita araca odaklanır. Butona basılmasa da her 5 saniyede bir konum gelir (canlı takip).

**3D kurulum rehberi (tarayıcıda aç):** https://hasangoktasx.github.io/panik-butonu/

Harita paneli bir sunucuya ihtiyaç duyar, bu yüzden internette değil kendi bilgisayarında çalışır (aşağıdaki "Başlatma" bölümüne bak).

```
firmware/panik_buton/panik_buton.ino   ESP32 kodu (Arduino IDE)
sunucu/server.js                       sunucu (ek paket gerekmez)
sunucu/simulator.js                    ESP32 olmadan test için sahte araçlar
sunucu/public/index.html               harita paneli
sunucu/public/rehber/                  3D adım adım kurulum rehberi
```

## Başlatma

```
cd sunucu
npm start
```

- Panel: http://localhost:3000/
- 3D rehber: http://localhost:3000/rehber/
- Kartın yokken denemek için ikinci bir terminalde: `npm run sim`

Sunucu açılınca ekrana `const char* SUNUCU = "http://192.168.x.x:3000";` satırını yazar. Bu satırı ESP32 kodundaki ayarlara kopyala.

## ESP32 kodundaki ayarlar

`panik_buton.ino` dosyasının en üstünde:

| Ayar | Ne yazılır |
|---|---|
| `WIFI_ADI`, `WIFI_SIFRE` | 2.4 GHz Wi-Fi ağın |
| `SUNUCU` | sunucunun ekrana yazdığı adres |
| `PLAKA` | aracın plakası, ör. `34 ABC 123` |
| `CIHAZ_ANAHTARI` | sunucudakiyle aynı (varsayılan `panik-1234`) |
| `GPS_VAR` | GPS modülü takınca `1` |
| `BUZZER_ACIK` | buzzer ters çalışıyorsa `LOW` |

Cihaz anahtarını değiştirmek istersen sunucuyu şöyle başlat: `set CIHAZ_ANAHTARI=yeni-anahtar && npm start` (PowerShell'de: `$env:CIHAZ_ANAHTARI="yeni-anahtar"; npm start`).

## Bilinen sınırlar

- **Setinde GPS yok.** GPS modülü takılana kadar kodda yazılı sabit konum gönderilir. Gerçek konum için GY-NEO6MV2 (NEO-6M) gerekiyor.
- ESP32 ile bilgisayar **aynı Wi-Fi ağında** olmalı. Araçta, evden uzakta çalışması için sunucunun internetten erişilebilir olması ve aracın internete bağlanması (telefon erişim noktası ya da SIM'li bir modem modülü) gerekir.
- Panel yerel ağdaki herkese açık. Paneli ve onay düğmesini ağdaki herkes kullanabilir.
- Bu bir öğrenme projesidir. Gerçek acil durumlarda bunun yerine 112'ye güven.
