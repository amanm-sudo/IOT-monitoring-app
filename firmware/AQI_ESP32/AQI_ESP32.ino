/*
 * ============================================================
 *  AQI SENSOR UNIT FIRMWARE — ESP32-WROOM-32
 *  HVAC IoT Cloud Monitoring System
 *
 *  Sensors  : Sensirion SEN54 (PM / VOC / Temp / RH)
 *           : Sensirion SCD40 (CO₂ / Temp / RH)
 *  Mux      : PCA9548A I²C multiplexer (addr 0x70)
 *  Backend  : POST → /api/sensors/aqi  → aqi_readings table (PostgreSQL)
 *
 *  NOTE: This ESP32 handles ONLY AQI data.
 *        Energy-meter (Modbus/RS485) is on a separate ESP32
 *        — see firmware/UGQ_Firmware/UGQ_Firmware.ino
 *
 *  DB Table : aqi_readings
 *    Fields : device_id, location, pm1_0, pm2_5, pm4_0, pm10,
 *             co2, tvoc, voc_index, nox_index, temperature, humidity,
 *             aqi_pm25, aqi_pm10, aqi_co2, aqi_tvoc, final_aqi,
 *             window_status, timestamp
 * ============================================================
 */

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <SensirionI2CSen5x.h>
#include <SensirionI2cScd4x.h>   // v1.1.0+
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>

// Required by Sensirion v1.1.0 SCD4x library
#ifdef NO_ERROR
#undef NO_ERROR
#endif
#define NO_ERROR 0

// ============================================================
//  CONFIGURATION — Edit these for your deployment
// ============================================================
const char *WIFI_SSID     = "IITBhilai";
const char *WIFI_PASSWORD = "iitbhilai";

// AQI endpoint — stores into aqi_readings table
const char *SERVER_URL    =
    "https://iot-monitoring-app-5xoi.onrender.com/api/sensors/aqi";

// Must be unique per device; location tag below also stored in DB
const char *DEVICE_ID = "ESP32_AQI_INDOOR";
const char *LOCATION  = "indoor";   // stored in aqi_readings.location column

// ============================================================
//  HARDWARE CONSTANTS
// ============================================================
#define MUX_ADDR      0x70
#define CHANNEL_SCD40 0        // PCA9548A channel 0 → SCD40 CO₂ sensor
#define CHANNEL_SEN54 1        // PCA9548A channel 1 → SEN54 environmental sensor
#define LED_PIN       2
#define READ_INTERVAL 10000    // ms between cloud uploads

// ============================================================
//  SENSOR OBJECTS
// ============================================================
SensirionI2CSen5x  sen5x;
SensirionI2cScd4x  scd4x;

// ============================================================
//  SENSOR DATA STORAGE
// ============================================================
// SEN54
float pm1_0 = 0.0, pm2_5 = 0.0, pm4_0 = 0.0, pm10_0 = 0.0;
float vocIndex = 0.0, noxIndex = 0.0;
float sen54_humidity = 0.0, sen54_temperature = 0.0;

// SCD40
uint16_t scd40_co2 = 0;
float    scd40_temperature = 0.0, scd40_humidity = 0.0;

// Derived
float tvoc_ppb       = 0.0;
float avg_temperature = 0.0;
float avg_humidity    = 0.0;

// AQI scores
float aqi_pm25 = 0.0, aqi_pm10 = 0.0, aqi_co2 = 0.0,
      aqi_tvoc = 0.0, aqi_final = 0.0;

// ============================================================
//  I2C MULTIPLEXER HELPERS
// ============================================================
void selectMuxChannel(uint8_t channel) {
  if (channel > 7) return;
  Wire.beginTransmission(MUX_ADDR);
  Wire.write(1 << channel);
  Wire.endTransmission();
  delay(10);
}

void disableMux() {
  Wire.beginTransmission(MUX_ADDR);
  Wire.write(0x00);
  Wire.endTransmission();
}

