# High-Level Architecture

The PlugBox system consists of four main components:

1. Android Application
   - Used by customers
   - Handles booking, QR scan, and session state

2. Backend Server
   - Node.js + Express
   - Handles business logic, bookings, sessions
   - Communicates with both app and device

3. Web Dashboard
   - Used by Host and Admin
   - Shows chargers, sessions, earnings

4. Charger Device (Simulator / Hardware)
   - Sends heartbeat
   - Receives unlock commands
   - Reports current detection

Communication is REST-based.
State is persisted in the backend database.
