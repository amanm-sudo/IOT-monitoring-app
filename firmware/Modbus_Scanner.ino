/*
 * Modbus Scanner for Energy Meter
 * This code will scan all common Modbus addresses and baud rates
 * to help you find your energy meter
 */

#include <ModbusMaster.h>

// RS485 Pins
#define RX2_PIN 26
#define TX2_PIN 27

ModbusMaster node;

// Common baud rates to try
const long baudRates[] = {9600, 4800, 2400, 19200};
const int numBaudRates = 4;

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n=================================");
  Serial.println("   MODBUS DEVICE SCANNER");
  Serial.println("=================================\n");
  
  // Try each baud rate
  for (int b = 0; b < numBaudRates; b++) {
    long baud = baudRates[b];
    Serial.print("\n>>> Testing Baud Rate: ");
    Serial.println(baud);
    Serial.println("----------------------------------");
    
    // Initialize Serial2 with this baud rate
    Serial2.begin(baud, SERIAL_8N1, RX2_PIN, TX2_PIN);
    delay(100);
    
    // Scan addresses 1-10 and 247 (common broadcast address)
    for (int addr = 1; addr <= 10; addr++) {
      scanAddress(addr);
    }
    scanAddress(247); // Common broadcast/default address
    
    Serial2.end();
    delay(100);
  }
  
  Serial.println("\n=================================");
  Serial.println("   SCAN COMPLETE");
  Serial.println("=================================");
}

void scanAddress(int addr) {
  node.begin(addr, Serial2);
  
  Serial.print("Address ");
  Serial.print(addr);
  Serial.print(": ");
  
  // Try to read a common register (0x0000 is voltage for many meters)
  uint8_t result = node.readInputRegisters(0x0000, 2);
  
  if (result == node.ku8MBSuccess) {
    Serial.print("✓ FOUND! ");
    uint16_t high = node.getResponseBuffer(0);
    uint16_t low = node.getResponseBuffer(1);
    
    union {
      uint32_t i;
      float f;
    } data;
    data.i = ((uint32_t)high << 16) | low;
    
    Serial.print("Voltage: ");
    Serial.print(data.f);
    Serial.println(" V");
  } else {
    Serial.println("No response");
  }
  
  delay(100);
}

void loop() {
  // Nothing in loop - scan runs once in setup
}
