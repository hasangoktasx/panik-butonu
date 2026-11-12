/*
  PANIK BUTONU v2 - ESP32
  =======================
  - Butona bas  -> panele PANIK + PLAKA + KONUM gider. Gidemezse 2 sn'de bir tekrar dener.
  - Panel "Gordum" deyince ekranda YARDIM GELIYOR yazar, buzzer haber verir.
  - Panelden yazilan mesaj ekranda gorunur. Panel cihazi uzaktan otturebilir.
  - Yanlis alarm: panik sirasinda butona 3 sn basili tut -> iptal edilir.
  - Her 5 sn'de (panik sirasinda 2 sn'de) bir konum gider: canli takip.
  - KURULUM MODU: butona basili tutarken karti ac (ya da EN tusuna bas), 2 sn bekle.
    Telefonla "PANIK-xxxx" Wi-Fi agina baglan, acilan sayfadan Wi-Fi / sunucu / plaka gir.
    Boylece kodu degistirip yeniden yuklemeden ayar degistirebilirsin.

  Gereken kutuphaneler (Arduino IDE > Kutuphane Yoneticisi):
    "Adafruit SSD1306" (Adafruit GFX'i de kurmayi sorar, "Tumunu kur" de)
    GPS kullanacaksan ayrica "TinyGPSPlus"

  Baglantilar (3D rehberdeki gibi):
    Buton      : D4  ile GND arasi
    Yesil LED  : D18 -> 220 ohm -> LED -> GND      (Wi-Fi durumu)
    Sari LED   : D19 -> 220 ohm -> LED -> GND      (panik durumu)
    Buzzer     : I/O -> D23, VCC -> 3V3, GND -> GND
    OLED       : SDA -> D21, SCL -> D22, VCC -> 3V3, GND -> GND
    GPS (ops.) : GPS TX -> D16 (RX2), GPS RX -> D17 (TX2), VCC -> 3V3, GND -> GND
*/

// ============================ AYARLAR ============================
// Bunlari burada doldurabilirsin YA DA kurulum modundan girebilirsin.
// Kurulum modundan kaydedilen degerler bunlarin yerine gecer.
const char* VARSAYILAN_WIFI_ADI   = "WIFI_ADINIZ";
const char* VARSAYILAN_WIFI_SIFRE = "WIFI_SIFRENIZ";
const char* VARSAYILAN_SUNUCU     = "http://192.168.1.50:3000";
const char* VARSAYILAN_PLAKA      = "34 ABC 123";
const char* VARSAYILAN_ANAHTAR    = "panik-1234";   // sunucudaki ile ayni olmali

// GPS modulun varsa 1 yap. 0 iken asagidaki sabit konum gonderilir.
#define GPS_VAR 0
const double SABIT_ENLEM  = 41.0082;
const double SABIT_BOYLAM = 28.9784;

#define BUZZER_ACIK HIGH  // buzzer ters calisiyorsa (surekli otuyorsa) LOW yap
#define OLED_ADRES  0x3C  // ekran hic acilmiyorsa 0x3D dene
// =================================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#if GPS_VAR
#include <TinyGPSPlus.h>
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
#endif

const char* SURUM = "2.0";

const int BUTON_PIN  = 4;   // D4
const int YESIL_LED  = 18;  // D18
const int SARI_LED   = 19;  // D19
const int BUZZER_PIN = 23;  // D23
const int OLED_SDA   = 21;  // D21
const int OLED_SCL   = 22;  // D22

const unsigned long ARALIK_NORMAL  = 5000; // normalde konum araligi
const unsigned long ARALIK_OLAY    = 2000; // panik surerken konum araligi
const unsigned long TEKRAR_ARALIGI = 2000; // gonderilemezse tekrar deneme
const unsigned long IPTAL_SURESI   = 3000; // iptal icin basili tutma
const unsigned long KURULUM_SURESI = 2000; // acilista kurulum modu icin basili tutma

// ---------------------------------------------------------------- durum
enum Durum { NORMAL, GONDERILIYOR, ILETILDI, YARDIM_GELIYOR, IPTAL_EDILIYOR };
Durum durum = NORMAL;

struct Ayarlar { String wifiAdi, wifiSifre, sunucu, plaka, anahtar; };
Ayarlar ayar;

