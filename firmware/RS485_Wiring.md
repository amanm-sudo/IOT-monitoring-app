# RS485 Wiring Guide (ESP32 WROVER-E)

You are using an **ESP32 WROVER** module, which uses pins 16 & 17 internally for PSRAM. 
We have remapped the Serial2 communication to **GPIO 26 and 27**.

## Wiring Connections

### 1. ESP32 to RS485 Module (Auto-Flow Control)
| RS485 Module | ESP32 Pin |
| :--- | :--- |
| **VCC** | 3.3V or 5V (Check module spec) |
| **GND** | GND |
| **RXD** | **GPIO 26** (New RX2) |
| **TXD** | **GPIO 27** (New TX2) |

> **Note:**
> - **RXD** on module goes to **GPIO 26**.
> - **TXD** on module goes to **GPIO 27**.
> - Sometimes labels are swapped (RX->TX, TX->RX). If it doesn't work, try swapping the wires on 26 and 27.

### 2. RS485 Module to Energy Meter
| RS485 Module | Energy Meter (Selec EM2M) |
| :--- | :--- |
| **A+** | **Terminal A (+)** |
| **B-** | **Terminal B (-)** |

## Troubleshooting
- **No Data?** Try swapping 26 and 27.
- **Still No Data?** Try swapping A and B on the meter side.
