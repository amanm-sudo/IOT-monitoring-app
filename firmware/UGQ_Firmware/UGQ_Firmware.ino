/*
 * ============================================================
 *  OUTDOOR UNIT FIRMWARE — ESP32-WROOM-32
 *  HVAC IoT Cloud Monitoring System
 * ============================================================
 */

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <SensirionI2CSen5x.h>
#include <SensirionI2cScd4x.h> // v1.1.0+
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <ModbusMaster.h>
#include "driver/uart.h"

// Required by Sensirion v1.1.0 SCD4x library
#ifdef NO_ERROR
#undef NO_ERROR
#endif
#define NO_ERROR 0

// ============================================================
//  FEATURE FLAGS — For Testing
// ============================================================
// Set ENABLE_AQI to false to test ONLY the energy meter
const bool ENABLE_AQI = false;
const bool ENABLE_ENERGY_METER = true;

// ============================================================
//  CONFIGURATION
// ============================================================
const char *WIFI_SSID = "IITBhilai";
const char *WIFI_PASSWORD = "iitbhilai";
const char *SERVER_URL =
    "https://iot-monitoring-app-5xoi.onrender.com/api/sensors/readings";
const char *DEVICE_ID = "ESP32_OUTDOOR";

// ============================================================
//  HARDWARE CONSTANTS
// ============================================================
#define MUX_ADDR 0x70
#define CHANNEL_SCD40 0 // SCD40 CO₂ sensor
#define CHANNEL_SEN54 1 // SEN54 environmental sensor
#define LED_PIN 2
#define READ_INTERVAL 10000 // 10 seconds

// RS485 Pins (ESP32 Serial2)
#define RX2_PIN 25
#define TX2_PIN 26

// ============================================================
//  SENSOR OBJECTS
// ============================================================
SensirionI2CSen5x sen5x;
SensirionI2cScd4x scd4x; 
ModbusMaster node;

// ============================================================
//  SENSOR DATA STORAGE
// ============================================================
// SEN54 readings
float pm1_0 = 0.0; float pm2_5 = 0.0; float pm4_0 = 0.0; float pm10_0 = 0.0;
float vocIndex = 0.0; float noxIndex = 0.0;
float sen54_humidity = 0.0; float sen54_temperature = 0.0;

// SCD40 readings
uint16_t scd40_co2 = 0;
float scd40_temperature = 0.0;
float scd40_humidity = 0.0;

// Derived values
float tvoc_ppb = 0.0;
float avg_temperature = 0.0;
float avg_humidity = 0.0;

// AQI values
float aqi_pm25 = 0.0; float aqi_pm10 = 0.0; float aqi_co2 = 0.0; float aqi_tvoc = 0.0; float aqi_final = 0.0;

// Energy Meter readings
float em_voltage = 0.0;
float em_current = 0.0;
float em_energy_kwh = 0.0;

// ============================================================
//  I2C MULTIPLEXER CONTROL
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
      Serial.print("  ✓ Device found at 0x");
      if (addr < 16) Serial.print("0");
      Serial.print(addr, HEX);
      if (addr == MUX_ADDR) Serial.print("  (PCA9548A Mux)");
      if (addr == 0x62) Serial.print("  (SCD40 CO₂)");
      if (addr == 0x69) Serial.print("  (SEN54)");
      Serial.println();
      devicesFound++;
    }
  }
  if (devicesFound == 0) Serial.println("  ✗ No I2C devices found! Check wiring.");
  else { Serial.print("  Total devices: "); Serial.println(devicesFound); }
  Serial.println("--------------------\n");
}

// ============================================================
//  AQI CALCULATION (US EPA Breakpoint Method)
// ============================================================
float calculateAQI(float Cp, float BPLo, float BPHi, float ILo, float IHi) {
  if (BPHi == BPLo) return ILo;
  return ((Cp - BPLo) * (IHi - ILo) / (BPHi - BPLo)) + ILo;
}

float getAQI_PM25(float pm25) {
  if (pm25 < 0) return 0;
  if (pm25 <= 15.4) return calculateAQI(pm25, 0.0, 15.4, 0, 50);
  if (pm25 <= 40.4) return calculateAQI(pm25, 15.5, 40.4, 51, 100);
  if (pm25 <= 65.4) return calculateAQI(pm25, 40.5, 65.4, 101, 150);
  if (pm25 <= 150.4) return calculateAQI(pm25, 65.5, 150.4, 151, 200);
  if (pm25 <= 250.4) return calculateAQI(pm25, 150.5, 250.4, 201, 300);
  if (pm25 <= 350.4) return calculateAQI(pm25, 250.5, 350.4, 301, 400);
  if (pm25 <= 500.4) return calculateAQI(pm25, 350.5, 500.4, 401, 500);
  return 500;
}

