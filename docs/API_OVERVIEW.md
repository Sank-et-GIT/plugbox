# API Overview

This document lists the backend APIs implemented so far.
Request and response formats may be refined later as the project grows.

---

## Health

### GET /health
Checks if the backend server is running.
Returns a simple OK response.

---

## Chargers

### GET /chargers
Returns the list of chargers with:
- location details
- current status (ONLINE / OFFLINE / etc.)
- last seen time and seconds since last update

Used by dashboard and mobile app for live monitoring.

### GET /admin/chargers
Returns the charger list for admin use.
Currently same data as public chargers, may include more details later.

---

## Device APIs

### POST /device/heartbeat
Used by the charger (or device simulator) to inform the backend that it is alive.

Updates:
- charger status
- last seen timestamp

This API is called periodically by the device.

---

## Bookings

### POST /bookings/hold
Places a temporary hold on a charger for a short duration.

Rules:
- Only one active hold is allowed per charger
- If the charger is already held, the request is rejected
- Holds automatically expire after the configured time

Used to prevent multiple users from selecting the same charger.

---

## Sessions (Planned)

### POST /sessions/start
Will be used to start a charging session after a successful booking hold.

---

## Device Commands (Planned)

### GET /device/commands
Will be used by the device to fetch commands from the backend.

### POST /device/ack
Will be used by the device to acknowledge received commands.