void scanI2C() {
  Serial.println("\n--- I2C Bus Scan ---");
  int devicesFound = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    uint8_t error = Wire.endTransmission();
    if (error == 0) {
      Serial.print("  ✓ Device at 0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      if (addr == MUX_ADDR) Serial.print("  (PCA9548A Mux)");
      if (addr == 0x62)     Serial.print("  (SCD40 CO₂)");
      if (addr == 0x69)     Serial.print("  (SEN54)");
      Serial.println();
      devicesFound++;
    }
  }
  if (devicesFound == 0) Serial.println("  ✗ No I2C devices found! Check wiring.");
  else { Serial.print("  Total: "); Serial.println(devicesFound); }
  Serial.println("--------------------\n");
}

// ============================================================
//  AQI CALCULATION — US EPA Breakpoint Method
// ============================================================
float calcAQI(float Cp, float BPLo, float BPHi, float ILo, float IHi) {
  if (BPHi == BPLo) return ILo;
  return ((Cp - BPLo) * (IHi - ILo) / (BPHi - BPLo)) + ILo;
}

float getAQI_PM25(float pm25) {
  if (pm25 < 0)      return 0;
  if (pm25 <= 15.4)  return calcAQI(pm25,   0.0,  15.4,   0,  50);
  if (pm25 <= 40.4)  return calcAQI(pm25,  15.5,  40.4,  51, 100);
  if (pm25 <= 65.4)  return calcAQI(pm25,  40.5,  65.4, 101, 150);
  if (pm25 <= 150.4) return calcAQI(pm25,  65.5, 150.4, 151, 200);
  if (pm25 <= 250.4) return calcAQI(pm25, 150.5, 250.4, 201, 300);
  if (pm25 <= 350.4) return calcAQI(pm25, 250.5, 350.4, 301, 400);
  if (pm25 <= 500.4) return calcAQI(pm25, 350.5, 500.4, 401, 500);
  return 500;
}

float getAQI_PM10(float pm10) {
  if (pm10 < 0)    return 0;
  if (pm10 <= 54)  return calcAQI(pm10,   0,  54,   0,  50);
  if (pm10 <= 154) return calcAQI(pm10,  55, 154,  51, 100);
  if (pm10 <= 254) return calcAQI(pm10, 155, 254, 101, 150);
  if (pm10 <= 354) return calcAQI(pm10, 255, 354, 151, 200);
  if (pm10 <= 424) return calcAQI(pm10, 355, 424, 201, 300);
  if (pm10 <= 504) return calcAQI(pm10, 425, 504, 301, 400);
  if (pm10 <= 604) return calcAQI(pm10, 505, 604, 401, 500);
  return 500;
}

float getAQI_CO2(float co2) {
  if (co2 < 400)    return 0;
  if (co2 <= 600)   return calcAQI(co2,  400,  600,   0,  50);
  if (co2 <= 800)   return calcAQI(co2,  601,  800,  51, 100);
  if (co2 <= 950)   return calcAQI(co2,  801,  950, 101, 150);
  if (co2 <= 1150)  return calcAQI(co2,  951, 1150, 151, 200);
  if (co2 <= 1500)  return calcAQI(co2, 1151, 1500, 201, 250);
  if (co2 <= 5000)  return calcAQI(co2, 1501, 5000, 251, 300);
  return 300;
}

float getAQI_TVOC(float tvoc) {
  if (tvoc <= 0)    return 0;
  if (tvoc <= 200)  return calcAQI(tvoc,   0,  200,   0,  50);
  if (tvoc <= 500)  return calcAQI(tvoc, 201,  500,  51, 100);
  if (tvoc <= 1000) return calcAQI(tvoc, 501, 1000, 101, 150);
  return 200;
}

// ============================================================
//  TVOC CONVERSION  (VOC Index → ppb estimate)
// ============================================================
float vocIndexToTVOC(float vocIdx) {
  if (vocIdx <= 0 || vocIdx >= 501) return 0;
  float val = 501.0f - vocIdx;
  if (val <= 0) return 0;
  return (log(val) - 6.24f) * (-878.53f);
}