float getAQI_PM10(float pm10) {
  if (pm10 < 0) return 0;
  if (pm10 <= 54) return calculateAQI(pm10, 0, 54, 0, 50);
  if (pm10 <= 154) return calculateAQI(pm10, 55, 154, 51, 100);
  if (pm10 <= 254) return calculateAQI(pm10, 155, 254, 101, 150);
  if (pm10 <= 354) return calculateAQI(pm10, 255, 354, 151, 200);
  if (pm10 <= 424) return calculateAQI(pm10, 355, 424, 201, 300);
  if (pm10 <= 504) return calculateAQI(pm10, 425, 504, 301, 400);
  if (pm10 <= 604) return calculateAQI(pm10, 505, 604, 401, 500);
  return 500;
}

float getAQI_CO2(float co2) {
  if (co2 < 400) return 0;
  if (co2 <= 600) return calculateAQI(co2, 400, 600, 0, 50);
  if (co2 <= 800) return calculateAQI(co2, 601, 800, 51, 100);
  if (co2 <= 950) return calculateAQI(co2, 801, 950, 101, 150);
  if (co2 <= 1150) return calculateAQI(co2, 951, 1150, 151, 200);
  if (co2 <= 1500) return calculateAQI(co2, 1151, 1500, 201, 250);
  if (co2 <= 5000) return calculateAQI(co2, 1501, 5000, 251, 300);
  return 300;
}

float getAQI_TVOC(float tvoc) {
  if (tvoc < 0) return 0;
  if (tvoc <= 200) return calculateAQI(tvoc, 0, 200, 0, 50);
  if (tvoc <= 500) return calculateAQI(tvoc, 201, 500, 51, 100);
  if (tvoc <= 1000) return calculateAQI(tvoc, 501, 1000, 101, 150);
  return 200;
}

// ============================================================
//  TVOC CONVERSION
// ============================================================
float vocIndexToTVOC(float vocIdx) {
  if (vocIdx <= 0 || vocIdx >= 501) return 0;
  float val = 501.0 - vocIdx;
  if (val <= 0) return 0;
  return (log(val) - 6.24) * (-878.53);
}

