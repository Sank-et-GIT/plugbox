import React, { useState, useEffect } from 'react';
import socketService from '../services/socketService';

const RealTimeChargerCard = ({ charger }) => {
  const [realTimeData, setRealTimeData] = useState({
    status: charger.status || 'OFFLINE',
    energy: 0,
    power: 0,
    voltage: 0,
    current: 0,
    lastSeen: null
  });
  const [isConnected, setIsConnected] = useState(false);
  const [commandLoading, setCommandLoading] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    socketService.connect().then(() => {
      setIsConnected(true);
      // Join charger room for updates
      socketService.joinChargerRoom(charger.id);
    });

    // Listen for real-time updates
    const handleChargerUpdate = (data) => {
      if (data.chargerId === charger.id) {
        setRealTimeData(prev => ({
          ...prev,
          status: data.data.status || prev.status,
          lastSeen: new Date()
        }));
      }
    };

    const handleEnergyReading = (data) => {
      if (data.chargerId === charger.id) {
        setRealTimeData(prev => ({
          ...prev,
          ...data.reading,
          lastSeen: new Date()
        }));
      }
    };

    const handleCommandResponse = (data) => {
      if (data.chargerId === charger.id) {
        setCommandLoading(false);
      }
    };

    socketService.on('charger-update', handleChargerUpdate);
    socketService.on('energy-reading', handleEnergyReading);
    socketService.on('command-sent', handleCommandResponse);

    return () => {
      socketService.off('charger-update', handleChargerUpdate);
      socketService.off('energy-reading', handleEnergyReading);
      socketService.off('command-sent', handleCommandResponse);
    };
  }, [charger.id]);

  const sendCommand = async (command) => {
    setCommandLoading(true);
    socketService.sendChargerCommand(charger.id, command);
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'active': return 'bg-blue-500';
      case 'charging': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toLowerCase()) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      case 'active': return 'Active';
      case 'charging': return 'Charging';
      default: return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{charger.name || charger.displayName}</h3>
          <p className="text-sm text-gray-600">ID: {charger.id}</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(realTimeData.status)} animate-pulse`}></div>
          <span className="text-sm font-medium text-gray-700">
            {getStatusText(realTimeData.status)}
          </span>
        </div>
      </div>

      {/* Connection Status */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">WebSocket:</span>
          <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {realTimeData.lastSeen && (
          <div className="text-xs text-gray-500 mt-1">
            Last update: {realTimeData.lastSeen.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Real-time Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-600">Power</div>
          <div className="text-lg font-semibold text-gray-800">
            {realTimeData.power ? `${realTimeData.power.toFixed(1)}W` : '0W'}
          </div>
        </div>
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-600">Energy</div>
          <div className="text-lg font-semibold text-gray-800">
            {realTimeData.energy ? `${realTimeData.energy.toFixed(2)}kWh` : '0kWh'}
          </div>
        </div>
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-600">Voltage</div>
          <div className="text-lg font-semibold text-gray-800">
            {realTimeData.voltage ? `${realTimeData.voltage.toFixed(1)}V` : '0V'}
          </div>
        </div>
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-600">Current</div>
          <div className="text-lg font-semibold text-gray-800">
            {realTimeData.current ? `${realTimeData.current.toFixed(1)}A` : '0A'}
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={() => sendCommand('unlock')}
          disabled={commandLoading || !isConnected}
          className="flex-1 bg-blue-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {commandLoading ? 'Sending...' : 'Unlock'}
        </button>
        <button
          onClick={() => sendCommand('lock')}
          disabled={commandLoading || !isConnected}
          className="flex-1 bg-red-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {commandLoading ? 'Sending...' : 'Lock'}
        </button>
      </div>
    </div>
  );
};

export default RealTimeChargerCard;
