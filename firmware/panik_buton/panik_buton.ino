/*
  PANIK BUTONU - ESP32
  --------------------
  - Butona basinca sunucuya PANIK + PLAKA + KONUM gonderir.
    Gonderemezse (Wi-Fi yok, sunucu kapali) 2 saniyede bir tekrar dener.
  - Her 5 saniyede bir konum gonderir (canli takip).

  LED'ler:
    Yesil  yaniyor       -> Wi-Fi bagli
    Yesil  yanip sonuyor -> Wi-Fi'ye baglanmaya calisiyor
    Sari   yanip sonuyor -> panik gonderilmeyi bekliyor / tekrar deneniyor
  Buzzer:
    1 kisa bip -> butona basildi
    2 kisa bip -> panik sunucuya ulasti

  Baglantilar (rehberdeki gibi):
    Buton      : D4  ile GND arasi
    Yesil LED  : D18 -> 220 ohm -> LED -> GND
    Sari LED   : D19 -> 220 ohm -> LED -> GND
    Buzzer     : I/O -> D23, VCC -> 3V3, GND -> GND
    GPS (ops.) : GPS TX -> D16 (RX2), GPS RX -> D17 (TX2), VCC -> 3V3, GND -> GND
*/

#include <WiFi.h>
#include <HTTPClient.h>

// ================== AYARLAR (bunlari kendine gore degistir) ==================
const char* WIFI_ADI       = "WIFI_ADINIZ";
const char* WIFI_SIFRE     = "WIFI_SIFRENIZ";
const char* SUNUCU         = "http://192.168.1.50:3000"; // sunucu acilinca ekrana yazdigi adres
const char* PLAKA          = "34 ABC 123";
const char* CIHAZ_ANAHTARI = "panik-1234";               // sunucudaki ile ayni olmali

// GPS modulun varsa 1 yap ve "TinyGPSPlus" kutuphanesini kur.
// 0 iken asagidaki sabit konum gonderilir.
#define GPS_VAR 0
const double SABIT_ENLEM  = 41.0082;
const double SABIT_BOYLAM = 28.9784;

// Buzzer surekli otuyorsa ya da hic otmuyorsa bunu LOW yap.
#define BUZZER_ACIK HIGH
// ============================================================================

const int BUTON_PIN  = 4;   // D4
const int YESIL_LED  = 18;  // D18
const int SARI_LED   = 19;  // D19
const int BUZZER_PIN = 23;  // D23

const unsigned long KONUM_ARALIGI  = 5000; // ms
const unsigned long TEKRAR_ARALIGI = 2000; // ms

#if GPS_VAR
#include <TinyGPSPlus.h>
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);
#endif

volatile bool butonaBasildi = false;
volatile unsigned long sonKesme = 0;

bool bekleyenPanik = false;
unsigned long sonDeneme = 0;
unsigned long sonKonum = 0;
bool oncekiBagli = false;

// Butona basildigi an calisir (kesme). Kod baska bir isle mesgulken bile
// basis kaybolmaz. 300 ms icindeki tekrarlar (buton titresimi) yok sayilir.
void IRAM_ATTR butonKesmesi() {
  unsigned long simdi = millis();
  if (simdi - sonKesme > 300) {
    butonaBasildi = true;
  }
  sonKesme = simdi;
}

void buzzer(bool acik) {
  digitalWrite(BUZZER_PIN, acik ? BUZZER_ACIK : !BUZZER_ACIK);
}

void bip(int adet) {
  for (int i = 0; i < adet; i++) {
    buzzer(true);
    delay(120);
    buzzer(false);
    delay(100);
  }
}

bool konumAl(double &enlem, double &boylam, const char* &kaynak) {
#if GPS_VAR
  if (gps.location.isValid() && gps.location.age() < 10000) {
    enlem = gps.location.lat();
    boylam = gps.location.lng();
    kaynak = "gps";
    return true;
  }
  return false; // GPS henuz uydu bulamadi
#else
  enlem = SABIT_ENLEM;
  boylam = SABIT_BOYLAM;
  kaynak = "sabit";
  return true;
#endif
}

// Sunucuya JSON gonderir, HTTP kodunu dondurur (200 = tamam, negatif = baglanamadi).
int gonder(const char* yol) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.printf("POST %s -> Wi-Fi yok\n", yol);
    return -1;
  }

  double enlem, boylam;
  const char* kaynak;
  char govde[200];
  if (konumAl(enlem, boylam, kaynak)) {
    snprintf(govde, sizeof(govde),
             "{\"plaka\":\"%s\",\"enlem\":%.6f,\"boylam\":%.6f,\"kaynak\":\"%s\"}",
             PLAKA, enlem, boylam, kaynak);
  } else {
    snprintf(govde, sizeof(govde),
             "{\"plaka\":\"%s\",\"enlem\":null,\"boylam\":null,\"kaynak\":\"yok\"}",
             PLAKA);
  }

  HTTPClient http;
  http.begin(String(SUNUCU) + yol);
  http.setConnectTimeout(3000);
  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Cihaz-Anahtari", CIHAZ_ANAHTARI);
  int kod = http.POST((uint8_t*)govde, strlen(govde));
  http.end();

  Serial.printf("POST %s -> %d\n", yol, kod);
  return kod;
}

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(BUTON_PIN, INPUT_PULLUP);  // basili degilken HIGH, basinca LOW
  pinMode(YESIL_LED, OUTPUT);
  pinMode(SARI_LED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  buzzer(false);
  attachInterrupt(digitalPinToInterrupt(BUTON_PIN), butonKesmesi, FALLING);

#if GPS_VAR
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17); // RX=16, TX=17
#endif

  Serial.printf("\nPlaka: %s\n", PLAKA);
  Serial.printf("Wi-Fi'ye baglaniliyor: %s\n", WIFI_ADI);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_ADI, WIFI_SIFRE);
}

void loop() {
#if GPS_VAR
  while (gpsSerial.available()) gps.encode(gpsSerial.read());
#endif

  // --- Wi-Fi durumu -> yesil LED ---
  bool bagli = WiFi.status() == WL_CONNECTED;
  if (bagli != oncekiBagli) {
    if (bagli) Serial.printf("Wi-Fi baglandi, IP: %s\n", WiFi.localIP().toString().c_str());
    else       Serial.println("Wi-Fi koptu, tekrar baglaniliyor...");
    oncekiBagli = bagli;
  }
  digitalWrite(YESIL_LED, bagli ? HIGH : (millis() / 250) % 2);

  // --- Butona basildi mi? ---
  if (butonaBasildi) {
    butonaBasildi = false;
    Serial.println("PANIK! Butona basildi.");
    bekleyenPanik = true;
    sonDeneme = 0;
    bip(1);
  }

  // --- Bekleyen panigi gonder (olmazsa tekrar dene) ---
  if (bekleyenPanik) {
    digitalWrite(SARI_LED, (millis() / 150) % 2);
    if (sonDeneme == 0 || millis() - sonDeneme >= TEKRAR_ARALIGI) {
      sonDeneme = millis();
      int kod = gonder("/api/panik");
      if (kod == 200) {
        bekleyenPanik = false;
        digitalWrite(SARI_LED, LOW);
        bip(2);
      } else {
        Serial.println("Gonderilemedi, 2 sn sonra tekrar denenecek.");
      }
    }
  }

  // --- Canli konum ---
  if (!bekleyenPanik && millis() - sonKonum >= KONUM_ARALIGI) {
    sonKonum = millis();
    gonder("/api/konum");
  }
}
