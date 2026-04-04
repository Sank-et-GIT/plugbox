# PlugBox EV Charging Management System

A comprehensive EV charging station management platform with vendor dashboards, charger management, and real-time monitoring.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- PostgreSQL 16 (recommended) or SQLite (for development)
- Git

### 1. Clone Repository
```bash
git clone <repository-url>
cd plugbox
```

### 2. Install Dependencies

**Backend:**
```bash
cd dashboard/Backend
npm install
```

**Frontend:**
```bash
cd dashboard/Frontend  
npm install
```

### 3. Database Setup

#### Option A: PostgreSQL (Recommended)
1. Install PostgreSQL 16
2. Create database: `CREATE DATABASE plugbox;`
3. Update `prisma/schema.prisma` with your credentials:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = "postgresql://username:password@localhost:5432/plugbox?schema=public"
   }
   ```
4. Generate Prisma client:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

#### Option B: SQLite (Development)
1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = "file:./dev.db"
   }
   ```
2. Generate Prisma client:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

### 4. Environment Setup

Create `.env` file in `dashboard/Backend/`:
```env
PORT=5001
JWT_SECRET=your-secret-key-here
DATABASE_URL=your-database-url-here
```

### 5. Initialize Data

Run setup scripts to create admin user and sample data:
```bash
cd dashboard/Backend

# Create admin user
node create-admin.js

# Create test vendor and chargers
node create-test-user.js
node add-sample-chargers.js

# Assign chargers to vendor (if needed)
node check-vendor-chargers.js
```

### 6. Start Servers

**Backend:**
```bash
cd dashboard/Backend
npm run dev
```

**Frontend:**
```bash
cd dashboard/Frontend
PORT=3002 npm start
```

### 7. Access Application

- **Frontend**: http://localhost:3002
- **Backend API**: http://localhost:5001
- **Health Check**: http://localhost:5001/health

## 🔑 Default Credentials

### Admin Access
- **Email**: admin@plugbox.com
- **Password**: password123

### Vendor Access  
- **Email**: testvendor@plugbox.com
- **Password**: password123

## 📊 Database Schema

### Key Models
- **User**: User profiles and authentication
- **Vendor**: Vendor business information
- **Charger**: EV charging stations
- **Location**: Physical charger locations
- **Session**: Charging sessions
- **Booking**: Charger reservations

## 🔧 API Endpoints

### Authentication
- `POST /api/vendor/auth/login` - Vendor login
- `POST /api/auth/login` - Admin login

### Vendor Management
- `GET /api/vendor/chargers` - Get vendor's chargers
- `POST /api/vendor/chargers` - Create new charger
- `PUT /api/vendor/chargers/:id` - Update charger
- `DELETE /api/vendor/chargers/:id` - Delete charger

### Admin Management
- `GET /api/chargers` - Get all chargers (admin only)
- `GET /api/admin/vendors` - Get all vendors

## 🚨 Common Issues & Solutions

### Issue: "No chargers found" 
**Cause**: Chargers not assigned to vendor or wrong API endpoint
**Solution**: 
```bash
cd dashboard/Backend
node check-vendor-chargers.js
```

### Issue: Database connection errors
**Cause**: Incorrect DATABASE_URL or database not running
**Solution**: 
1. Verify PostgreSQL is running: `pg_isready`
2. Check database connection string in `.env`
3. Run `npx prisma db push` to sync schema

### Issue: Authentication errors
**Cause**: Missing or invalid JWT token
**Solution**: 
1. Login again to get fresh token
2. Check token expiration
3. Verify JWT_SECRET in `.env`

### Issue: Port conflicts
**Cause**: Ports 5001 or 3002 already in use
**Solution**: 
```bash
# Kill existing processes
taskkill /F /IM node.exe
# Or use different ports
PORT=5002 npm run dev
```

## 🛠 Development Scripts

### Windows PowerShell
```powershell
# Restart all servers
.\dashboard\restart-all-windows.ps1

# Start individual servers
cd dashboard\Backend; npm run dev
cd dashboard\Frontend; $env:PORT="3002"; npm start
```

### Linux/Mac
```bash
# Restart all servers
chmod +x dashboard/restart-all.sh
./dashboard/restart-all.sh
```

## 📁 Project Structure

```
plugbox/
├── dashboard/
│   ├── Backend/              # Node.js/Express API
│   │   ├── controllers/      # Route handlers
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Auth/validation
│   │   ├── services/        # Business logic
│   │   └── prisma/         # Database schema
│   └── Frontend/           # React application
│       ├── src/
│       │   ├── components/   # Reusable components
│       │   ├── pages/       # Page components
│       │   └── contexts/    # React contexts
├── backend/                # Alternative backend
├── android/               # Mobile app
└── docs/                 # Documentation
```

## 🔄 Data Flow

1. **Vendor Login** → JWT Token → Authenticated Requests
2. **Charger Management** → Vendor-specific filtering
3. **Real-time Updates** → MQTT/WebSocket (future)
4. **Payment Processing** → Razorpay integration (future)

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues:
1. Check this README first
2. Review logs in browser console
3. Check backend server logs
4. Create GitHub issue with details

---

**Note**: This application is continuously evolving. Check for updates regularly.
