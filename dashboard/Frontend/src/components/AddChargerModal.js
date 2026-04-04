import React, { useState, useEffect } from 'react';
import { X, MapPin, Zap, DollarSign, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import {
  useChargerValidation,
  ValidatedInput,
  ValidatedSelect,
  ValidatedTextarea,
  CompatibilityWarning,
  ValidationSummary
} from './ChargerValidation';

const AddChargerModal = ({ isOpen, onClose, onChargerAdded }) => {
  const [formData, setFormData] = useState({
    chargerName: '',
    chargerType: '',
    connectorType: '',
    location: {
      address: '',
      lat: '',
      lng: ''
    },
    pricePerUnit: '',
    serialNumber: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Charger type options
  const chargerTypeOptions = [
    { value: 'AC', label: 'AC Charger' },
    { value: 'DC', label: 'DC Charger' },
    { value: 'DC_Fast', label: 'DC Fast Charger' },
    { value: 'Type1', label: 'Type 1 Charger' },
    { value: 'Type2', label: 'Type 2 Charger' },
    { value: 'CCS', label: 'CCS Charger' },
    { value: 'CHAdeMO', label: 'CHAdeMO Charger' },
    { value: 'Tesla', label: 'Tesla Charger' }
  ];

  // Get connector options based on charger type
  const getConnectorOptions = (chargerType) => {
    const allOptions = [
      { value: 'Type1', label: 'Type 1' },
      { value: 'Type2', label: 'Type 2' },
      { value: 'CCS', label: 'CCS' },
      { value: 'CHAdeMO', label: 'CHAdeMO' },
      { value: 'Tesla', label: 'Tesla' },
      { value: 'GB/T', label: 'GB/T' },
      { value: 'J1772', label: 'J1772' }
    ];

    if (!chargerType) return allOptions;

    const compatibleConnectors = {
      'AC': ['Type1', 'Type2', 'J1772', 'Tesla'],
      'DC': ['CCS', 'CHAdeMO', 'Tesla'],
      'DC_Fast': ['CCS', 'CHAdeMO', 'Tesla'],
      'Type1': ['Type1'],
      'Type2': ['Type2'],
      'CCS': ['CCS'],
      'CHAdeMO': ['CHAdeMO'],
      'Tesla': ['Tesla']
    };

    const compatible = compatibleConnectors[chargerType] || [];
    return allOptions.filter(option => compatible.includes(option.value));
  };

  const { errors, touched, setTouched, isFormValid } = useChargerValidation(formData);

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Reset connector type when charger type changes
    if (field === 'chargerType') {
      setFormData(prev => ({
        ...prev,
        chargerType: value,
        connectorType: ''
      }));
    }

    setTouched(prev => ({
      ...prev,
      [field]: true
    }));
  };

  const handleLocationChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      location: {
        ...prev.location,
        [field]: value
      }
    }));

    setTouched(prev => ({
      ...prev,
      [field]: true
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent submission if form is invalid
    if (!isFormValid) {
      // Mark all fields as touched to show validation errors
      setTouched({
        chargerName: true,
        chargerType: true,
        connectorType: true,
        address: true,
        latitude: true,
        longitude: true,
        pricePerUnit: true,
        serialNumber: true
      });
      return;
    }

    setLoading(true);
    setSubmitError('');

    try {
      const response = await axios.post('/api/chargers', formData);
      
      if (response.data.success) {
        setSubmitSuccess(true);
        setTimeout(() => {
          onChargerAdded();
          handleClose();
        }, 2000);
      } else {
        setSubmitError(response.data.message || 'Failed to create charger');
      }
    } catch (error) {
      console.error('Error creating charger:', error);
      
      if (error.response?.data?.errors) {
        setSubmitError(error.response.data.errors.join(', '));
      } else {
        setSubmitError(error.response?.data?.message || 'Failed to create charger. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form and state
    setFormData({
      chargerName: '',
      chargerType: '',
      connectorType: '',
      location: {
        address: '',
        lat: '',
        lng: ''
      },
      pricePerUnit: '',
      serialNumber: ''
    });
    setSubmitError('');
    setSubmitSuccess(false);
    setTouched({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Add New Charger</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Success Message */}
          {submitSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-800 font-medium">Charger created successfully!</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-red-800">{submitError}</span>
              </div>
            </div>
          )}

          {/* Validation Summary */}
          <ValidationSummary errors={errors} touched={touched} />

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Info className="h-5 w-5 mr-2" />
              Basic Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ValidatedInput
                name="chargerName"
                label="Charger Name"
                value={formData.chargerName}
                onChange={(e) => handleChange('chargerName', e.target.value)}
                placeholder="e.g., Main Street Charger"
                required
              />
              
              <ValidatedInput
                name="serialNumber"
                label="Serial Number (Optional)"
                value={formData.serialNumber}
                onChange={(e) => handleChange('serialNumber', e.target.value.toUpperCase())}
                placeholder="e.g., CHR001234"
              />
            </div>
          </div>

          {/* Charger Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              Charger Configuration
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ValidatedSelect
                name="chargerType"
                label="Charger Type"
                value={formData.chargerType}
                onChange={(e) => handleChange('chargerType', e.target.value)}
                options={chargerTypeOptions}
                required
              />
              
              <ValidatedSelect
                name="connectorType"
                label="Connector Type"
                value={formData.connectorType}
                onChange={(e) => handleChange('connectorType', e.target.value)}
                options={getConnectorOptions(formData.chargerType)}
                required
                disabled={!formData.chargerType}
              />
            </div>

            {/* Compatibility Warning */}
            <CompatibilityWarning 
              chargerType={formData.chargerType} 
              connectorType={formData.connectorType} 
            />
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Location
            </h3>
            
            <ValidatedTextarea
              name="address"
              label="Address"
              value={formData.location.address}
              onChange={(e) => handleLocationChange('address', e.target.value)}
              placeholder="Enter complete address where the charger is installed"
              rows={3}
              required
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ValidatedInput
                name="latitude"
                label="Latitude"
                type="number"
                step="any"
                value={formData.location.lat}
                onChange={(e) => handleLocationChange('lat', parseFloat(e.target.value))}
                placeholder="e.g., 19.0760"
                required
              />
              
              <ValidatedInput
                name="longitude"
                label="Longitude"
                type="number"
                step="any"
                value={formData.location.lng}
                onChange={(e) => handleLocationChange('lng', parseFloat(e.target.value))}
                placeholder="e.g., 72.8777"
                required
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Pricing
            </h3>
            
            <ValidatedInput
              name="pricePerUnit"
              label="Price per Unit (₹)"
              type="number"
              step="0.01"
              min="0.01"
              max="10000"
              value={formData.pricePerUnit}
              onChange={(e) => handleChange('pricePerUnit', parseFloat(e.target.value))}
              placeholder="e.g., 15.50"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Charger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddChargerModal;