// ============================================================
//  SENSOR READING FUNCTIONS
// ============================================================
bool readSEN54() {
  selectMuxChannel(CHANNEL_SEN54);
  delay(50);

  bool dataReady = false;
  uint16_t error = sen5x.readDataReady(dataReady);
  if (error || !dataReady) {
    Serial.println("  ✗ SEN54: Data not ready");
    return false;
  }

  error = sen5x.readMeasuredValues(pm1_0, pm2_5, pm4_0, pm10_0,
                                   sen54_humidity, sen54_temperature,
                                   vocIndex, noxIndex);
  if (error) {
    char errMsg[256];
    errorToString(error, errMsg, sizeof(errMsg));
    Serial.print("  ✗ SEN54 read error: "); Serial.println(errMsg);
    return false;
  }

  tvoc_ppb = vocIndexToTVOC(vocIndex);
  if (tvoc_ppb < 0) tvoc_ppb = 0;
  Serial.println("  ✓ SEN54 read successful");
  return true;
}

bool readSCD40() {
  selectMuxChannel(CHANNEL_SCD40);
  delay(50);

  int16_t error;
  char errMsg[64];

  bool dataReady = false;
  error = scd4x.getDataReadyStatus(dataReady);
  if (error != NO_ERROR) {
    errorToString(error, errMsg, sizeof(errMsg));
    Serial.print("  ✗ SCD40 getDataReadyStatus error: "); Serial.println(errMsg);
    return false;
  }
  if (!dataReady) {
    Serial.println("  ✗ SCD40: Data not ready yet");
    return false;
  }

  error = scd4x.readMeasurement(scd40_co2, scd40_temperature, scd40_humidity);
  if (error != NO_ERROR) {
    errorToString(error, errMsg, sizeof(errMsg));
    Serial.print("  ✗ SCD40 readMeasurement error: "); Serial.println(errMsg);
    return false;
  }
  if (scd40_co2 == 0) {
    Serial.println("  ⚠ SCD40: CO₂ = 0 (sensor warming up)");
    return false;
  }

  Serial.println("  ✓ SCD40 read successful");
  return true;
}

// ============================================================
//  SERIAL DEBUG OUTPUT
// ============================================================
void printReadings() {
  Serial.println("\n╔═══════════════════════════════════════════╗");
  Serial.println("║         AQI UNIT — SENSOR READINGS        ║");
  Serial.println("╠═══════════════════════════════════════════╣");

  Serial.println("║  SEN54 (Particulate / VOC)                ║");
  Serial.print("║    PM1.0:  "); Serial.print(pm1_0, 2);  Serial.println(" µg/m³");
  Serial.print("║    PM2.5:  "); Serial.print(pm2_5, 2);  Serial.println(" µg/m³");
  Serial.print("║    PM4.0:  "); Serial.print(pm4_0, 2);  Serial.println(" µg/m³");
  Serial.print("║    PM10:   "); Serial.print(pm10_0, 2); Serial.println(" µg/m³");
  Serial.print("║    TVOC:   "); Serial.print(tvoc_ppb, 1); Serial.println(" ppb");
  Serial.print("║    VOC Idx:"); Serial.print(vocIndex, 1); Serial.println();
  Serial.print("║    NOx Idx:"); Serial.print(noxIndex, 1); Serial.println();
  Serial.print("║    Temp:   "); Serial.print(sen54_temperature, 2); Serial.println(" °C");
  Serial.print("║    RH:     "); Serial.print(sen54_humidity, 2);    Serial.println(" %");

  Serial.println("║                                           ║");
  Serial.println("║  SCD40 (CO₂)                              ║");
  Serial.print("║    CO₂:    "); Serial.print(scd40_co2); Serial.println(" ppm");
  Serial.print("║    Temp:   "); Serial.print(scd40_temperature, 2); Serial.println(" °C");
  Serial.print("║    RH:     "); Serial.print(scd40_humidity, 2);    Serial.println(" %");

  Serial.println("║                                           ║");
  Serial.println("║  Averaged / Derived                       ║");
  Serial.print("║    Avg Temp:"); Serial.print(avg_temperature, 2); Serial.println(" °C");
  Serial.print("║    Avg RH:  "); Serial.print(avg_humidity, 2);    Serial.println(" %");

  Serial.println("║                                           ║");
  Serial.println("║  AQI Scores                               ║");
  Serial.print("║    PM2.5:  "); Serial.println(aqi_pm25,  1);
  Serial.print("║    PM10:   "); Serial.println(aqi_pm10,  1);
  Serial.print("║    CO₂:    "); Serial.println(aqi_co2,   1);
  Serial.print("║    TVOC:   "); Serial.println(aqi_tvoc,  1);
  Serial.print("║    FINAL:  "); Serial.println(aqi_final, 1);

  Serial.println("╚═══════════════════════════════════════════╝\n");
}

