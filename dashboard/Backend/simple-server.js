require('dotenv').config();
const express = require('express');
const cors = require('cors');
const chargerController = require('./controllers/chargerController');
const authRoutes = require('./routes/prisma-auth');

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'PlugBox Dashboard API is running' });
});

// Auth endpoints
app.use('/api/auth', authRoutes);

// Charger endpoints
app.get('/api/chargers', chargerController.getChargers);
app.get('/api/chargers/stats', chargerController.getChargerStats);
app.get('/api/chargers/:id', chargerController.getChargerById);
app.post('/api/chargers', chargerController.createCharger);
app.put('/api/chargers/:id', chargerController.updateCharger);
app.delete('/api/chargers/:id', chargerController.deleteCharger);
app.patch('/api/chargers/:id/status', chargerController.updateChargerStatus);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`⚡ PlugBox Dashboard API running on http://localhost:${PORT}`);
  console.log('📊 Chargers endpoint: http://localhost:${PORT}/api/chargers');
  console.log('📈 Stats endpoint: http://localhost:${PORT}/api/chargers/stats');
});

process.on('SIGINT', () => {
  console.log('\n🔌 Shutting down...');
  process.exit(0);
});
