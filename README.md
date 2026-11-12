# Panik Butonu (ESP32) v2

Araca takılan bir panik butonu. Butona basınca ESP32 Wi-Fi üzerinden **plaka + konum** gönderir. Bilgisayardaki panelde alarm çalar ve harita araca odaklanır. Her 5 saniyede bir konum da gider, yani araç canlı izlenir.

**İki yönlü çalışır:** panel "Gördüm" deyince araçtaki sarı LED sürekli yanar ve buzzer özel bir bip çalar. Panel cihazı uzaktan öttürebilir ve kısa mesaj gönderebilir. Yanlış alarm durumunda butonu 3 saniye basılı tutmak paniği iptal eder.

**3D kurulum rehberi (tarayıcıda aç):** https://hasangoktasx.github.io/panik-butonu/

```
firmware/panik_buton/panik_buton.ino   ESP32 kodu (Arduino IDE)
sunucu/server.js                       sunucu (ek paket gerekmez, Node 18+)
sunucu/simulator.js                    ESP32 olmadan test: 3 sahte araç
sunucu/public/index.html               harita paneli
sunucu/public/rehber/                  3D adım adım kurulum rehberi
```

## Neler var

| Cihaz (ESP32) | Panel |
|---|---|
| LED ve bip desenleriyle durum: gönderiliyor, iletildi, yardım geliyor | Canlı harita, araç listesi (çevrimiçi / çevrimdışı / panik) |
| Panik gönderilemezse 2 sn'de bir tekrar dener | Alarm sesi, tarayıcı bildirimi, kırmızı alarm bandı |
| 3 sn basılı tut: yanlış alarm iptali | Olay zaman çizelgesi: panik, görüldü, mesaj, not, kapandı |
| Panelin mesajında uzun bip çalar, "öttür" komutuyla öter | Araç kaydı: sahip, telefon (tıkla-ara), araç bilgisi |
| Kurulum modu: kodu değiştirmeden Wi-Fi / sunucu / plaka girilir | Cihaza mesaj gönderme, cihazı öttürme |
| Wi-Fi sinyal gücü, sürüm ve çalışma süresi gönderir | Rota geçmişi (15 dk / 1 sa / 6 sa / tümü) ve oynatma |
| GPS takılınca gerçek konum ve hız | Olayları CSV olarak indirme (Excel'de açılır) |

## Başlatma

```
cd sunucu
npm start
```

- Panel: http://localhost:3000/
- 3D rehber: http://localhost:3000/rehber/
- Kartın yokken denemek için ikinci bir terminalde `npm run sim` çalıştır. Sahte araçlardan biri 20. saniyede panik yapar. Panelden "Gördüm" deyip mesaj gönderebilirsin; simülatör, cihazın ne aldığını terminale yazar.

Sunucu açılınca ekrana `http://192.168.x.x:3000` gibi bir adres yazar. Cihazın kurulum sayfasında bu adresi kullan.

Veriler (araç kayıtları, rotalar, olaylar) `sunucu/veri/durum.json` dosyasında saklanır. Sunucu kapanıp açılınca kaybolmaz.

## Cihazı kurma

1. Arduino IDE'de **esp32** kart paketini kur. Ek kütüphane gerekmez.
2. `panik_buton.ino` dosyasını yükle. Kodda bir şey değiştirmen gerekmez.
3. İlk açılışta sarı ve yeşil LED sırayla yanıp söner: cihaz **kurulum modunda**. Telefonla `PANIK-xxxx` Wi-Fi ağına bağlan. Açılan sayfaya (açılmazsa `192.168.4.1`) Wi-Fi adı ve şifresini, sunucu adresini ve plakayı gir.
4. Ayarları sonra değiştirmek için butona basılı tutarken kartın **EN** tuşuna bas ve butonu 2 sn daha bırakma.

İstersen ayarları kodun en üstündeki `VARSAYILAN_...` satırlarına da yazabilirsin. Kurulum modunda kaydedilen değerler bunların yerine geçer.

| Kod ayarı | Ne işe yarar |
|---|---|
| `GPS_VAR` | GPS modülü takınca `1` yap (TinyGPSPlus kütüphanesi gerekir) |
| `SABIT_ENLEM`, `SABIT_BOYLAM` | GPS yokken gönderilecek konum |
| `BUZZER_ACIK` | buzzer ters çalışıyorsa `LOW` |

## Sunucu ayarları (ortam değişkenleri)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `3000` | |
| `CIHAZ_ANAHTARI` | `panik-1234` | Cihazların gönderdiği anahtar. Cihazdakiyle aynı olmalı. |
| `PANEL_SIFRE` | boş | Verilirse panel şifre sorar (kullanıcı adı fark etmez). 3D rehber ve cihaz istekleri etkilenmez. |

PowerShell'de örnek: `$env:PANEL_SIFRE="gizli"; npm start`

**İsteğe bağlı, varsayılan kapalı:** `GEMINI_API_KEY` verilirse panelde yapay zekâ asistanı açılır (Google AI Studio'dan ücretsiz anahtar; model `GEMINI_MODEL`, varsayılan `gemini-3.5-flash-lite`). Gemini'ye plaka, isim ve telefon gönderilmez. `ADRES=acik` verilirse koordinatlar OpenStreetMap ile adrese çevrilir.

## Cihaz ile sunucu nasıl konuşur

Cihaz `POST /api/konum`, `/api/panik` ve `/api/iptal` adreslerine JSON gönderir (`X-Cihaz-Anahtari` başlığıyla). Sunucu satır satır cevap verir:

```
D=goruldu          olayın durumu: normal | panik | goruldu
M=Yardim yolda     panelden gelen mesaj (Türkçe harfler sadeleştirilir)
K=bip              panel cihazı öttürmek istiyor
```

Panelin gönderdiği mesaj ve komutlar sırada bekler, cihazın bir sonraki bağlantısında iletilir. Bu yüzden panik sırasında cihaz 2 saniyede bir bağlanır.

## Bilinen sınırlar

- **Setinde GPS yok.** GPS modülü takılana kadar sabit konum gönderilir. Gerçek konum için GY-NEO6MV2 (NEO-6M) gerekiyor.
- ESP32 ile bilgisayar **aynı Wi-Fi ağında** olmalı. Araçta, evden uzakta çalışması için sunucunun internetten erişilebilir olması ve aracın internete bağlanması (telefon erişim noktası ya da SIM'li bir modem modülü) gerekir.
- `PANEL_SIFRE` vermezsen panel yerel ağdaki herkese açıktır.
- Bağlantı HTTP'dir (şifrelenmez). Sunucuyu internete açacaksan önüne HTTPS koy.
- Bu bir öğrenme projesidir. Gerçek acil durumlarda bunun yerine 112'ye güven.