Adafruit_SSD1306 ekran(128, 64, &Wire, -1);
bool ekranVar = false;

volatile bool butonaBasildi = false;
volatile unsigned long sonKesme = 0;
bool basiliydi = false;
unsigned long basmaAni = 0;
bool iptalKilidi = false;   // paniği baslatan basis birakilmadan iptal sayilmasin

unsigned long sonDeneme = 0;
int sonKod = 0;
int basarisizDeneme = 0;
bool oncekiBagli = false;
String sunucuDurumu = "";   // sunucunun son soyledigi: normal / panik / goruldu
String sonMesaj = "";       // panelden gelen son mesaj
String geciciYazi = "";
unsigned long geciciBitis = 0;
unsigned long sonEkran = 0;

// ---------------------------------------------------------------- buzzer (beklemesiz desen calar)
// Desen: acik, kapali, acik, kapali... sureleri (ms)
const uint16_t BIP_BIR[]    = {120};
const uint16_t BIP_IKI[]    = {120, 100, 120};
const uint16_t BIP_YARDIM[] = {80, 80, 80, 80, 80, 80, 500};
const uint16_t BIP_MESAJ[]  = {400};
const uint16_t BIP_BUL[]    = {200, 150, 200, 150, 200, 150, 200, 150, 200, 150, 600};
const uint16_t BIP_IPTAL[]  = {700};

const uint16_t* desen = nullptr;
uint8_t desenUzunluk = 0, desenAdim = 0;
unsigned long desenZaman = 0;

void buzzer(bool acik) { digitalWrite(BUZZER_PIN, acik ? BUZZER_ACIK : !BUZZER_ACIK); }

void desenCal(const uint16_t* d, uint8_t n) {
  desen = d; desenUzunluk = n; desenAdim = 0; desenZaman = millis();
  buzzer(true);
}
#define CAL(d) desenCal(d, sizeof(d) / sizeof(d[0]))

void desenGuncelle() {
  if (!desen || millis() - desenZaman < desen[desenAdim]) return;
  desenAdim++;
  desenZaman = millis();
  if (desenAdim >= desenUzunluk) { desen = nullptr; buzzer(false); return; }
  buzzer(desenAdim % 2 == 0);
}

// ---------------------------------------------------------------- buton kesmesi
// Butona basildigi an calisir; kod baska isle mesgulken bile basis kaybolmaz.
void IRAM_ATTR butonKesmesi() {
  unsigned long simdi = millis();
  if (simdi - sonKesme > 300) butonaBasildi = true;
  sonKesme = simdi;
}

// ---------------------------------------------------------------- ayarlar (kalici hafiza)
String oku(Preferences& p, const char* anahtar, const char* varsayilan) {
  return p.isKey(anahtar) ? p.getString(anahtar, varsayilan) : String(varsayilan);
}

void ayarlariYukle() {
  Preferences p;
  p.begin("panik", false);
  ayar.wifiAdi   = oku(p, "wifi", VARSAYILAN_WIFI_ADI);
  ayar.wifiSifre = oku(p, "sifre", VARSAYILAN_WIFI_SIFRE);
  ayar.sunucu    = oku(p, "sunucu", VARSAYILAN_SUNUCU);
  ayar.plaka     = oku(p, "plaka", VARSAYILAN_PLAKA);
  ayar.anahtar   = oku(p, "anahtar", VARSAYILAN_ANAHTAR);
  p.end();
}

bool ayarlarEksik() { return ayar.wifiAdi.length() == 0 || ayar.wifiAdi == "WIFI_ADINIZ"; }

