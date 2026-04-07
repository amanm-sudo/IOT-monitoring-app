# RS485 Wiring Guide (ESP32 DevKit V1)

ESP32 DevKit V1 uses the standard Serial2 mapping.
We are using Serial2 communication on **GPIO 16 and 17**.

## Wiring Connections

### 1. ESP32 to RS485 Module (Auto-Flow Control)
| RS485 Module | ESP32 Pin |
| :--- | :--- |
| **VCC** | 3.3V or 5V (Check module spec) |
| **GND** | GND |
| **RXD** | **GPIO 16** (RX2) |
| **TXD** | **GPIO 17** (TX2) |

> **Note:**
> - **RXD** on module goes to **GPIO 16**.
> - **TXD** on module goes to **GPIO 17**.
> - Sometimes labels are swapped (RX->TX, TX->RX). If it doesn't work, try swapping the wires on 26 and 27.

### 2. RS485 Module to Energy Meter
| RS485 Module | Energy Meter (Selec EM2M) |
| :--- | :--- |
| **A+** | **Terminal A (+)** |
| **B-** | **Terminal B (-)** |

## Troubleshooting
- **No Data?** Try swapping 16 and 17.
- **Still No Data?** Try swapping A and B on the meter side.
