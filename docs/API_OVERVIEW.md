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

## Device
POST /device/heartbeat
GET /device/commands
POST /device/ack
