/*
 * ============================================================
 *  OUTDOOR UNIT FIRMWARE — ESP32-WROOM-32
 *  HVAC IoT Cloud Monitoring System — Energy Meter
 * ============================================================
 */

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <ModbusMaster.h>
#include "driver/uart.h"

// ============================================================
//  CONFIGURATION
// ============================================================
const char *WIFI_SSID     = "IITBhilai";
const char *WIFI_PASSWORD = "iitbhilai";
const char *SERVER_URL    =
    "https://iot-monitoring-app-5xoi.onrender.com/api/sensors/readings";
const char *DEVICE_ID = "ESP32_OUTDOOR";

// ============================================================
//  HARDWARE CONSTANTS
// ============================================================
#define LED_PIN       2
#define READ_INTERVAL 10000  // 10 seconds

// RS485 Pins (ESP32 Serial2)
#define RX2_PIN 25
#define TX2_PIN 26

// ============================================================
//  MODBUS OBJECT
// ============================================================
ModbusMaster node;

// ============================================================
//  ENERGY METER READINGS
// ============================================================
float em_voltage    = 0.0;
float em_current    = 0.0;
float em_energy_kwh = 0.0;

// ============================================================
//  MODBUS FLOAT READ (with retry + CDAB byte-swap)
// ============================================================
float readFloat(uint16_t reg) {
  node.clearResponseBuffer();
  while (Serial2.available()) Serial2.read();
  delay(30);

  const int MAX_RETRIES = 3;
  uint8_t result;

  for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    result = node.readInputRegisters(reg, 2);

    Serial.print("  Reg 0x");
    Serial.print(reg, HEX);
    Serial.print(" (FC04 attempt ");
    Serial.print(attempt);
    Serial.print(") -> 0x");
    Serial.println(result, HEX);

    if (result == node.ku8MBSuccess) break;

    Serial.print("  -- Retry ");
    Serial.print(attempt);
    Serial.println(": Clearing bus...");
    node.clearResponseBuffer();
    while (Serial2.available()) Serial2.read();
    delay(100 * attempt);
  }

  if (result == node.ku8MBSuccess) {
    uint16_t high = node.getResponseBuffer(0);
    uint16_t low  = node.getResponseBuffer(1);
    Serial.print("  OK Raw: high=0x");
    Serial.print(high, HEX);
    Serial.print(" low=0x");
    Serial.println(low, HEX);

    // Selec EM2M uses CDAB (Swapped Float) order
    union { uint32_t i; float f; } data;
    data.i = ((uint32_t)low << 16) | high;
    return data.f;
  }

  if      (result == node.ku8MBResponseTimedOut)  Serial.println("  TIMEOUT");
  else if (result == node.ku8MBInvalidCRC)        Serial.println("  CRC ERROR");
  else if (result == node.ku8MBInvalidSlaveID)    Serial.println("  WRONG SLAVE ID");
  else { Serial.print("  UNKNOWN ERR 0x"); Serial.println(result, HEX); }
  return -1.0;
}

// ============================================================
//  SERIAL DEBUG OUTPUT
// ============================================================
void printReadings() {
  Serial.println("\n+------------------------------------------+");
  Serial.println("|       ENERGY METER — READINGS            |");
  Serial.println("+------------------------------------------+");
  Serial.print("|  Voltage : "); Serial.print(em_voltage,    2); Serial.println(" V");
  Serial.print("|  Current : "); Serial.print(em_current,    4); Serial.println(" A");
  Serial.print("|  Energy  : "); Serial.print(em_energy_kwh, 4); Serial.println(" kWh");
  Serial.println("+------------------------------------------+\n");
}