// ============================================================
//  CLOUD DATA TRANSMISSION
// ============================================================
bool sendToCloud() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("✗ WiFi not connected — skipping cloud send");
    return false;
  }

  WiFiClientSecure *client = new WiFiClientSecure;
  if (!client) { Serial.println("✗ Unable to create HTTPS client"); return false; }

  client->setInsecure();   // Skip certificate verification (dev/prototype)
  HTTPClient http;
  bool success = false;

  if (http.begin(*client, SERVER_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.setConnectTimeout(5000);
    http.setTimeout(5000);

    StaticJsonDocument<512> doc;

    // ── Fields matching aqi_readings table columns ──────────────
    doc["device_id"] = DEVICE_ID;
    doc["location"]  = LOCATION;          // "indoor"

    doc["pm1_0"]     = round(pm1_0   * 100.0) / 100.0;
    doc["pm2_5"]     = round(pm2_5   * 100.0) / 100.0;
    doc["pm4_0"]     = round(pm4_0   * 100.0) / 100.0;
    doc["pm10"]      = round(pm10_0  * 100.0) / 100.0;

    doc["co2"]       = scd40_co2;         // INTEGER in DB (not co2_ppm)
    doc["tvoc"]      = round(tvoc_ppb  * 10.0) / 10.0;  // DECIMAL (not tvoc_ppb)
    doc["voc_index"] = round(vocIndex  * 10.0) / 10.0;
    doc["nox_index"] = round(noxIndex  * 10.0) / 10.0;

    doc["temperature"]   = round(avg_temperature * 100.0) / 100.0;
    doc["humidity"]      = round(avg_humidity     * 100.0) / 100.0;

    doc["aqi_pm25"]  = round(aqi_pm25  * 10.0) / 10.0;
    doc["aqi_pm10"]  = round(aqi_pm10  * 10.0) / 10.0;
    doc["aqi_co2"]   = round(aqi_co2   * 10.0) / 10.0;
    doc["aqi_tvoc"]  = round(aqi_tvoc  * 10.0) / 10.0;
    doc["final_aqi"] = round(aqi_final * 10.0) / 10.0;  // column is final_aqi

    doc["window_status"] = "closed";      // no servo on this unit

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    Serial.println("Sending to cloud...");
    Serial.print("  Payload: "); Serial.println(jsonPayload);

    int httpCode = http.POST(jsonPayload);
    if (httpCode > 0) {
      Serial.print("  ✓ HTTP Code: "); Serial.println(httpCode);
      if (httpCode == 200 || httpCode == 201) success = true;
    } else {
      Serial.print("  ✗ HTTP Error: ");
      Serial.println(http.errorToString(httpCode).c_str());
    }
    http.end();
  } else {
    Serial.println("✗ Could not connect to server URL");
  }

  delete client;
  return success;
}

