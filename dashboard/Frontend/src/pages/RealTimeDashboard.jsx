import React, { useState, useEffect } from 'react';
import socketService from '../services/socketService';
import RealTimeChargerCard from '../components/RealTimeChargerCard';

const RealTimeDashboard = () => {
  const [chargers, setChargers] = useState([]);
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [mqttStatus, setMqttStatus] = useState('disconnected');
  const [realTimeStats, setRealTimeStats] = useState({
    totalChargers: 0,
    onlineChargers: 0,
    activeChargers: 0,
    totalPower: 0,
    totalEnergy: 0
  });

  useEffect(() => {
    // Initialize WebSocket connection
    socketService.connect().then(() => {
      setSocketStatus('connected');
    }).catch(() => {
      setSocketStatus('error');
    });

    // Fetch initial charger data
    fetchChargers();

    // Listen for global updates
    const handleChargerUpdate = (data) => {
      updateChargerInList(data.chargerId, data.data);
      updateStats();
    };

    const handleEnergyReading = (data) => {
      console.log('📡 Energy reading received:', data);
      updateChargerEnergy(data.chargerId, data.reading);
      updateStats();
    };

    const handleSessionUpdate = (data) => {
      // Handle session updates
      console.log('Session update:', data);
    };

    socketService.on('charger-update', handleChargerUpdate);
    socketService.on('energy-reading', handleEnergyReading);
    socketService.on('session-update', handleSessionUpdate);

    return () => {
      socketService.off('charger-update', handleChargerUpdate);
      socketService.off('energy-reading', handleEnergyReading);
      socketService.off('session-update', handleSessionUpdate);
    };
  }, []);

  // Join charger rooms when chargers data changes
  useEffect(() => {
    if (socketStatus === 'connected' && chargers.length > 0) {
      console.log('Joining charger rooms for:', chargers.map(c => c.id));
      chargers.forEach(charger => {
        socketService.joinChargerRoom(charger.id);
        console.log(`Joined room for charger ${charger.id}: ${charger.name}`);
      });
    }
  }, [chargers, socketStatus]);

  const fetchChargers = async () => {
    try {
      const response = await fetch('http://localhost:5002/api/public/test-chargers');
      const data = await response.json();
      
      console.log('Fetched chargers:', data);
      
      if (data.chargers) {
        setChargers(data.chargers);
        updateStats();
      } else if (Array.isArray(data)) {
        setChargers(data);
        updateStats();
      }
    } catch (error) {
      console.error('Error fetching chargers:', error);
    }
  };

  const updateChargerInList = (chargerId, updateData) => {
    setChargers(prev => prev.map(charger => 
      charger.id === chargerId 
        ? { ...charger, ...updateData }
        : charger
    ));
  };

  const updateChargerEnergy = (chargerId, energyData) => {
    setChargers(prev => prev.map(charger => 
      charger.id === chargerId 
        ? { ...charger, currentEnergy: energyData }
        : charger
    ));
  };

  const updateStats = () => {
    setChargers(prev => {
      const stats = {
        totalChargers: prev.length,
        onlineChargers: prev.filter(c => c.status === 'ONLINE').length,
        activeChargers: prev.filter(c => c.status === 'ACTIVE').length,
        totalPower: prev.reduce((sum, c) => sum + (c.currentEnergy?.power || 0), 0),
        totalEnergy: prev.reduce((sum, c) => sum + (c.currentEnergy?.energy || 0), 0)
      };
      setRealTimeStats(stats);
      return prev;
    });
  };

  const getSocketStatusColor = () => {
    switch (socketStatus) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'connecting': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getChargerStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'active': return 'bg-blue-500';
      case 'charging': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Real-Time Charger Dashboard</h1>
        <p className="text-gray-600">Monitor and control your chargers in real-time</p>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">WebSocket Status</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSocketStatusColor()}`}>
              {socketStatus}
            </span>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">MQTT Broker</span>
            <span className="px-2 py-1 rounded-full text-xs font-medium text-green-600 bg-green-100">
              Connected
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Last Update</span>
            <span className="text-xs font-medium text-gray-500">
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* Real-Time Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-gray-800">{realTimeStats.totalChargers}</div>
          <div className="text-sm text-gray-600">Total Chargers</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">{realTimeStats.onlineChargers}</div>
          <div className="text-sm text-gray-600">Online</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-600">{realTimeStats.activeChargers}</div>
          <div className="text-sm text-gray-600">Active</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-yellow-600">{realTimeStats.totalPower.toFixed(0)}W</div>
          <div className="text-sm text-gray-600">Total Power</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-purple-600">{realTimeStats.totalEnergy.toFixed(2)}kWh</div>
          <div className="text-sm text-gray-600">Total Energy</div>
        </div>
      </div>

      {/* Charger Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {chargers.map((charger) => (
          <RealTimeChargerCard key={charger.id} charger={charger} />
        ))}
        
        {chargers.length === 0 && (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-500 text-lg">No chargers found</div>
            <div className="text-gray-400 text-sm mt-2">
              Start the charger simulator to see real-time data
            </div>
            <button
              onClick={fetchChargers}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Refresh Chargers
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">🚀 How to See Real-Time Data:</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <div>1. Start the charger simulator: <code className="bg-blue-100 px-1 rounded">node simulate-charger.js</code></div>
          <div>2. Watch the data update automatically in real-time</div>
          <div>3. Use the control buttons to send commands to chargers</div>
          <div>4. Monitor power, energy, voltage, and current metrics</div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeDashboard;
