/*
 * AQI Indoor Unit — ESP32
 * Sensors: SEN54 + SCD40 via PCA9548A I2C mux
 * Actuator: Servo via PCA9685
 * Display: SSD1306 OLED
 * Communication: 
 *   - Local HTTP to outdoor unit (get outdoor AQI)
 *   - HTTPS POST to Render cloud backend
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <SensirionI2CSen5x.h>
#include <SensirionI2cScd4x.h>
#include <Adafruit_PWMServoDriver.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <U8g2_for_Adafruit_GFX.h>

// ============================================
// I2C MUX CHANNELS
// ============================================
#define PCA9548A_ADDR 0x70
#define DISPLAY_CHANNEL 2
#define SEN54_CHANNEL 4
#define SCD40_CHANNEL 3
#define PCA9685_CHANNEL 5

// ============================================
// OLED DISPLAY
// ============================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

// ============================================
// SERVO
// ============================================
#define SERVO_MIN 150
#define SERVO_MAX 600
#define SERVO_CHANNEL 15

// ============================================
// CONFIGURATION
// ============================================
const char* ssid = "OPPO F19 Pro+";
const char* password = "12345678";

// Outdoor unit local IP (for AQI comparison)
const char* outdoorServerIP = "192.168.227.152";
const int outdoorPort = 80;

// Cloud backend URL (Render)
const char* cloudUrl = "https://iot-monitoring-app-5xoi.onrender.com/api/sensors/aqi";
const char* deviceId = "AQI_INDOOR_01";

// ============================================
// I2C Pins (ESP32 defaults)
// ============================================
#define SDA_PIN 21
#define SCL_PIN 22

// ============================================
// OBJECTS
// ============================================
SensirionI2CSen5x sen5x;
SensirionI2cScd4x scd4x;
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
U8G2_FOR_ADAFRUIT_GFX u8g2Fonts;

unsigned long startTime;

// ============================================
// HELPER FUNCTIONS
// ============================================

int angleToPulse(int angle) {
    return map(angle, 0, 260, SERVO_MIN, SERVO_MAX);
}

float calculateAQI(float Cp, float BPLo, float BPHi, float ILo, float IHi) {
    return ((Cp - BPLo) * (IHi - ILo) / (BPHi - BPLo)) + ILo;
}

void selectChannel(uint8_t channel) {
    Wire.beginTransmission(PCA9548A_ADDR);
    Wire.write(1 << channel);
    Wire.endTransmission();
    delay(100);
}

void clearBlueZone() {
    display.fillRect(0, 17, 128, 47, SSD1306_BLACK);
}

void displayText(const char* line1, const char* line2, int x1, int y1, int x2, int y2) {
    selectChannel(DISPLAY_CHANNEL);
    delay(200);
    u8g2Fonts.begin(display);
    clearBlueZone();
    u8g2Fonts.setFont(u8g2_font_ncenB12_tr);
    u8g2Fonts.setFontMode(1);
    u8g2Fonts.setFontDirection(0);
    u8g2Fonts.setCursor(x1, y1);
    u8g2Fonts.print(line1);
    if (line2 != NULL) {
        u8g2Fonts.setCursor(x2, y2);
        u8g2Fonts.print(line2);
    }
    display.display();
}

// Post AQI data to cloud backend
void postToCloud(const char* location, float pm1, float pm2_5, float pm4, float pm10,
                 uint16_t co2, float tvoc, float vocIdx, float noxIdx,
                 float temp, float hum,
                 float aqiPm25, float aqiPm10, float aqiCo2, float aqiTvoc,
                 float finalAqi, const char* windowStatus) {
    if (WiFi.status() != WL_CONNECTED) return;

    WiFiClientSecure *client = new WiFiClientSecure;
    if (!client) return;
    client->setInsecure();

    HTTPClient http;
    if (http.begin(*client, cloudUrl)) {
        http.addHeader("Content-Type", "application/json");
        http.setConnectTimeout(5000);
        http.setTimeout(5000);

        String json = "{";
        json += "\"device_id\":\"" + String(deviceId) + "\",";
        json += "\"location\":\"" + String(location) + "\",";
        json += "\"pm1_0\":" + String(pm1, 2) + ",";
        json += "\"pm2_5\":" + String(pm2_5, 2) + ",";
        json += "\"pm4_0\":" + String(pm4, 2) + ",";
        json += "\"pm10\":" + String(pm10, 2) + ",";
        json += "\"co2\":" + String(co2) + ",";
        json += "\"tvoc\":" + String(tvoc, 2) + ",";
        json += "\"voc_index\":" + String(vocIdx, 2) + ",";
        json += "\"nox_index\":" + String(noxIdx, 2) + ",";
        json += "\"temperature\":" + String(temp, 2) + ",";
        json += "\"humidity\":" + String(hum, 2) + ",";
        json += "\"aqi_pm25\":" + String(aqiPm25, 2) + ",";
        json += "\"aqi_pm10\":" + String(aqiPm10, 2) + ",";
        json += "\"aqi_co2\":" + String(aqiCo2, 2) + ",";
        json += "\"aqi_tvoc\":" + String(aqiTvoc, 2) + ",";
        json += "\"final_aqi\":" + String(finalAqi, 2) + ",";
        json += "\"window_status\":\"" + String(windowStatus) + "\"";
        json += "}";

        Serial.println("Sending AQI to cloud...");
        int httpCode = http.POST(json);
        if (httpCode > 0) {
            Serial.print("Cloud POST OK: ");
            Serial.println(httpCode);
        } else {
            Serial.print("Cloud POST failed: ");
            Serial.println(http.errorToString(httpCode));
        }
        http.end();
    }
    delete client;
}

// ============================================
// SETUP
// ============================================
void setup() {
    Serial.begin(115200);
    Wire.begin(SDA_PIN, SCL_PIN);
    startTime = millis();

    // Initialize Display
    selectChannel(DISPLAY_CHANNEL);
    delay(500);
    if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
        Serial.println("SSD1306 allocation failed");
        for (;;);
    }
    display.clearDisplay();
    u8g2Fonts.begin(display);
    u8g2Fonts.setFont(u8g2_font_ncenB10_tr);
    u8g2Fonts.setFontMode(1);
    u8g2Fonts.setFontDirection(0);
    u8g2Fonts.setCursor(3, 14);
    u8g2Fonts.print("AQI Ventilation");
    display.drawLine(0, 16, 128, 16, SSD1306_WHITE);
    display.display();

    displayText("Welcome", NULL, 25, 40, 0, 0);
    delay(1000);
    displayText("Wait", NULL, 40, 45, 0, 0);
    delay(1000);
    displayText("For the", "Stabilization", 30, 40, 10, 60);
    delay(1000);
    displayText("Till 5 minutes", NULL, 5, 40, 0, 0);

    // WiFi
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 60) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi Connected!");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\nWiFi Failed!");
    }

    displayText("Connected to", "WiFi", 5, 35, 40, 55);
    delay(2000);

    // Initialize SEN54
    selectChannel(SEN54_CHANNEL);
    sen5x.begin(Wire);
    delay(5000);
    uint16_t error = sen5x.deviceReset();
    if (error) { Serial.print("SEN54 Reset Error: "); Serial.println(error); }
    error = sen5x.startMeasurement();
    if (error) { Serial.print("SEN54 Start Error: "); Serial.println(error); }

    // Initialize SCD40
    selectChannel(SCD40_CHANNEL);
    scd4x.begin(Wire, 0x62);
    delay(5000);
    scd4x.startPeriodicMeasurement();

    // Initialize Motor Driver
    selectChannel(PCA9685_CHANNEL);
    pwm.begin();
    pwm.setPWMFreq(50);
    delay(1000);
    pwm.setPWM(SERVO_CHANNEL, 0, angleToPulse(90)); // Window closed
    Serial.println("Servo set to 90° => Window Closed");

    displayText("Window", "Closed", 35, 35, 38, 55);
}

// ============================================
// LOOP
// ============================================
void loop() {
    unsigned long elapsedTime = millis() - startTime;

    // ------------------------------------------
    // 1. Get Outdoor AQI via local HTTP
    // ------------------------------------------
    float finalAQI_OUT = 0;
    float AQI_PM25_OUT = 0, AQI_PM10_OUT = 0, AQI_CO2_OUT = 0, AQI_TVOC_OUT = 0;
    float T_out = 0;
    bool outdoorConnected = false;
    bool hazard = false;

    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;

        // Get outdoor AQI
        String outdoorUrl = "http://" + String(outdoorServerIP) + ":" + String(outdoorPort) + "/aqi_out";
        http.begin(outdoorUrl);
        http.setTimeout(5000);
        int statusCode = http.GET();

        if (statusCode == 200) {
            outdoorConnected = true;
            String aqi_outResponse = http.getString();
            Serial.println("Outdoor AQI: " + aqi_outResponse);

            // Parse CSV: AQI_PM25,AQI_PM10,AQI_CO2,AQI_TVOC,finalAQI
            int p1 = aqi_outResponse.indexOf(',');
            int p2 = aqi_outResponse.indexOf(',', p1 + 1);
            int p3 = aqi_outResponse.indexOf(',', p2 + 1);
            int p4 = aqi_outResponse.indexOf(',', p3 + 1);

            if (p1 > 0 && p2 > p1 && p3 > p2 && p4 > p3) {
                AQI_PM25_OUT = aqi_outResponse.substring(0, p1).toFloat();
                AQI_PM10_OUT = aqi_outResponse.substring(p1 + 1, p2).toFloat();
                AQI_CO2_OUT = aqi_outResponse.substring(p2 + 1, p3).toFloat();
                AQI_TVOC_OUT = aqi_outResponse.substring(p3 + 1, p4).toFloat();
                finalAQI_OUT = aqi_outResponse.substring(p4 + 1).toFloat();
            }

            displayText("Outdoor", String("AQI: " + String(finalAQI_OUT, 0)).c_str(), 35, 35, 18, 55);
            delay(2000);

            // Check outdoor hazard conditions
            if (AQI_CO2_OUT > 250) {
                hazard = true;
                displayText("Outdoor CO2", "Level Too High", 10, 35, 5, 55);
            } else if (AQI_PM25_OUT > 200) {
                hazard = true;
                displayText("Outdoor PM2.5", "Level Too High", 10, 35, 5, 55);
            } else if (AQI_PM10_OUT > 200) {
                hazard = true;
                displayText("Outdoor PM10", "Level Too High", 10, 35, 5, 55);
            } else if (AQI_TVOC_OUT > 200) {
                hazard = true;
                displayText("Outdoor TVOC", "Level Too High", 10, 35, 5, 55);
            }

            if (hazard) {
                selectChannel(PCA9685_CHANNEL);
                pwm.setPWM(SERVO_CHANNEL, 0, angleToPulse(90));
                delay(1000);
                displayText("Window", "Closed", 30, 35, 33, 55);
                delay(1000);
            }
        } else {
            Serial.print("Outdoor HTTP Error: ");
            Serial.println(statusCode);
            displayText("Outdoor unit", "not connected", 5, 35, 5, 55);
        }
        http.end();

        // Get outdoor temperature
        String tempUrl = "http://" + String(outdoorServerIP) + ":" + String(outdoorPort) + "/avg_t";
        http.begin(tempUrl);
        http.setTimeout(5000);
        statusCode = http.GET();
        if (statusCode == 200) {
            String avgTResponse = http.getString();
            int p1 = avgTResponse.indexOf(',');
            if (p1 > 0) {
                T_out = avgTResponse.substring(0, p1).toFloat();
            }
        }
        http.end();
    }

    delay(2000);

    // ------------------------------------------
    // 2. Read Indoor SEN54
    // ------------------------------------------
    selectChannel(SEN54_CHANNEL);
    delay(1000);
    float pm1, pm2_5, pm4, pm10, humidity, SEN_Temp, vocIndex, noxIndex;
    int16_t error = sen5x.readMeasuredValues(pm1, pm2_5, pm4, pm10, humidity, SEN_Temp, vocIndex, noxIndex);
    float TVOC = (log(501 - vocIndex) - 6.24) * (-878.53);

    if (error == 0) {
        Serial.println("Indoor SEN54: PM2.5=" + String(pm2_5) + " PM10=" + String(pm10) + " TVOC=" + String(TVOC));
    } else {
        Serial.print("SEN54 read error: ");
        Serial.println(error);
    }

    // ------------------------------------------
    // 3. Read Indoor SCD40
    // ------------------------------------------
    selectChannel(SCD40_CHANNEL);
    delay(1000);
    uint16_t co2;
    float SCD_Temp, Rh;
    error = scd4x.readMeasurement(co2, SCD_Temp, Rh);

    if (error == 0) {
        Serial.println("Indoor SCD40: CO2=" + String(co2) + " T=" + String(SCD_Temp) + " RH=" + String(Rh));
    } else {
        Serial.print("SCD40 read error: ");
        Serial.println(error);
    }

    float T_in = (SCD_Temp + SEN_Temp) / 2;

    // ------------------------------------------
    // 4. Calculate Indoor AQI
    // ------------------------------------------

    // PM2.5 AQI
    float BPLo, BPHi, ILo, IHi;
    if (pm2_5 <= 15.4) { BPLo=0; BPHi=15.4; ILo=0; IHi=50; }
    else if (pm2_5 <= 40.4) { BPLo=15.5; BPHi=40.4; ILo=51; IHi=100; }
    else if (pm2_5 <= 65.4) { BPLo=40.5; BPHi=65.4; ILo=101; IHi=150; }
    else if (pm2_5 <= 150.4) { BPLo=65.5; BPHi=150.4; ILo=151; IHi=200; }
    else if (pm2_5 <= 250.4) { BPLo=150.5; BPHi=250.4; ILo=201; IHi=300; }
    else if (pm2_5 <= 350.4) { BPLo=250.5; BPHi=350.4; ILo=301; IHi=400; }
    else { BPLo=350.5; BPHi=500.4; ILo=401; IHi=500; }
    float AQI_PM25 = calculateAQI(pm2_5, BPLo, BPHi, ILo, IHi);

    // PM10 AQI
    if (pm10 <= 54) { BPLo=0; BPHi=54; ILo=0; IHi=50; }
    else if (pm10 <= 154) { BPLo=55; BPHi=154; ILo=51; IHi=100; }
    else if (pm10 <= 254) { BPLo=155; BPHi=254; ILo=101; IHi=150; }
    else if (pm10 <= 354) { BPLo=255; BPHi=354; ILo=151; IHi=200; }
    else if (pm10 <= 424) { BPLo=355; BPHi=424; ILo=201; IHi=300; }
    else if (pm10 <= 504) { BPLo=425; BPHi=504; ILo=301; IHi=400; }
    else { BPLo=505; BPHi=604; ILo=401; IHi=500; }
    float AQI_PM10 = calculateAQI(pm10, BPLo, BPHi, ILo, IHi);

    // CO2 AQI
    if (co2 <= 600) { BPLo=400; BPHi=600; ILo=0; IHi=50; }
    else if (co2 <= 800) { BPLo=601; BPHi=800; ILo=51; IHi=100; }
    else if (co2 <= 950) { BPLo=801; BPHi=950; ILo=101; IHi=150; }
    else if (co2 <= 1150) { BPLo=951; BPHi=1150; ILo=151; IHi=200; }
    else if (co2 <= 1500) { BPLo=1151; BPHi=1500; ILo=201; IHi=250; }
    else { BPLo=1501; BPHi=5000; ILo=251; IHi=300; }
    float AQI_CO2 = calculateAQI(co2, BPLo, BPHi, ILo, IHi);

    // TVOC AQI
    float AQI_TVOC;
    if (TVOC <= 200) { BPLo=0; BPHi=200; ILo=0; IHi=50; }
    else if (TVOC <= 500) { BPLo=201; BPHi=500; ILo=51; IHi=100; }
    else if (TVOC <= 1000) { BPLo=501; BPHi=1000; ILo=101; IHi=150; }
    else { BPLo=1001; BPHi=5000; ILo=151; IHi=200; }
    AQI_TVOC = calculateAQI(TVOC, BPLo, BPHi, ILo, IHi);

    float finalAQI_IN = max(max(AQI_PM25, AQI_PM10), max(AQI_CO2, AQI_TVOC));

    Serial.println("Indoor AQI: PM25=" + String(AQI_PM25) + " PM10=" + String(AQI_PM10) +
                   " CO2=" + String(AQI_CO2) + " TVOC=" + String(AQI_TVOC) +
                   " Final=" + String(finalAQI_IN));

    // ------------------------------------------
    // 5. Window Decision Logic (FIXED bugs)
    // ------------------------------------------
    String windowState = "closed";

    if (!hazard) {
        bool decided = false;
        float delAQI = finalAQI_IN - finalAQI_OUT;
        float delT = T_in - T_out;

        if (finalAQI_IN > 250 && delAQI >= 0) {
            windowState = "open";
            decided = true;
        }
        if (finalAQI_OUT > 250 && delAQI < 0) {
            windowState = "closed";
            decided = true;
        }

        if (!decided) {
            if (delT > 0 && delAQI > 0) windowState = "open";
            else if (delT < 0 && delAQI < 0) windowState = "closed";
            else if (delT > 0 && delAQI >= -100 && delAQI < 0) windowState = "open";
            else if (delT < 0 && delAQI > 0 && delAQI < 100) windowState = "closed";
        }
    }

    // Operate servo
    if (windowState == "open") {
        selectChannel(PCA9685_CHANNEL);
        pwm.setPWM(SERVO_CHANNEL, 0, angleToPulse(60));
        delay(1000);
        Serial.println("Window OPEN");
    } else {
        selectChannel(PCA9685_CHANNEL);
        pwm.setPWM(SERVO_CHANNEL, 0, angleToPulse(90));
        delay(1000);
        Serial.println("Window CLOSED");
    }

    // ------------------------------------------
    // 6. Display AQI
    // ------------------------------------------
    if (elapsedTime / 1000 > 10) {
        String label;
        if (finalAQI_IN <= 50) label = "Good";
        else if (finalAQI_IN <= 100) label = "Moderate";
        else if (finalAQI_IN <= 150) label = "Sensitive";
        else if (finalAQI_IN <= 200) label = "Unhealthy";
        else if (finalAQI_IN <= 250) label = "Very Bad";
        else label = "Hazardous";

        displayText(("AQI: " + label).c_str(), NULL, 10, 35, 0, 0);
        delay(2000);
        displayText(("AQI: " + String(finalAQI_IN, 0)).c_str(), NULL, 18, 35, 0, 0);
        delay(1000);
    }

    // ------------------------------------------
    // 7. POST to Cloud
    // ------------------------------------------
    postToCloud("indoor", pm1, pm2_5, pm4, pm10, co2, TVOC, vocIndex, noxIndex,
                T_in, (humidity + Rh) / 2,
                AQI_PM25, AQI_PM10, AQI_CO2, AQI_TVOC,
                finalAQI_IN, windowState.c_str());

    delay(5000);
}
