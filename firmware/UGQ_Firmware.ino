#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h> // HTTPS Support
#include <ArduinoJson.h>
#include "DHT.h"
#include <ModbusMaster.h>

// ============================================
// CONFIGURATION
// ============================================

// WiFi Credentials
const char* ssid = "Aman";
const char* password = "Hanumana.";

// Backend Server URL (Render HTTPS)
const char* serverUrl = "https://iot-monitoring-app-5xoi.onrender.com/api/sensors/readings";

// Device ID
const char* deviceId = "ESP32_MAIN_01";

// Sensor Pins
#define DHTPIN 4     // Digital Pin for DHT11
#define MQPIN 34     // Analog Pin for MQ-135

// RS485 Pins (ESP32 Serial2)
// WROVER-E uses 16/17 for PSRAM, so we MUST remap them.
// Using GPIO 26 (RX) and 27 (TX) instead.
#define RX2_PIN 26
#define TX2_PIN 27

// Sensor Types
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);
ModbusMaster node;

// ============================================
// MODBUS SETUP
// ============================================
// No pre/post transmission callbacks needed for Auto-Flow Control RS485 modules

void setup() {
  Serial.begin(115200);
  
  // RS485 Setup
  // Note: Some ESP32 boards might use different default pins for Serial2. 
  // We explicitly define them here to be safe: RX=16, TX=17
  Serial2.begin(9600, SERIAL_8N1, RX2_PIN, TX2_PIN); 
  
  // IMPORTANT: Set timeout to 200ms (Default is 2000ms)
  // If no reply in 200ms, give up. This prevents WDT crash.
  node.begin(1, Serial2); 
  
  // Other Sensors
  dht.begin();
  pinMode(MQPIN, INPUT);

  // WiFi Connection with Timeout
  Serial.println("\n========== WiFi DEBUG ==========");
  Serial.print("SSID: ");
  Serial.println(ssid);
  Serial.print("Password Length: ");
  Serial.println(strlen(password));
  Serial.println("================================\n");
  
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 60) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi Connected!");
    Serial.print("ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal Strength (RSSI): ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println("\n✗ WiFi Connection FAILED!");
    Serial.print("WiFi Status Code: ");
    Serial.println(WiFi.status());
    Serial.println("\nTroubleshooting:");
    Serial.println("1. Check SSID and Password");
    Serial.println("2. Ensure hotspot is on 2.4GHz (not 5GHz)");
    Serial.println("3. Try WPA2 security (not WPA3)");
    Serial.println("\nESP32 will continue anyway with mock data...\n");
  }
}

float readFloat(uint16_t reg) {
  uint8_t result = node.readInputRegisters(reg, 2); 
  if (result == node.ku8MBSuccess) {
    uint16_t high = node.getResponseBuffer(0);
    uint16_t low = node.getResponseBuffer(1);
    
    union {
      uint32_t i;
      float f;
    } data;
    data.i = ((uint32_t)high << 16) | low;
    return data.f;
  }
  return -1.0; 
}

void loop() {
  // Feed the watchdog!
  yield();

  // 1. Read Enviro Sensors (DISABLED - User only testing Energy Meter)
  // Temperature and Humidity will be sent as 0
  Serial.println("Skipping DHT (Energy Meter Test Only)...");
  float h = 0.0;
  float t = 0.0;
  
  Serial.println("Skipping Analog Sensors (Energy Meter Test Only)...");
  int co2_ppm = 0;

  // 2. Read Energy Meter (Modbus)
  Serial.println("Reading Modbus Energy Meter...");
  
  float voltage = readFloat(0x0000);  // Read voltage from register 0x0000
  
  float current = 0;
  float energy_kwh = 0;
  
  if (voltage != -1.0) {
    // Only try others if Voltage succeeded (Fast-Fail)
    Serial.println("✓ Voltage read successful");
    yield(); delay(50);
    
    Serial.println("Reading Modbus Current...");
    current = readFloat(0x0006);
    
    if (current != -1.0) {
      Serial.println("✓ Current read successful");
    }

    yield(); delay(50);
    Serial.println("Reading Modbus Energy...");
    energy_kwh = readFloat(0x000C);
    
    if (energy_kwh != -1.0) {
      Serial.println("✓ Energy read successful");
    }
  } else {
    Serial.println("✗ Modbus Failed (Timeout or Wiring). Using fallback values.");
    voltage = 0;
    current = 0;
    energy_kwh = 0;
  }

  // Check for errors and set to 0 if failed
  if (voltage == -1) voltage = 0;
  if (current == -1) current = 0;
  if (energy_kwh == -1) energy_kwh = 0;

  Serial.print("Voltage: "); Serial.println(voltage);
  Serial.print("Current: "); Serial.println(current);
  Serial.print("kWh: "); Serial.println(energy_kwh);


  // 3. Send to Backend
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure *client = new WiFiClientSecure;
    if(client) {
      // Key Part: Set Insecure to skip certificate validation (easiest for IoT)
      client->setInsecure(); 

      HTTPClient http;
      
      // Use the secure client
      if (http.begin(*client, serverUrl)) {
        http.addHeader("Content-Type", "application/json");

        StaticJsonDocument<200> doc;
        doc["device_id"] = deviceId;
        doc["temperature"] = t;
        doc["humidity"] = h;
        doc["co2_ppm"] = co2_ppm;
        doc["energy_kwh"] = energy_kwh; 

        String jsonOutput;
        serializeJson(doc, jsonOutput);

        // IMPORTANT: Set timeout to prevent WDT crash if Firewall blocks connection
        http.setConnectTimeout(5000); // 5 seconds to connect
        http.setTimeout(5000);        // 5 seconds to receive response

        Serial.println("Sending to Cloud Backend (Render)...");
        int httpCode = http.POST(jsonOutput);
        
        if (httpCode > 0) {
          Serial.print("✓ Data Sent! HTTP Code: ");
          Serial.println(httpCode);
        } else {
          Serial.print("✗ Error Sending Data. HTTP Code: ");
          Serial.println(httpCode);
          Serial.print("Error: ");
          Serial.println(http.errorToString(httpCode).c_str());
        }
        
        http.end();
      } else {
         Serial.println("✗ Could not connect to Server URL");
      }
      delete client;
    } else {
      Serial.println("✗ Unable to create secure client");
    }
  }

  Serial.println("Waiting...");
  // Wait 5 seconds before next reading
  delay(5000);
}
