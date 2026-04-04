import React, { useState, useEffect } from 'react';
import { X, MapPin, Zap, DollarSign, Info } from 'lucide-react';
import axios from 'axios';

const EditChargerModal = ({ isOpen, onClose, charger, onChargerUpdated }) => {
  const [formData, setFormData] = useState({
    chargerName: '',
    chargerType: 'AC',
    connectorType: 'Type2',
    location: {
      address: '',
      lat: '',
      lng: ''
    },
    pricePerUnit: '',
    serialNumber: '',
    installationDate: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const chargerTypes = ['AC', 'DC', 'DC_Fast'];
  const connectorTypes = ['Type1', 'Type2', 'CCS', 'CHAdeMO', 'Tesla', 'GB/T', 'J1772'];

  useEffect(() => {
    if (charger) {
      setFormData({
        chargerName: charger.chargerName || '',
        chargerType: charger.chargerType || 'AC',
        connectorType: charger.connectorType || 'Type2',
        location: {
          address: charger.location?.address || '',
          lat: charger.location?.lat?.toString() || '',
          lng: charger.location?.lng?.toString() || ''
        },
        pricePerUnit: charger.pricePerUnit?.toString() || '',
        serialNumber: charger.serialNumber || '',
        installationDate: charger.installationDate ? 
          new Date(charger.installationDate).toISOString().split('T')[0] : 
          new Date().toISOString().split('T')[0]
      });
    }
  }, [charger]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name.includes('location.')) {
      const locationField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [locationField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const validateForm = () => {
    if (!formData.chargerName.trim()) {
      setError('Charger name is required');
      return false;
    }
    if (!formData.location.address.trim()) {
      setError('Address is required');
      return false;
    }
    if (!formData.location.lat || isNaN(formData.location.lat)) {
      setError('Valid latitude is required');
      return false;
    }
    if (!formData.location.lng || isNaN(formData.location.lng)) {
      setError('Valid longitude is required');
      return false;
    }
    if (!formData.pricePerUnit || parseFloat(formData.pricePerUnit) <= 0) {
      setError('Price per unit must be greater than 0');
      return false;
    }
    const lat = parseFloat(formData.location.lat);
    const lng = parseFloat(formData.location.lng);
    if (lat < -90 || lat > 90) {
      setError('Latitude must be between -90 and 90');
      return false;
    }
    if (lng < -180 || lng > 180) {
      setError('Longitude must be between -180 and 180');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        ...formData,
        pricePerUnit: parseFloat(formData.pricePerUnit),
        location: {
          ...formData.location,
          lat: parseFloat(formData.location.lat),
          lng: parseFloat(formData.location.lng)
        }
      };

      await axios.put(`/api/chargers/${charger._id}`, payload);
      onChargerUpdated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update charger');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !charger) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Edit Charger</h2>
            <p className="text-sm text-gray-600 mt-1">Charger ID: {charger.chargerId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Info className="h-5 w-5 mr-2" />
              Basic Information
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Charger Name *
              </label>
              <input
                type="text"
                name="chargerName"
                value={formData.chargerName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Main Street Charger"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Charger Type *
                </label>
                <select
                  name="chargerType"
                  value={formData.chargerType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {chargerTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Connector Type *
                </label>
                <select
                  name="connectorType"
                  value={formData.connectorType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {connectorTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Location
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address *
              </label>
              <input
                type="text"
                name="location.address"
                value={formData.location.address}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123 Main Street, City, State"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Latitude *
                </label>
                <input
                  type="number"
                  step="any"
                  name="location.lat"
                  value={formData.location.lat}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 19.0760"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Longitude *
                </label>
                <input
                  type="number"
                  step="any"
                  name="location.lng"
                  value={formData.location.lng}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 72.8777"
                  required
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Pricing
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price per Unit *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                <input
                  type="number"
                  step="0.01"
                  name="pricePerUnit"
                  value={formData.pricePerUnit}
                  onChange={handleChange}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              Additional Information
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Serial Number
                </label>
                <input
                  type="text"
                  name="serialNumber"
                  value={formData.serialNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Installation Date
                </label>
                <input
                  type="date"
                  name="installationDate"
                  value={formData.installationDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Charger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditChargerModal;