String plakaTemizle(String s) {
  s.toUpperCase();
  String t;
  for (unsigned int i = 0; i < s.length(); i++) {
    char c = s[i];
    bool uygun = (c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || c == '-' || c == ' ';
    if (uygun && !(c == ' ' && t.endsWith(" "))) t += c;
  }
  t.trim();
  return t.substring(0, 20);
}

// ---------------------------------------------------------------- konum
bool konumAl(double& enlem, double& boylam, double& hiz, const char*& kaynak) {
  hiz = -1;
#if GPS_VAR
  if (gps.location.isValid() && gps.location.age() < 10000) {
    enlem = gps.location.lat();
    boylam = gps.location.lng();
    if (gps.speed.isValid()) hiz = gps.speed.kmph();
    kaynak = "gps";
    return true;
  }
  kaynak = "yok";  // GPS henuz uydu bulamadi
  return false;
#else
  enlem = SABIT_ENLEM;
  boylam = SABIT_BOYLAM;
  kaynak = "sabit";
  return true;
#endif
}

// ---------------------------------------------------------------- ekran
void ortala(const String& yazi, int y, int boyut) {
  ekran.setTextSize(boyut);
  int x = (128 - (int)yazi.length() * 6 * boyut) / 2;
  ekran.setCursor(x < 0 ? 0 : x, y);
  ekran.print(yazi);
}

void wifiCubuklari(int x, int y) {
  if (WiFi.status() != WL_CONNECTED) {
    ekran.setCursor(x, y);
    ekran.print((millis() / 500) % 2 ? "--" : "  ");
    return;
  }
  int rssi = WiFi.RSSI();
  int seviye = rssi > -55 ? 4 : rssi > -65 ? 3 : rssi > -75 ? 2 : 1;
  for (int i = 0; i < 4; i++) {
    int h = 2 + i * 2;
    if (i < seviye) ekran.fillRect(x + i * 3, y + 8 - h, 2, h, SSD1306_WHITE);
    else ekran.drawPixel(x + i * 3, y + 7, SSD1306_WHITE);
  }
}

void ekranBasit(const char* satir1, const char* satir2, const char* satir3 = "") {
  if (!ekranVar) return;
  ekran.clearDisplay();
  ekran.setTextColor(SSD1306_WHITE);
  ortala(satir1, 8, 2);
  ortala(satir2, 34, 1);
  ortala(satir3, 48, 1);
  ekran.display();
}

void ekranCiz() {
  if (!ekranVar) return;
  unsigned long simdi = millis();
  bool yanson = (simdi / 400) % 2;
  ekran.clearDisplay();
  ekran.setTextWrap(false);
  ekran.setTextColor(SSD1306_WHITE);

  // ust satir: plaka + Wi-Fi gucu
  ekran.setTextSize(1);
  ekran.setCursor(0, 0);
  ekran.print(ayar.plaka);
  wifiCubuklari(116, 0);
  ekran.drawFastHLine(0, 10, 128, SSD1306_WHITE);

  bool olayVar = durum == GONDERILIYOR || durum == ILETILDI || durum == YARDIM_GELIYOR;

  if (geciciBitis && simdi < geciciBitis) {
    ortala(geciciYazi, 26, 1);
  } else if (durum == NORMAL) {
    ortala("HAZIR", 16, 2);
    ekran.setTextSize(1);
    ekran.setCursor(0, 40);
    if (WiFi.status() != WL_CONNECTED) ekran.print("Wi-Fi baglaniyor...");
    else ekran.print(sonKod == 200 ? "Sunucu: bagli" : "Sunucu: ulasilamiyor");
    const char* kaynak; double e, b, h;
    konumAl(e, b, h, kaynak);
    ekran.setCursor(0, 52);
    ekran.print("Konum: ");
    ekran.print(strcmp(kaynak, "yok") == 0 ? "GPS uydu ariyor" : kaynak);
  } else if (durum == GONDERILIYOR) {
    if (yanson) ekran.fillRect(0, 13, 128, 20, SSD1306_WHITE);
    ekran.setTextColor(yanson ? SSD1306_BLACK : SSD1306_WHITE);
    ortala("PANIK!", 16, 2);
    ekran.setTextColor(SSD1306_WHITE);
    if (basarisizDeneme == 0) ortala("Gonderiliyor...", 38, 1);
    else ortala("Sunucu yok, deneme " + String(basarisizDeneme + 1), 38, 1);
  } else if (durum == ILETILDI) {
    ortala("ILETILDI", 15, 2);
    ortala(yanson ? "Panel bekleniyor..." : "Panel bekleniyor", 38, 1);
  } else if (durum == YARDIM_GELIYOR) {
    ekran.fillRect(0, 13, 128, 11, SSD1306_WHITE);
    ekran.setTextColor(SSD1306_BLACK);
    ortala("YARDIM GELIYOR", 15, 1);
    ekran.setTextColor(SSD1306_WHITE);
    ekran.setTextWrap(true);
    ekran.setCursor(0, 27);
    ekran.print(sonMesaj.length() ? sonMesaj : String("Panel olayi gordu."));
    ekran.setTextWrap(false);
  } else if (durum == IPTAL_EDILIYOR) {
    ortala("IPTAL", 15, 2);
    ortala(basarisizDeneme ? "Sunucu yok, deneniyor" : "Gonderiliyor...", 38, 1);
  }

  // alt satir: iptal ipucu ya da basili tutma cubugu
  if (olayVar && !(geciciBitis && simdi < geciciBitis)) {
    bool basili = digitalRead(BUTON_PIN) == LOW;
    if (basili && !iptalKilidi) {
      unsigned long sure = min(simdi - basmaAni, IPTAL_SURESI);
      ekran.drawRect(0, 56, 128, 8, SSD1306_WHITE);
      ekran.fillRect(0, 56, (int)(128 * sure / IPTAL_SURESI), 8, SSD1306_WHITE);
    } else if (durum != YARDIM_GELIYOR || sonMesaj.length() == 0) {
      ekran.setTextSize(1);
      ekran.setCursor(0, 56);
      ekran.print("Iptal: 3sn basili tut");
    }
  }
  ekran.display();
}

void gecici(const String& yazi, unsigned long sure) {
  geciciYazi = yazi;
  geciciBitis = millis() + sure;
}

// ---------------------------------------------------------------- sunucu ile konusma
// Sunucunun cevabi satir satir:  D=normal|panik|goruldu   M=mesaj   K=bip
void cevabiIsle(const String& cevap) {
  int bas = 0;
  while (bas < (int)cevap.length()) {
    int son = cevap.indexOf('\n', bas);
    if (son < 0) son = cevap.length();
    String satir = cevap.substring(bas, son);
    satir.trim();
    bas = son + 1;
    if (satir.startsWith("D=")) {
      sunucuDurumu = satir.substring(2);
    } else if (satir.startsWith("M=")) {
      sonMesaj = satir.substring(2);
      Serial.printf("Panelden mesaj: %s\n", sonMesaj.c_str());
      CAL(BIP_MESAJ);
    } else if (satir == "K=bip") {
      Serial.println("Panel cihazi otturuyor.");
      CAL(BIP_BUL);
    }
  }
}

int istekGonder(const char* yol) {
  sonDeneme = millis();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("POST %s -> Wi-Fi yok\n", yol);
    sonKod = -1;
    return -1;
  }

  double enlem, boylam, hiz;
  const char* kaynak;
  char konum[80];
  if (konumAl(enlem, boylam, hiz, kaynak)) snprintf(konum, sizeof(konum), "\"enlem\":%.6f,\"boylam\":%.6f", enlem, boylam);
  else snprintf(konum, sizeof(konum), "\"enlem\":null,\"boylam\":null");

  char govde[320];
  snprintf(govde, sizeof(govde),
           "{\"plaka\":\"%s\",%s,\"kaynak\":\"%s\",\"hiz\":%.1f,\"rssi\":%d,\"surum\":\"%s\",\"sure\":%lu}",
           ayar.plaka.c_str(), konum, kaynak, hiz, (int)WiFi.RSSI(), SURUM, millis() / 1000);

  HTTPClient http;
  http.begin(ayar.sunucu + yol);
  http.setConnectTimeout(2500);
  http.setTimeout(4000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Cihaz-Anahtari", ayar.anahtar);
  int kod = http.POST((uint8_t*)govde, strlen(govde));
  String cevap = kod == 200 ? http.getString() : String();
  http.end();

  Serial.printf("POST %s -> %d\n", yol, kod);
  if (kod == 401) Serial.println("  Cihaz anahtari sunucudakiyle ayni degil!");
  sonKod = kod;
  if (kod == 200) cevabiIsle(cevap);
  return kod;
}

// Sunucunun soyledigi olay durumuna gore cihazin durumunu guncelle
void sunucuDurumunaUy() {
  if (sunucuDurumu == "goruldu" && (durum == NORMAL || durum == ILETILDI)) {
    durum = YARDIM_GELIYOR;
    Serial.println("Panel olayi gordu: YARDIM GELIYOR");
    CAL(BIP_YARDIM);
  } else if (sunucuDurumu == "panik" && durum == NORMAL) {
    durum = ILETILDI;  // cihaz yeniden basladiysa acik olayi hatirla
  } else if (sunucuDurumu == "normal" && (durum == ILETILDI || durum == YARDIM_GELIYOR)) {
    durum = NORMAL;
    sonMesaj = "";
    gecici("OLAY KAPATILDI", 4000);
    Serial.println("Panel olayi kapatti.");
  }
}

// ---------------------------------------------------------------- kurulum modu
WebServer web(80);
DNSServer dns;
String agSecenekleri;

String htmlKacis(const String& s) {
  String t = s;
  t.replace("&", "&amp;"); t.replace("<", "&lt;"); t.replace(">", "&gt;"); t.replace("\"", "&quot;");
  return t;
}

void kurulumSayfasi() {
  String h;
  h.reserve(2500);
  h += F("<!doctype html><html lang=tr><meta charset=utf-8>"
         "<meta name=viewport content='width=device-width,initial-scale=1'><title>Panik Butonu Kurulum</title>"
         "<style>body{font-family:system-ui,sans-serif;max-width:440px;margin:0 auto;padding:16px;background:#f8f1e6;color:#2b2520}"
         "h2{margin:4px 0 12px}label{display:block;margin:14px 0 4px;font-weight:600}"
         "input{width:100%;padding:11px;font-size:16px;box-sizing:border-box;border:1px solid #cbbfae;border-radius:8px;background:#fff}"
         "small{color:#85786b}button{margin-top:20px;width:100%;padding:13px;font-size:17px;font-weight:700;"
         "background:#d93025;color:#fff;border:0;border-radius:9px}</style>"
         "<h2>Panik Butonu Kurulum</h2><form method=post action=/kaydet>");
  String wifi = ayar.wifiAdi == "WIFI_ADINIZ" ? String() : ayar.wifiAdi;
  h += "<label>Wi-Fi adı</label><input name=wifi list=aglar required value=\"" + htmlKacis(wifi) + "\">";
  h += "<datalist id=aglar>" + agSecenekleri + "</datalist><small>Sadece 2.4 GHz ağlar. Araçta telefonun erişim noktasını kullanabilirsin.</small>";
  h += F("<label>Wi-Fi şifresi</label><input name=sifre type=password placeholder='Boş bırakırsan eskisi kalır'>");
  h += "<label>Sunucu adresi</label><input name=sunucu required value=\"" + htmlKacis(ayar.sunucu) + "\">";
  h += F("<small>Bilgisayarda <b>npm start</b> yazınca ekrana çıkan adres</small>");
  h += "<label>Plaka</label><input name=plaka required maxlength=20 value=\"" + htmlKacis(ayar.plaka) + "\">";
  h += "<label>Cihaz anahtarı</label><input name=anahtar required value=\"" + htmlKacis(ayar.anahtar) + "\">";
  h += F("<button>Kaydet ve yeniden başlat</button></form>");
  web.send(200, "text/html; charset=utf-8", h);
}

void kurulumKaydet() {
  String wifi = web.arg("wifi");       wifi.trim();
  String sifre = web.arg("sifre");
  String sunucu = web.arg("sunucu");   sunucu.trim();
  String plaka = plakaTemizle(web.arg("plaka"));
  String anahtar = web.arg("anahtar"); anahtar.trim();
  while (sunucu.endsWith("/")) sunucu.remove(sunucu.length() - 1);

  if (!wifi.length() || !sunucu.startsWith("http://") || plaka.length() < 2 || !anahtar.length()) {
    web.send(400, "text/html; charset=utf-8",
             "<meta charset=utf-8><p>Eksik ya da hatalı bilgi. Sunucu adresi <b>http://</b> ile başlamalı, "
             "plaka en az 2 karakter olmalı.</p><p><a href=/>Geri dön</a></p>");
    return;
  }
  Preferences p;
  p.begin("panik", false);
  p.putString("wifi", wifi);
  if (sifre.length()) p.putString("sifre", sifre);
  else if (ayar.wifiSifre == "WIFI_SIFRENIZ") p.putString("sifre", "");  // sifresiz ag
  p.putString("sunucu", sunucu);
  p.putString("plaka", plaka);
  p.putString("anahtar", anahtar);
  p.end();
  web.send(200, "text/html; charset=utf-8",
           "<meta charset=utf-8><meta name=viewport content='width=device-width'>"
           "<h2>Kaydedildi</h2><p>Cihaz yeniden başlıyor. Bu sayfayı kapatabilirsin.</p>");
  Serial.println("Ayarlar kaydedildi, yeniden baslatiliyor.");
  delay(1500);
  ESP.restart();
}

void kurulumModu() {
  Serial.println("\n=== KURULUM MODU ===");
  ekranBasit("KURULUM", "Wi-Fi aglari", "taraniyor...");

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  int n = WiFi.scanNetworks();
  for (int i = 0; i < n && i < 25; i++) {
    String ad = htmlKacis(WiFi.SSID(i));
    if (ad.length() && agSecenekleri.indexOf("\"" + ad + "\"") < 0) agSecenekleri += "<option value=\"" + ad + "\">";
  }
  WiFi.scanDelete();

  char apAdi[20];
  snprintf(apAdi, sizeof(apAdi), "PANIK-%04X", (unsigned)((ESP.getEfuseMac() >> 32) & 0xFFFF));
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apAdi);
  IPAddress ip = WiFi.softAPIP();
  dns.start(53, "*", ip);  // her adresi kurulum sayfasina yonlendir

  web.on("/", HTTP_GET, kurulumSayfasi);
  web.on("/kaydet", HTTP_POST, kurulumKaydet);
  web.onNotFound([]() {
    web.sendHeader("Location", "http://192.168.4.1/");
    web.send(302, "text/plain", "");
  });
  web.begin();

  Serial.printf("Telefonla '%s' Wi-Fi agina baglan, tarayicida http://%s adresini ac.\n", apAdi, ip.toString().c_str());
  unsigned long sonCizim = 0;
  while (true) {
    dns.processNextRequest();
    web.handleClient();
    bool yanson = (millis() / 500) % 2;
    digitalWrite(SARI_LED, yanson);
    digitalWrite(YESIL_LED, !yanson);
    if (ekranVar && millis() - sonCizim > 1000) {
      sonCizim = millis();
      ekran.clearDisplay();
      ekran.setTextColor(SSD1306_WHITE);
      ekran.fillRect(0, 0, 128, 11, SSD1306_WHITE);
      ekran.setTextColor(SSD1306_BLACK);
      ortala("KURULUM MODU", 2, 1);
      ekran.setTextColor(SSD1306_WHITE);
      ekran.setTextSize(1);
      ekran.setCursor(0, 16); ekran.print("1) Telefonla baglan:");
      ekran.setCursor(0, 27); ekran.print("   "); ekran.print(apAdi);
      ekran.setCursor(0, 41); ekran.print("2) Tarayicida ac:");
      ekran.setCursor(0, 52); ekran.print("   "); ekran.print(ip.toString());
      ekran.display();
    }
    delay(2);
  }
}

