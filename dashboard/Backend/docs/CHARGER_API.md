# Charger Management API Documentation

## Overview
Complete CRUD operations for managing EV chargers with vendor-based access control.

## Base URL
```
http://localhost:5000/api/chargers
```

## Authentication
All endpoints require JWT authentication with vendor role.

## Endpoints

### 1. Create Charger
```http
POST /api/chargers
```

**Request Body:**
```json
{
  "chargerName": "Main Street Charger",
  "chargerType": "AC",
  "connectorType": "Type2",
  "location": {
    "address": "123 Main Street, Mumbai, India",
    "lat": 19.0760,
    "lng": 72.8777
  },
  "pricePerUnit": 15.50,
  "serialNumber": "CHR001234",
  "installationDate": "2024-01-15"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Charger created successfully",
  "charger": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e1",
    "chargerId": "CHR000001",
    "chargerName": "Main Street Charger",
    "vendorId": "60f1b2c3d4e5f6a7b8c9d0e2",
    "chargerType": "AC",
    "connectorType": "Type2",
    "location": {
      "address": "123 Main Street, Mumbai, India",
      "lat": 19.0760,
      "lng": 72.8777
    },
    "pricePerUnit": 15.50,
    "status": "Available",
    "serialNumber": "CHR001234",
    "installationDate": "2024-01-15",
    "totalSessions": 0,
    "totalEnergyDelivered": 0,
    "totalRevenue": 0,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. Get All Chargers (Vendor)
```http
GET /api/chargers
```

**Query Parameters:**
- `status` (optional): Filter by status (Available, In_Session, Reserved, Offline, On_Maintenance)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `sortBy` (optional): Sort field (default: createdAt)
- `sortOrder` (optional): Sort order (asc/desc, default: desc)

**Response:**
```json
{
  "success": true,
  "chargers": [
    {
      "_id": "60f1b2c3d4e5f6a7b8c9d0e1",
      "chargerId": "CHR000001",
      "chargerName": "Main Street Charger",
      "vendorId": "60f1b2c3d4e5f6a7b8c9d0e2",
      "chargerType": "AC",
      "connectorType": "Type2",
      "location": {
        "address": "123 Main Street, Mumbai, India",
        "lat": 19.0760,
        "lng": 72.8777
      },
      "pricePerUnit": 15.50,
      "status": "Available",
      "serialNumber": "CHR001234",
      "installationDate": "2024-01-15",
      "totalSessions": 0,
      "totalEnergyDelivered": 0,
      "totalRevenue": 0,
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

### 3. Get Single Charger
```http
GET /api/chargers/:id
```

**Response:**
```json
{
  "success": true,
  "charger": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e1",
    "chargerId": "CHR000001",
    "chargerName": "Main Street Charger",
    "vendorId": "60f1b2c3d4e5f6a7b8c9d0e2",
    "chargerType": "AC",
    "connectorType": "Type2",
    "location": {
      "address": "123 Main Street, Mumbai, India",
      "lat": 19.0760,
      "lng": 72.8777
    },
    "pricePerUnit": 15.50,
    "status": "Available",
    "serialNumber": "CHR001234",
    "installationDate": "2024-01-15",
    "totalSessions": 0,
    "totalEnergyDelivered": 0,
    "totalRevenue": 0,
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Update Charger
```http
PUT /api/chargers/:id
```

**Request Body:**
```json
{
  "chargerName": "Updated Main Street Charger",
  "pricePerUnit": 20.00,
  "location": {
    "address": "123 Main Street, Mumbai, India",
    "lat": 19.0760,
    "lng": 72.8777
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Charger updated successfully",
  "charger": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e1",
    "chargerId": "CHR000001",
    "chargerName": "Updated Main Street Charger",
    "pricePerUnit": 20.00,
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### 5. Update Charger Status
```http
PATCH /api/chargers/:id/status
```

**Request Body:**
```json
{
  "status": "On_Maintenance"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Charger status updated successfully",
  "charger": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e1",
    "status": "On_Maintenance",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### 6. Delete Charger (Soft Delete)
```http
DELETE /api/chargers/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Charger deleted successfully"
}
```

### 7. Get Charger Statistics
```http
GET /api/chargers/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalChargers": 5,
    "availableChargers": 3,
    "inSessionChargers": 1,
    "offlineChargers": 0,
    "maintenanceChargers": 1,
    "totalSessions": 150,
    "totalEnergyDelivered": 2500.5,
    "totalRevenue": 37500.75,
    "averagePricePerUnit": 18.5
  },
  "statusBreakdown": [
    { "_id": "Available", "count": 3 },
    { "_id": "In_Session", "count": 1 },
    { "_id": "On_Maintenance", "count": 1 }
  ]
}
```

## Validation Rules

### Required Fields
- `chargerName`: String, max 100 characters
- `chargerType`: Enum ['AC', 'DC', 'DC_Fast']
- `connectorType`: Enum ['Type1', 'Type2', 'CCS', 'CHAdeMO', 'Tesla', 'GB/T', 'J1772']
- `location.address`: String, max 500 characters
- `location.lat`: Number, -90 to 90
- `location.lng`: Number, -180 to 180
- `pricePerUnit`: Number, must be > 0

### Optional Fields
- `serialNumber`: String, max 50 characters
- `installationDate`: Date (defaults to current date)

## Status Values
- `Available`: Charger is ready for use
- `In_Session`: Currently charging a vehicle
- `Reserved`: Reserved for upcoming session
- `Offline`: Not connected to network
- `On_Maintenance`: Under maintenance

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Charger name is required",
    "Price per unit must be greater than 0"
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied: You can only access your own chargers"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Charger not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Security Features

1. **Vendor Isolation**: Vendors can only access their own chargers
2. **JWT Authentication**: All endpoints require valid JWT token
3. **Input Validation**: Comprehensive validation for all inputs
4. **Rate Limiting**: Protection against abuse
5. **Soft Delete**: Chargers are marked inactive instead of hard deletion

## Auto-Generated Features

1. **Charger ID**: Automatically generated in format `CHR000001`
2. **Timestamps**: `createdAt` and `updatedAt` automatically managed
3. **Statistics**: Usage stats tracked automatically
4. **Virtual Fields**: `isOperational` and `averageSessionRevenue` calculated dynamically
