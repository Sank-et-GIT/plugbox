require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth-prisma");
const vendorAuthRoutes = require("./routes/vendorAuth");
const adminRoutes = require("./routes/adminRoutes");
const adminVendorRoutes = require("./routes/adminVendorRoutes");
const adminChargerRoutes = require("./routes/adminChargerRoutes");
const publicTestRoutes = require("./routes/publicTestRoutes");
const dashboardRoutes = require("./routes/dashboard");
const debugRoutes = require("./routes/debug");
const vendorDashboardRoutes = require("./routes/vendorDashboardPrisma");
const vendorChargerRoutes = require("./routes/vendorChargersPrisma");
// const vendorSessionRoutes = require("./routes/vendorSessions");
// const adminRoutes = require("./routes/adminRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const chargerRoutes = require("./routes/chargerRoutes");
// const userRoutes = require("./routes/userRoutes");
// const sessionRoutes = require("./routes/sessionRoutes");
// const paymentRoutes = require("./routes/paymentRoutes");
// const payoutRoutes = require("./routes/payoutRoutes");
// const reportRoutes = require("./routes/reportRoutes");

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  trustProxy: false,
  skip: (req) => {
    return req.url === '/health' || req.url === '/';
  }
});

// Connect to database
connectDB();

// Middleware
app.use(helmet());
app.use(limiter);
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'PlugBox Dashboard API is running...',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vendor/auth', vendorAuthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminVendorRoutes);
app.use('/api/admin', adminChargerRoutes);
app.use('/api/public', publicTestRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/vendor/dashboard', vendorDashboardRoutes);
app.use('/api/vendor/chargers', vendorChargerRoutes);
// app.use('/api/vendor/sessions', vendorSessionRoutes);
app.use('/api/vendor', vendorRoutes);
// app.use('/api/admin', adminRoutes);
app.use('/api/chargers', chargerRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/sessions', sessionRoutes);
// app.use('/api/payments', paymentRoutes);
// app.use('/api/payouts', payoutRoutes);
// app.use('/api/reports', reportRoutes);
app.use('/api/debug', debugRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('All modules are successfully working');
});

module.exports = app;
