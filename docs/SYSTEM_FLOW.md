# System Flow

## System Flow (Golden Flow – Planned)

This is the complete expected flow of the system.
Some steps are planned and will be implemented in later days.

1. User opens Android app and views nearby chargers
2. User selects a charger
3. Booking hold is created (valid for limited time)
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

This full flow will be completed in later development phases.

---

## System Flow (Implemented up to date 18-01-2026)

### Device Monitoring Flow

- The EV charger (simulated device) sends heartbeat messages to the backend at regular intervals.
- The backend receives the heartbeat and updates the charger status and lastSeen time.
- Charger information is stored in the PostgreSQL database using Prisma ORM.

### Offline Detection Logic

- The backend runs a background job at regular intervals.
- If a charger does not send a heartbeat within the allowed time,
  the backend automatically marks the charger as OFFLINE.
- This ensures correct charger availability even if a device disconnects unexpectedly.

### Booking Hold Flow

- A user can place a temporary booking hold on a charger.
- Only one active hold is allowed per charger at a time.
- If a charger is already held, new hold requests are rejected.
- Booking holds automatically expire after the configured time.
- Once expired, the charger becomes available for new holds.

### Data Access Flow

- The dashboard and admin panel fetch charger data using backend APIs.
- APIs return charger status, last seen time, and time since last update.
- This enables real-time charger monitoring.

---

## Diagram (Current Implementation)

```mermaid
flowchart LR
  A[Device / Charger Simulator] -->|POST /device/heartbeat| B[Backend Server]
  B -->|Update status & lastSeen| C[(PostgreSQL Database)]
  B -->|GET /chargers| D[Dashboard / Admin]
  B -->|Offline check| B
