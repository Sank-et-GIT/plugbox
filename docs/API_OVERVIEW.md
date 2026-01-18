# API Overview (Draft)

This document lists planned backend endpoints.
Exact request/response formats may evolve.

## Health
GET /health

## Chargers
GET /chargers
GET /admin/chargers

## Bookings
POST /bookings/hold

## Sessions
POST /sessions/start

## Device APIs
POST /device/heartbeat - Updates charger status and last-seen time using periodic device heartbeats

GET /chargers - eturns live charger list with status and last-seen information for monitoring

GET /admin/chargers - Returns charger list for administrative and management purposes.

GET /device/commands

POST /device/ack
