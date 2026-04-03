# PlugBox Admin Dashboard

A comprehensive EV charging management system with full-stack authentication and real-time dashboard analytics.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Real-time Dashboard**: Live statistics for users, vendors, chargers, and sessions
- **Revenue Analytics**: Interactive charts for revenue trends and session data
- **Charger Management**: Monitor charger status and performance
- **Vendor Management**: Complete vendor lifecycle management
- **Session Tracking**: Real-time charging session monitoring
- **Payment Processing**: Integrated payment and payout systems
- **Responsive Design**: Modern UI built with Tailwind CSS

## Tech Stack

### Backend
- Node.js & Express.js
- MongoDB with Mongoose ODM
- JWT Authentication
- bcryptjs for password hashing
- Express Validator for input validation
- Helmet & Rate Limiting for security

### Frontend
- React 18 with React Router
- Tailwind CSS for styling
- Recharts for data visualization
- Lucide React for icons
- Axios for API communication

## Project Structure

```
dashboard/
├── Backend/
│   ├── config/
│   │   └── db.js              # Database configuration
│   ├── middleware/
│   │   └── auth.js             # Authentication middleware
│   ├── models/
│   │   ├── User.js             # User model
│   │   ├── Vendor.js           # Vendor model
│   │   ├── Charger.js          # Charger model
│   │   └── Session.js          # Session model
│   ├── routes/
│   │   ├── auth.js             # Authentication routes
│   │   ├── dashboard.js        # Dashboard data routes
│   │   └── ...                 # Other module routes
│   ├── package.json
│   └── server.js               # Main server file
└── Frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   │   ├── Sidebar.js
    │   │   ├── Header.js
    │   │   ├── StatCard.js
    │   │   ├── ChargerStatus.js
    │   │   ├── RevenueChart.js
    │   │   └── SessionsChart.js
    │   ├── contexts/
    │   │   └── AuthContext.js
    │   ├── pages/
    │   │   ├── Login.js
    │   │   ├── Dashboard.js
    │   │   └── ...              # Other pages
    │   ├── App.js
    │   ├── index.js
    │   └── index.css
    ├── package.json
    ├── tailwind.config.js
    └── postcss.config.js
```

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd Backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with the following variables:
```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/plugbox?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRE=7d
```

4. Start the backend server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd Frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the frontend development server:
```bash
npm start
```

## Default Admin Account

To create an admin account, you can register through the login page or use the API directly:

```bash
POST /api/auth/register
{
  "name": "Admin User",
  "email": "admin@plugbox.com",
  "password": "admin123",
  "phoneNumber": "+1234567890",
  "role": "admin"
}
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/logout` - Logout user

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/revenue-trend` - Get revenue trend data
- `GET /api/dashboard/sessions-over-time` - Get sessions over time
- `GET /api/dashboard/recent-activities` - Get recent activities
- `GET /api/dashboard/top-vendors` - Get top performing vendors

## Features Implementation

### Authentication System
- JWT-based authentication with secure token storage
- Role-based access control (user, admin, super_admin)
- Password hashing with bcryptjs
- Protected routes with middleware

### Dashboard Analytics
- Real-time statistics for all key metrics
- Interactive charts using Recharts
- Responsive grid layout
- Color-coded status indicators

### Charger Status Monitoring
- Live status tracking (Available, In Session, Offline, Reserved, Maintenance)
- Performance metrics and uptime tracking
- Location-based charger management

## Security Features

- Input validation with express-validator
- Rate limiting to prevent abuse
- CORS configuration
- Helmet for security headers
- Password hashing and JWT tokens

## Deployment

### Backend Deployment
1. Set production environment variables
2. Build and deploy to your preferred hosting platform
3. Ensure MongoDB connection string is properly configured

### Frontend Deployment
1. Build the React app: `npm run build`
2. Deploy the build folder to your hosting service
3. Configure environment variables for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please contact the development team.
