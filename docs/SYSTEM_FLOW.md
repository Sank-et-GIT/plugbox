# System Flow (Golden Flow)

1. User opens Android app and views nearby chargers
2. User selects a charger
3. Booking hold is created (valid for 2 minutes)
4. Payment is simulated and booking is confirmed
5. User arrives within allowed grace period
6. User scans QR code on charger
7. Backend validates booking and charger state
8. Unlock command is sent to charger
9. Charger door unlocks
10. Current detected → charging starts
11. Charging ends by quota or user action
12. Exit grace period is given
13. Door closed → session finalized
14. Charger becomes available again

This flow is locked for Week-1 and Week-2 development.

## System Flow (Up to Day (4) 18-01-2026)

The EV charger periodically sends heartbeat data to the backend server.
The backend processes this data, updates the charger status and lastSeen time,
and stores it in the PostgreSQL database using Prisma ORM.

A background job in the backend continuously checks for inactive chargers.
If a charger does not send a heartbeat within a defined time threshold,
the backend automatically marks the charger as OFFLINE.

The dashboard and admin panels fetch real-time charger data from the backend
using REST APIs to display live status and last-seen information.
-------------------------------------------------------------------------------------------
### Mermaid diagram
flowchart LR
  A["Device / Charger (Device Simulator)
- Sends heartbeat every 5s
- Payload: {chargerId, status}"] -->|"POST /device/heartbeat"| B["PlugBox Backend (Node.js + Express + TS)
- Updates status + lastSeen
- Offline checker job"]

  B -->|"Prisma write/read"| C[("PostgreSQL DB
Charger table:
id, name, lat, lng,
status, lastSeen, createdAt")]

  B -->|"GET /chargers
GET /admin/chargers"| D["Dashboard / App (Future UI)
- Shows ONLINE/OFFLINE
- lastSeenSecondsAgo"]

  E["Offline Detection Logic
Every 30s:
if now - lastSeen > threshold
then status = OFFLINE"] -.-> B
----------------------------------------------------------------------------------------------