<div align="center">
  <h1>PLUG BOX</h1>


![Status](https://img.shields.io/badge/Status-In%20Progress-yellow)
![Device](https://img.shields.io/badge/Device-PlugBox-blue)
![Platform](https://img.shields.io/badge/Platform-ESP32%20%7C%20STM32-orange)
![Simulator](https://img.shields.io/badge/Simulator-Node.js-green)
</div>

---
# Overview

This project simulates the PlugBox hardware device for a two-wheeler EV charging system.

The simulator generates periodic heartbeat telemetry that matches real hardware behavior and prints the payload to the console.

---

## Project Files

- `heartbeat.json` — Template file for heartbeat payloads  
- `send-heartbeat.js` — Main simulator script that generates and sends heartbeat data  
- `README.md` — Project documentation  

---

## Usage

### 1. Install Dependencies (if required)

```bash
npm install
```

### 2. Run the Simulator

```bash
node send-heartbeat.js
```

By default, the simulator sends a heartbeat every 5 seconds (configurable).
Each heartbeat is printed to the console and appended as tab-separated values to `heartbeat.log`.

---

## Configuration

Edit `heartbeat.json` to customize:
- Device ID
- Initial device status
- Heartbeat field structure

Edit `send-heartbeat.js` to customize:
- Heartbeat interval (default: 5 seconds)
- Metric generation logic
- Destination endpoint (currently logs to console and `heartbeat.log`)

---

## Heartbeat Payload Fields

| Field Name      | Description                                           | Example Value           |
|-----------------|-------------------------------------------------------|-------------------------|
| deviceId        | Unique device identifier                              | PB-NGP-D001             |
| macAddress      | Device MAC address                                    | 7CDFA13B92F0            |
| timestamp       | ISO 8601 formatted heartbeat timestamp                | 2026-01-16T14:10:30Z    |
| doorState       | Door lock state (toggles approximately every 30s)     | LOCKED / UNLOCKED       |
| eStop           | Emergency stop status                                 | true / false            |
| voltage         | Supply voltage with ±2% variation                     | 229.4 V                 |
| current         | Load current with ±8% variation                       | 1.8 A                   |
| power           | Calculated power (Voltage × Current × 0.95 efficiency)| 410 W                   |
| firmwareVersion | Device firmware version                               | v1.0.0                  |
| signalStrength  | WiFi signal strength (RSSI in dBm)                    | -68                     |
| uptimeSeconds   | Device uptime counter                                 | 5420                    |
| fault           | Fault indicator flag                                  | false                   |
| status          | Device operational status                             | ONLINE / FAULT          |
| temperature     | Operating temperature with ±10% variation             | 42.5 °C                 |

---

## Notes

- This simulator is intended for Day‑1 development and testing purposes.
- Backend HTTP POST integration will be added in later phases.
- The heartbeat payload format is aligned with the PlugBox hardware telemetry design.