// ---------------------------------------------------------------- setup / loop
void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(BUTON_PIN, INPUT_PULLUP);  // basili degilken HIGH, basinca LOW
  pinMode(YESIL_LED, OUTPUT);
  pinMode(SARI_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  buzzer(false);

  // OLED: once adreste biri cevap veriyor mu bak; yoksa ekransiz devam et
  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.beginTransmission(OLED_ADRES);
  ekranVar = Wire.endTransmission() == 0 && ekran.begin(SSD1306_SWITCHCAPVCC, OLED_ADRES, true, false);
  if (!ekranVar) Serial.println("OLED bulunamadi (kablolar ya da adres). Ekransiz devam ediliyor.");

  ayarlariYukle();
  Serial.printf("\nPanik butonu v%s\nPlaka: %s\n", SURUM, ayar.plaka.c_str());

  // Acilista buton basiliysa 2 sn bekle: hala basiliysa kurulum modu
  bool kurulumIstegi = false;
  if (digitalRead(BUTON_PIN) == LOW) {
    ekranBasit("KURULUM?", "Basili tutmaya", "devam et...");
    unsigned long t = millis();
    while (digitalRead(BUTON_PIN) == LOW && millis() - t < KURULUM_SURESI) delay(10);
    kurulumIstegi = millis() - t >= KURULUM_SURESI;
  }
  if (kurulumIstegi || ayarlarEksik()) kurulumModu();  // buradan geri donmez

  ekranBasit("PANIK", ayar.plaka.c_str(), "Wi-Fi baglaniyor...");
  attachInterrupt(digitalPinToInterrupt(BUTON_PIN), butonKesmesi, FALLING);

#if GPS_VAR
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);  // RX=16, TX=17
#endif

  Serial.printf("Wi-Fi'ye baglaniliyor: %s\n", ayar.wifiAdi.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(ayar.wifiAdi.c_str(), ayar.wifiSifre.c_str());
}