// ============================================================
//  SENSOR READING FUNCTIONS
// ============================================================
bool readSEN54() {
  selectMuxChannel(CHANNEL_SEN54);
  delay(50);
  uint16_t error;
  bool dataReady = false;
  error = sen5x.readDataReady(dataReady);
  if (error || !dataReady) {
    Serial.println("  ✗ SEN54: Data not ready");
    return false;
  }
  error = sen5x.readMeasuredValues(pm1_0, pm2_5, pm4_0, pm10_0, sen54_humidity,
                                   sen54_temperature, vocIndex, noxIndex);
  if (error) {
    Serial.print("  ✗ SEN54 read error: ");
    char errorMsg[256];
    errorToString(error, errorMsg, sizeof(errorMsg));
    Serial.println(errorMsg);
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
  char errorMsg[64];
  bool dataReady = false;
  error = scd4x.getDataReadyStatus(dataReady);
  if (error != NO_ERROR) {
    Serial.print("  ✗ SCD40 getDataReadyStatus error: ");
    errorToString(error, errorMsg, sizeof(errorMsg));
    Serial.println(errorMsg);
    return false;
  }
  if (!dataReady) {
    Serial.println("  ✗ SCD40: Data not ready yet");
    return false;
  }
  error = scd4x.readMeasurement(scd40_co2, scd40_temperature, scd40_humidity);
  if (error != NO_ERROR) {
    Serial.print("  ✗ SCD40 readMeasurement error: ");
    errorToString(error, errorMsg, sizeof(errorMsg));
    Serial.println(errorMsg);
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
//  MODBUS/ENERGY METER FUNCTIONS
// ============================================================
float readFloat(uint16_t reg) {
  // Flush any stale data from RS485 bus before reading
  node.clearResponseBuffer();
  while (Serial2.available()) Serial2.read();
  delay(30);  // Let bus settle

  // Retry loop: up to 3 attempts with progressive delays
  // 0xE0 (Invalid Slave ID) = meter responds but first byte is clipped
  // by auto-flow RS485 chip turnaround. Retries with longer delays fix this.
  const int MAX_RETRIES = 3;
  uint8_t result;

  for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    result = node.readInputRegisters(reg, 2);

    Serial.print("  Reg 0x");
    Serial.print(reg, HEX);
    Serial.print(" (FC04 attempt ");
    Serial.print(attempt);
    Serial.print(") → 0x");
    Serial.println(result, HEX);

    if (result == node.ku8MBSuccess) {
      break;  // Got it!
    }

    // On failure, flush and wait with progressively longer delay
    Serial.print("  -- Retry ");
    Serial.print(attempt);
    Serial.println(": Clearing bus...");
    node.clearResponseBuffer();
    while (Serial2.available()) Serial2.read();
    delay(100 * attempt);  // 100ms, 200ms, 300ms progressive backoff
  }

  if (result == node.ku8MBSuccess) {
    uint16_t high = node.getResponseBuffer(0);
    uint16_t low = node.getResponseBuffer(1);
    Serial.print("  ✓ Raw: high=0x");
    Serial.print(high, HEX);
    Serial.print(" low=0x");
    Serial.println(low, HEX);

    // Selec EM2M uses CDAB (Swapped Float) order
    union {
      uint32_t i;
      float f;
    } data;
    
    // Swapped CDAB byte order mapping
    data.i = ((uint32_t)low << 16) | high;
    return data.f;
  }

  // Final error reporting
  if (result == node.ku8MBResponseTimedOut) {
    Serial.println(" (TIMEOUT - No response from meter!)");
  } else if (result == node.ku8MBInvalidCRC) {
    Serial.println(" (CRC ERROR - Wiring noise or wrong baud/parity!)");
  } else if (result == node.ku8MBInvalidSlaveID) {
    Serial.println(" (WRONG SLAVE ID - RS485 turnaround issue)");
  } else if (result == 0x01) {
    Serial.println(" (ILLEGAL FUNCTION)");
  } else if (result == 0x02) {
    Serial.println(" (ILLEGAL DATA ADDRESS - Wrong register!)");
  } else {
    Serial.print(" (UNKNOWN ERROR: 0x");
    Serial.print(result, HEX);
    Serial.println(")");
  }
  return -1.0;
}

// ============================================================
//  SERIAL OUTPUT (for debugging)
// ============================================================
void printReadings() {
  Serial.println("\n╔═══════════════════════════════════════════╗");
  Serial.println("║       OUTDOOR UNIT — SENSOR READINGS      ║");
  Serial.println("╠═══════════════════════════════════════════╣");

  if (ENABLE_AQI) {
    Serial.println("║  SEN54 (Particulate / VOC)                ║");
    Serial.print("║    PM1.0:  "); Serial.print(pm1_0, 2); Serial.println(" µg/m³");
    Serial.print("║    PM2.5:  "); Serial.print(pm2_5, 2); Serial.println(" µg/m³");
    Serial.print("║    PM10:   "); Serial.print(pm10_0, 2); Serial.println(" µg/m³");
    Serial.print("║    TVOC:   "); Serial.print(tvoc_ppb, 1); Serial.println(" ppb");
    Serial.print("║    Temp:   "); Serial.print(sen54_temperature, 2); Serial.println(" °C");
    Serial.print("║    RH:     "); Serial.print(sen54_humidity, 2); Serial.println(" %");

    Serial.println("║                                           ║");
    Serial.println("║  SCD40 (CO₂)                              ║");
    Serial.print("║    CO₂:    "); Serial.print(scd40_co2); Serial.println(" ppm");
    Serial.print("║    Temp:   "); Serial.print(scd40_temperature, 2); Serial.println(" °C");
    Serial.print("║    RH:     "); Serial.print(scd40_humidity, 2); Serial.println(" %");

    Serial.println("║                                           ║");
    Serial.println("║  AQI Scores                               ║");
    Serial.print("║    PM2.5:  "); Serial.println(aqi_pm25, 1);
    Serial.print("║    FINAL:  "); Serial.println(aqi_final, 1);
  } else {
    Serial.println("║  AQI Sensors DISABLED for this test       ║");
  }

  if (ENABLE_ENERGY_METER) {
    Serial.println("║                                           ║");
    Serial.println("║  ENERGY METER                             ║");
    Serial.print("║    Voltage: "); Serial.print(em_voltage, 2); Serial.println(" V");
    Serial.print("║    Current: "); Serial.print(em_current, 2); Serial.println(" A");
    Serial.print("║    Energy : "); Serial.print(em_energy_kwh, 2); Serial.println(" kWh");
  }

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
  if (!client) {
    Serial.println("✗ Unable to create HTTPS client");
    return false;
  }

  client->setInsecure();
  HTTPClient http;
  bool success = false;

  if (http.begin(*client, SERVER_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.setConnectTimeout(5000);
    http.setTimeout(5000);

    StaticJsonDocument<512> doc;
    doc["device_id"] = DEVICE_ID;
    
    if (ENABLE_AQI) {
      doc["temperature"] = round(avg_temperature * 100.0) / 100.0;
      doc["humidity"] = round(avg_humidity * 100.0) / 100.0;
      doc["co2_ppm"] = scd40_co2;

      doc["pm1_0"] = round(pm1_0 * 100.0) / 100.0;
      doc["pm2_5"] = round(pm2_5 * 100.0) / 100.0;
      doc["pm4_0"] = round(pm4_0 * 100.0) / 100.0;
      doc["pm10"] = round(pm10_0 * 100.0) / 100.0;
      doc["voc_index"] = round(vocIndex * 10.0) / 10.0;
      doc["nox_index"] = round(noxIndex * 10.0) / 10.0;
      doc["tvoc_ppb"] = round(tvoc_ppb * 10.0) / 10.0;

      doc["aqi_pm25"] = round(aqi_pm25 * 10.0) / 10.0;
      doc["aqi_pm10"] = round(aqi_pm10 * 10.0) / 10.0;
      doc["aqi_co2"] = round(aqi_co2 * 10.0) / 10.0;
      doc["aqi_tvoc"] = round(aqi_tvoc * 10.0) / 10.0;
      doc["aqi_final"] = round(aqi_final * 10.0) / 10.0;
    } else {
      // Mock values when AQI disabled
      doc["temperature"] = 0;
      doc["humidity"] = 0;
      doc["co2_ppm"] = 0;
    }

    if (ENABLE_ENERGY_METER) {
      doc["energy_kwh"] = em_energy_kwh;
      doc["voltage"] = em_voltage;
      doc["current"] = em_current;
    } else {
      doc["energy_kwh"] = 0;
      doc["voltage"] = 0;
      doc["current"] = 0;
    }

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    Serial.println("Sending to cloud...");
    Serial.print("  Payload: ");
    Serial.println(jsonPayload);

    int httpCode = http.POST(jsonPayload);

    if (httpCode > 0) {
      Serial.print("  ✓ Data Sent! HTTP Code: ");
      Serial.println(httpCode);
      if (httpCode == 201 || httpCode == 200) {
        success = true;
      }
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
  Serial.println("  OUTDOOR UNIT — Wi-Fi Connection");
  Serial.println("========================================");
  Serial.print("  SSID: ");
  Serial.println(WIFI_SSID);

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
    Serial.print("  IP Address: ");
    Serial.println(WiFi.localIP());
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
  Serial.println("║  HVAC IoT — OUTDOOR UNIT FIRMWARE v1.1   ║");
  Serial.println("║  ESP32 + Energy Meter (+ AQI Optional)   ║");
  Serial.println("╚═══════════════════════════════════════════╝\n");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  if (ENABLE_ENERGY_METER) {
    Serial.println("\n--- RS485 / MODBUS AUTO-DETECT ---");
    Serial.println("Testing pins, baud, parity, signal inversion...");

    int rxP[] = {RX2_PIN, 16};
    int txP[] = {TX2_PIN, 17};
    const char* pn[] = {"25/26", "16/17"};
    long bds[]       = {9600, 9600, 19200};
    uint32_t par[]   = {SERIAL_8N1, SERIAL_8E1, SERIAL_8N1};
    const char* bn[] = {"9600/8N1", "9600/8E1", "19200/8N1"};

    int foundAddr = 1;
    bool detected = false;
    int winP = 0, winB = 0;
    bool winInv = false;

    for (int p = 0; p < 2 && !detected; p++) {
      for (int b = 0; b < 3 && !detected; b++) {
        for (int inv = 0; inv <= 1 && !detected; inv++) {
          Serial.print("  ");
          Serial.print(pn[p]);
          Serial.print(" ");
          Serial.print(bn[b]);
          if (inv) Serial.print(" INV");
          Serial.print(": ");

          Serial2.end(); delay(50);
          Serial2.begin(bds[b], par[b], rxP[p], txP[p]);
          delay(100);
          if (inv) uart_set_line_inverse(UART_NUM_2, UART_SIGNAL_RXD_INV | UART_SIGNAL_TXD_INV);
          delay(50);
          while (Serial2.available()) Serial2.read();

          for (uint8_t addr = 1; addr <= 3 && !detected; addr++) {
            uint8_t f[8] = {addr, 0x04, 0x00, 0x14, 0x00, 0x02, 0, 0};
            uint16_t crc = 0xFFFF;
            for (int i = 0; i < 6; i++) {
              crc ^= f[i];
              for (int j = 0; j < 8; j++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
            }
            f[6] = crc & 0xFF;
            f[7] = (crc >> 8) & 0xFF;

            while (Serial2.available()) Serial2.read();
            delay(20);
            Serial2.write(f, 8);
            Serial2.flush();
            delay(200);

            int n = 0;
            uint8_t rx[16];
            unsigned long tE = millis() + 800, bE = millis() + 400;
            while (millis() < tE && millis() < bE && n < 16) {
              if (Serial2.available()) { rx[n++] = Serial2.read(); bE = millis() + 20; }
            }
            if (n == 0) continue;

            if (n >= 9 && rx[0] == addr && rx[1] == 0x04 && rx[2] == 0x04) {
              uint16_t rc = 0xFFFF;
              for (int i = 0; i < 7; i++) { rc ^= rx[i]; for (int j = 0; j < 8; j++) rc = (rc & 1) ? (rc >> 1) ^ 0xA001 : rc >> 1; }
              if (rc == (rx[7] | (rx[8] << 8))) {
                uint16_t hi = (rx[3] << 8) | rx[4], lo = (rx[5] << 8) | rx[6];
                union { uint32_t i; float f; } d;
                d.i = ((uint32_t)lo << 16) | hi;
                Serial.print("FOUND addr="); Serial.print(addr);
                Serial.print(" V="); Serial.print(d.f, 2); Serial.println("V");
                winP = p; winB = b; winInv = inv; foundAddr = addr; detected = true;
              }
            }
            if (addr == 1 && !detected) {
              Serial.print(n); Serial.print("B[");
              for (int i = 0; i < min(n, 6); i++) { if (rx[i] < 0x10) Serial.print("0"); Serial.print(rx[i], HEX); if (i < min(n, 6)-1) Serial.print(" "); }
              Serial.print("] ");
            }
          }
          if (!detected) Serial.println("fail");
        }
      }
    }

    if (detected) {
      Serial.print("\n>>> LOCKED: "); Serial.print(pn[winP]); Serial.print(" "); Serial.print(bn[winB]);
      if (winInv) Serial.print(" INVERTED");
      Serial.print(" addr="); Serial.println(foundAddr);
      Serial2.end(); delay(50);
      Serial2.begin(bds[winB], par[winB], rxP[winP], txP[winP]);
      if (winInv) uart_set_line_inverse(UART_NUM_2, UART_SIGNAL_RXD_INV | UART_SIGNAL_TXD_INV);
      delay(200);
    } else {
      Serial.println("\n>>> NO MATCH on any combo!");
      Serial.println("  1. Check RS485 module power (3.3V/5V)");
      Serial.println("  2. Check A+/B- wires to meter");
      Serial.println("  3. Is meter RS485 port enabled?");
      Serial.println("  4. Try different RS485 module");
      Serial2.end(); delay(50);
      Serial2.begin(9600, SERIAL_8N1, RX2_PIN, TX2_PIN);
      delay(200);
    }

    while (Serial2.available()) Serial2.read();
    node.begin(foundAddr, Serial2);
    node.preTransmission([]() { delay(5); });
    node.postTransmission([]() { delay(20); });
    delay(200);
    while (Serial2.available()) Serial2.read();
    Serial.println("Modbus Master Ready\n");
  }

  if (ENABLE_AQI) {
    Wire.begin();
    Wire.setClock(100000); 

    Serial.println("[1/5] Scanning I2C bus (direct)...");
    scanI2C();

    Serial.println("[2/5] Initializing SCD40 (CO₂ sensor)...");
    selectMuxChannel(CHANNEL_SCD40);
    delay(50);
    scd4x.begin(Wire, SCD40_I2C_ADDR_62);
    delay(30); 
    scd4x.wakeUp();
    scd4x.stopPeriodicMeasurement();
    scd4x.reinit();
    if (scd4x.startPeriodicMeasurement() == NO_ERROR) {
      Serial.println("  ✓ SCD40 initialized");
    }

    Serial.println("[3/5] Initializing SEN54 (PM/VOC sensor)...");
    selectMuxChannel(CHANNEL_SEN54);
    delay(50);
    sen5x.begin(Wire);
    sen5x.deviceReset();
    delay(1000);
    if (!sen5x.startMeasurement()) {
      Serial.println("  ✓ SEN54 initialized");
    }
  } else {
    Serial.println("\n[INFO] AQI Sensors are DISABLED via ENABLE_AQI flag.");
  }

  Serial.println("Connecting to Wi-Fi...");
  connectWiFi();

  if (ENABLE_AQI) {
    Serial.println("Sensor warm-up period (30 seconds)...");
    for (int i = 30; i > 0; i--) {
      Serial.print("  "); Serial.print(i); Serial.println("s remaining...");
      digitalWrite(LED_PIN, (i % 2 == 0) ? HIGH : LOW);
      delay(1000);
    }
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

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠ WiFi disconnected — attempting reconnect...");
    connectWiFi();
  }

  Serial.println("📡 Reading sensors...");

  if (ENABLE_AQI) {
    bool sen54Ok = readSEN54();
    bool scd40Ok = readSCD40();

    if (sen54Ok || scd40Ok) {
      if (sen54Ok && scd40Ok) {
        avg_temperature = (sen54_temperature + scd40_temperature) / 2.0;
        avg_humidity = (sen54_humidity + scd40_humidity) / 2.0;
      } else if (sen54Ok) {
        avg_temperature = sen54_temperature;
        avg_humidity = sen54_humidity;
      } else {
        avg_temperature = scd40_temperature;
        avg_humidity = scd40_humidity;
      }
      aqi_pm25 = sen54Ok ? getAQI_PM25(pm2_5) : 0;
      aqi_pm10 = sen54Ok ? getAQI_PM10(pm10_0) : 0;
      aqi_co2 = scd40Ok ? getAQI_CO2((float)scd40_co2) : 0;
      aqi_tvoc = sen54Ok ? getAQI_TVOC(tvoc_ppb) : 0;
      aqi_final = max(max(aqi_pm25, aqi_pm10), max(aqi_co2, aqi_tvoc));
    } else {
      Serial.println("✗ Both AQI sensors failed.");
    }
  }

  if (ENABLE_ENERGY_METER) {
    Serial.println("Reading Modbus Energy...");
    float energy = readFloat(0x0000); // EM2M Energy (Proven to work!)
    if (energy != -1.0) {
      Serial.println("✓ Energy read successful");
      em_energy_kwh = energy;
    } else {
      Serial.println("✗ Modbus Energy Failed. Using fallback.");
      em_energy_kwh = 0;
    }
    
    yield(); delay(500);

    Serial.println("Reading Modbus Voltage...");
    float voltage = readFloat(0x0014); // EM2M Voltage
    if (voltage != -1.0) {
      Serial.println("✓ Voltage read successful");
      em_voltage = voltage;
    } else {
      Serial.println("✗ Modbus Voltage Failed. Using fallback.");
      em_voltage = 0;
    }
    
    yield(); delay(500);

    Serial.println("Reading Modbus Current...");
    float current = readFloat(0x0016); // EM2M Current
    if (current != -1.0) {
      Serial.println("✓ Current read successful");
      em_current = current;
    } else {
      Serial.println("✗ Modbus Current Failed. Using fallback.");
      em_current = 0;
    }
  }

  printReadings();

  bool cloudOk = sendToCloud();
  if (cloudOk) {
    for (int i = 0; i < 2; i++) {
      digitalWrite(LED_PIN, HIGH); delay(100);
      digitalWrite(LED_PIN, LOW); delay(100);
    }
  } else {
    digitalWrite(LED_PIN, HIGH); delay(500);
    digitalWrite(LED_PIN, LOW);
  }

  unsigned long elapsed = millis() - startTime;
  if (elapsed < READ_INTERVAL) {
    delay(READ_INTERVAL - elapsed);
  }
}
