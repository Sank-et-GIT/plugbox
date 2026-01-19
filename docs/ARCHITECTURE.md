# High-Level Architecture

The PlugBox system is designed as a centralized backend-controlled EV charging system.

It consists of the following main components:

---

## 1. Android Application (Planned)

- Used by end users
- Will allow users to view chargers and place bookings
- Will interact with the backend using REST APIs

(This component is planned and not yet implemented.)

---

## 2. Backend Server (Implemented)

- Built using Node.js and Express
- Acts as the core control system
- Handles:
  - Charger monitoring
  - Device heartbeats
  - Booking holds and expiry
  - Offline detection logic
- Communicates with both devices and frontend clients

This is the primary component implemented so far.

---

## 3. Database (Implemented)

- PostgreSQL database accessed using Prisma ORM
- Stores:
  - Charger details and status
  - Last seen timestamps
  - Booking hold information
- Ensures data persistence across server restarts

---

## 4. Charger Device / Device Simulator (Implemented)

- Represents a real EV charger
- Periodically sends heartbeat messages to the backend
- Used to simulate real hardware behavior during development

---

## 5. Web Dashboard (Planned)

- Will be used by admin or host users
- Will display charger status, bookings, and sessions
- Will consume backend APIs for live data

---

## Communication Model

- All communication is REST-based
- Devices and clients communicate only with the backend
- The backend controls system state and decision-making

---

This architecture ensures centralized control, real-time monitoring,
and scalable integration of chargers and user applications.