void loop() {
#if GPS_VAR
  while (gpsSerial.available()) gps.encode(gpsSerial.read());
#endif
  unsigned long simdi = millis();
  desenGuncelle();

  // --- Wi-Fi durumu -> yesil LED ---
  bool bagli = WiFi.status() == WL_CONNECTED;
  if (bagli != oncekiBagli) {
    if (bagli) Serial.printf("Wi-Fi baglandi, IP: %s\n", WiFi.localIP().toString().c_str());
    else       Serial.println("Wi-Fi koptu, tekrar baglaniliyor...");
    oncekiBagli = bagli;
  }
  digitalWrite(YESIL_LED, bagli ? HIGH : (simdi / 250) % 2);

  // --- buton: basma ani ve basili tutma suresi ---
  bool basili = digitalRead(BUTON_PIN) == LOW;
  if (basili && !basiliydi) basmaAni = simdi;
  if (!basili) iptalKilidi = false;
  basiliydi = basili;

  if (butonaBasildi) {
    butonaBasildi = false;
    if (durum == NORMAL) {
      Serial.println("PANIK! Butona basildi.");
      durum = GONDERILIYOR;
      sonDeneme = 0;
      basarisizDeneme = 0;
      sonMesaj = "";
      geciciBitis = 0;
      iptalKilidi = true;
      CAL(BIP_BIR);
    }
  }

  // --- yanlis alarm: 3 sn basili tut -> iptal ---
  bool olayVar = durum == GONDERILIYOR || durum == ILETILDI || durum == YARDIM_GELIYOR;
  if (olayVar && basili && !iptalKilidi && simdi - basmaAni >= IPTAL_SURESI) {
    iptalKilidi = true;
    Serial.println("Iptal istendi.");
    durum = IPTAL_EDILIYOR;
    sonDeneme = 0;
    basarisizDeneme = 0;
  }

  // --- panik / iptal gonder (olmazsa tekrar dene) ---
  if ((durum == GONDERILIYOR || durum == IPTAL_EDILIYOR) &&
      (sonDeneme == 0 || simdi - sonDeneme >= TEKRAR_ARALIGI)) {
    bool iptal = durum == IPTAL_EDILIYOR;
    int kod = istekGonder(iptal ? "/api/iptal" : "/api/panik");
    if (kod == 200) {
      basarisizDeneme = 0;
      if (iptal) {
        durum = NORMAL;
        sonMesaj = "";
        gecici("IPTAL EDILDI", 3000);
        CAL(BIP_IPTAL);
      } else {
        durum = ILETILDI;
        CAL(BIP_IKI);
        sunucuDurumunaUy();
      }
    } else {
      basarisizDeneme++;
      Serial.println("Gonderilemedi, 2 sn sonra tekrar denenecek.");
    }
  }

  // --- canli konum (cevapta panelin durumu ve mesajlari gelir) ---
  unsigned long aralik = durum == NORMAL ? ARALIK_NORMAL : ARALIK_OLAY;
  if ((durum == NORMAL || durum == ILETILDI || durum == YARDIM_GELIYOR) && simdi - sonDeneme >= aralik) {
    if (istekGonder("/api/konum") == 200) sunucuDurumunaUy();
  }

  // --- sari LED: hizli = gonderiliyor, yavas = panel bekleniyor, surekli = yardim geliyor ---
  bool sari = false;
  if (durum == GONDERILIYOR || durum == IPTAL_EDILIYOR) sari = (simdi / 150) % 2;
  else if (durum == ILETILDI) sari = (simdi / 600) % 2;
  else if (durum == YARDIM_GELIYOR) sari = true;
  digitalWrite(SARI_LED, sari);

  if (simdi - sonEkran >= 150) {
    sonEkran = simdi;
    ekranCiz();
  }
}