// ============================================================
//  Wi-Fi CONNECTION
// ============================================================
void connectWiFi() {
  Serial.println("\n========================================");
  Serial.println("  AQI UNIT — Wi-Fi Connection");
  Serial.println("========================================");
  Serial.print("  SSID: "); Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("  Connecting");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 60) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n  ✓ WiFi Connected!");
    Serial.print("  IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n  ✗ WiFi Connection FAILED!");
  }
  Serial.println("========================================\n");
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  while (!Serial) { delay(100); }

  Serial.println("\n");
  Serial.println("╔═══════════════════════════════════════════╗");
  Serial.println("║   HVAC IoT — AQI UNIT FIRMWARE v1.0      ║");
  Serial.println("║   ESP32 + SEN54 + SCD40 (via PCA9548A)   ║");
  Serial.println("╚═══════════════════════════════════════════╝\n");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // ── I²C & Multiplexer ──────────────────────────────────────
  Wire.begin();
  Wire.setClock(100000);

  Serial.println("[1/4] Scanning I2C bus...");
  scanI2C();

  // ── SCD40 Init ─────────────────────────────────────────────
  Serial.println("[2/4] Initializing SCD40 (CO₂ sensor)...");
  selectMuxChannel(CHANNEL_SCD40);
  delay(50);
  scd4x.begin(Wire, SCD40_I2C_ADDR_62);
  delay(30);
  scd4x.wakeUp();
  scd4x.stopPeriodicMeasurement();
  scd4x.reinit();
  if (scd4x.startPeriodicMeasurement() == NO_ERROR) {
    Serial.println("  ✓ SCD40 initialized — periodic measurement started");
  } else {
    Serial.println("  ✗ SCD40 init failed! Check mux channel / wiring.");
  }

  // ── SEN54 Init ─────────────────────────────────────────────
  Serial.println("[3/4] Initializing SEN54 (PM/VOC sensor)...");
  selectMuxChannel(CHANNEL_SEN54);
  delay(50);
  sen5x.begin(Wire);
  sen5x.deviceReset();
  delay(1000);
  if (!sen5x.startMeasurement()) {
    Serial.println("  ✓ SEN54 initialized — measurement started");
  } else {
    Serial.println("  ✗ SEN54 startMeasurement failed! Check mux channel / wiring.");
  }

  // ── Wi-Fi ──────────────────────────────────────────────────
  Serial.println("[4/4] Connecting to Wi-Fi...");
  connectWiFi();

  // ── Warm-up ────────────────────────────────────────────────
  Serial.println("Sensor warm-up (30 seconds)...");
  for (int i = 30; i > 0; i--) {
    Serial.print("  "); Serial.print(i); Serial.println("s remaining...");
    digitalWrite(LED_PIN, (i % 2 == 0) ? HIGH : LOW);
    delay(1000);
  }

  digitalWrite(LED_PIN, LOW);
  Serial.println("\n✓ Setup complete. Starting main loop...\n");
}

// ============================================================
//  MAIN LOOP
// ============================================================
void loop() {
  yield();
  unsigned long startTime = millis();

  // ── Wi-Fi watchdog ─────────────────────────────────────────
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠ WiFi disconnected — reconnecting...");
    connectWiFi();
  }

  Serial.println("📡 Reading AQI sensors...");

  bool sen54Ok = readSEN54();
  bool scd40Ok = readSCD40();

  // Compute averages & AQI only when at least one sensor is alive
  if (sen54Ok || scd40Ok) {
    if (sen54Ok && scd40Ok) {
      avg_temperature = (sen54_temperature + scd40_temperature) / 2.0f;
      avg_humidity    = (sen54_humidity    + scd40_humidity)    / 2.0f;
    } else if (sen54Ok) {
      avg_temperature = sen54_temperature;
      avg_humidity    = sen54_humidity;
    } else {
      avg_temperature = scd40_temperature;
      avg_humidity    = scd40_humidity;
    }

    aqi_pm25  = sen54Ok ? getAQI_PM25(pm2_5)           : 0;
    aqi_pm10  = sen54Ok ? getAQI_PM10(pm10_0)           : 0;
    aqi_co2   = scd40Ok ? getAQI_CO2((float)scd40_co2)  : 0;
    aqi_tvoc  = sen54Ok ? getAQI_TVOC(tvoc_ppb)         : 0;
    aqi_final = max(max(aqi_pm25, aqi_pm10), max(aqi_co2, aqi_tvoc));
  } else {
    Serial.println("✗ Both AQI sensors failed this cycle.");
  }

  printReadings();

  bool cloudOk = sendToCloud();
  if (cloudOk) {
    // 2 quick blinks → success
    for (int i = 0; i < 2; i++) {
      digitalWrite(LED_PIN, HIGH); delay(100);
      digitalWrite(LED_PIN, LOW);  delay(100);
    }
  } else {
    // Long blink → failure
    digitalWrite(LED_PIN, HIGH); delay(500);
    digitalWrite(LED_PIN, LOW);
  }

  // Wait for the rest of the interval
  unsigned long elapsed = millis() - startTime;
  if (elapsed < READ_INTERVAL) {
    delay(READ_INTERVAL - elapsed);
  }
}
