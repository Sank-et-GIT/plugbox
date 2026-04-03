import React from 'react';
import { Zap, Clock, Wifi, Calendar, Wrench } from 'lucide-react';

const ChargerStatus = ({ status, count, color }) => {
  const getStatusIcon = () => {
    switch (status.toLowerCase().replace(' ', '_')) {
      case 'available':
        return <Zap size={20} />;
      case 'in_session':
        return <Clock size={20} />;
      case 'offline':
        return <Wifi size={20} />;
      case 'reserved':
        return <Calendar size={20} />;
      case 'maintenance':
        return <Wrench size={20} />;
      default:
        return <Zap size={20} />;
    }
  };

  const colorClasses = {
    green: 'bg-green-50 text-green-600 border-green-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200'
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]} bg-opacity-20`}>
          {getStatusIcon()}
        </div>
        <span className="text-2xl font-bold text-gray-900">{count}</span>
      </div>
      <p className="text-sm font-medium text-gray-700 mt-2">{status}</p>
    </div>
  );
};

export default ChargerStatus;