// ============================================================
//  CLOUD SEND
// ============================================================
bool sendToCloud() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected — skipping cloud send");
    return false;
  }

  WiFiClientSecure *client = new WiFiClientSecure;
  if (!client) { Serial.println("Unable to create HTTPS client"); return false; }
  client->setInsecure();

  HTTPClient http;
  bool success = false;

  if (http.begin(*client, SERVER_URL)) {
    http.addHeader("Content-Type", "application/json");
    http.setConnectTimeout(10000);
    http.setTimeout(10000);

    StaticJsonDocument<256> doc;
    doc["device_id"]   = DEVICE_ID;
    doc["energy_kwh"]  = em_energy_kwh;
    doc["voltage"]     = em_voltage;
    doc["current"]     = em_current;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    Serial.println("Sending to cloud...");
    Serial.print("  Payload: ");
    Serial.println(jsonPayload);

    int httpCode = http.POST(jsonPayload);

    if (httpCode > 0) {
      String resp = http.getString();
      Serial.print("  HTTP Code: ");
      Serial.println(httpCode);
      Serial.print("  Response: ");
      Serial.println(resp);
      if (httpCode == 200 || httpCode == 201) success = true;
    } else {
      Serial.print("  HTTP Error: ");
      Serial.println(http.errorToString(httpCode).c_str());
    }
    http.end();
  } else {
    Serial.println("Could not connect to server URL");
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
    Serial.println("\n  WiFi Connected!");
    Serial.print("  IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n  WiFi Connection FAILED!");
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
  Serial.println("+------------------------------------------+");
  Serial.println("|  HVAC IoT — OUTDOOR UNIT (Energy Meter) |");
  Serial.println("|  ESP32 + Selec EM2M-1P-C-100A / Modbus  |");
  Serial.println("+------------------------------------------+\n");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // ---- RS485 / MODBUS AUTO-DETECT ----
  Serial.println("--- RS485 / MODBUS AUTO-DETECT ---");
  Serial.println("Testing pins, baud, parity, signal inversion...");

  int rxP[]        = {RX2_PIN, 16};
  int txP[]        = {TX2_PIN, 17};
  const char *pn[] = {"25/26", "16/17"};
  long bds[]       = {9600,       9600,       19200};
  uint32_t par[]   = {SERIAL_8N1, SERIAL_8E1, SERIAL_8N1};
  const char *bn[] = {"9600/8N1", "9600/8E1", "19200/8N1"};

  int  foundAddr = 1;
  bool detected  = false;
  int  winP = 0, winB = 0;
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
          uint8_t  f[8] = {addr, 0x04, 0x00, 0x14, 0x00, 0x02, 0, 0};
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
    Serial2.end(); delay(50);
    Serial2.begin(9600, SERIAL_8N1, RX2_PIN, TX2_PIN);
    delay(200);
  }

  while (Serial2.available()) Serial2.read();
  node.begin(foundAddr, Serial2);
  node.preTransmission([]()  { delay(5); });
  node.postTransmission([]() { delay(20); });
  delay(200);
  while (Serial2.available()) Serial2.read();
  Serial.println("Modbus Master Ready\n");

  Serial.println("Connecting to Wi-Fi...");
  connectWiFi();

  digitalWrite(LED_PIN, LOW);
  Serial.println("\nSetup complete. Starting main loop...\n");
}

// ============================================================
//  MAIN LOOP
// ============================================================
void loop() {
  yield();
  unsigned long startTime = millis();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected — attempting reconnect...");
    connectWiFi();
  }

  Serial.println("Reading Modbus Energy Meter...");

  float energy = readFloat(0x0000);  // EM2M Total Energy register
  em_energy_kwh = (energy != -1.0) ? energy : 0.0;
  if (energy == -1.0) Serial.println("  Modbus Energy FAILED — sending 0");

  yield(); delay(500);

  float voltage = readFloat(0x0014);  // EM2M Voltage register
  em_voltage = (voltage != -1.0) ? voltage : 0.0;
  if (voltage == -1.0) Serial.println("  Modbus Voltage FAILED — sending 0");

  yield(); delay(500);

  float current = readFloat(0x0016);  // EM2M Current register
  em_current = (current != -1.0) ? current : 0.0;
  if (current == -1.0) Serial.println("  Modbus Current FAILED — sending 0");

  printReadings();

  bool cloudOk = sendToCloud();
  if (cloudOk) {
    for (int i = 0; i < 2; i++) {
      digitalWrite(LED_PIN, HIGH); delay(100);
      digitalWrite(LED_PIN, LOW);  delay(100);
    }
  } else {
    digitalWrite(LED_PIN, HIGH); delay(500);
    digitalWrite(LED_PIN, LOW);
  }

  unsigned long elapsed = millis() - startTime;
  if (elapsed < READ_INTERVAL) delay(READ_INTERVAL - elapsed);
}
