import React, { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Zap, DollarSign, Save, X, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const EditCharger = ({ chargerId, onBack, onSuccess }) => {
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
    serialNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetchLoading, setFetchLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const totalSteps = 3;

  useEffect(() => {
    fetchChargerData();
  }, [chargerId]);

  const fetchChargerData = async () => {
    try {
      setFetchLoading(true);
      const response = await axios.get(`/api/chargers/${chargerId}`);
      const charger = response.data.charger;
      
      setFormData({
        chargerName: charger.chargerName || '',
        chargerType: charger.chargerType || 'AC',
        connectorType: charger.connectorType || 'Type2',
        location: {
          address: charger.location?.address || '',
          lat: charger.location?.lat || '',
          lng: charger.location?.lng || ''
        },
        pricePerUnit: charger.pricePerUnit || '',
        serialNumber: charger.serialNumber || ''
      });
      
      setOriginalData(charger);
    } catch (err) {
      setError('Failed to load charger data');
      console.error('Error fetching charger:', err);
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    if (originalData) {
      const changed = 
        formData.chargerName !== originalData.chargerName ||
        formData.chargerType !== originalData.chargerType ||
        formData.connectorType !== originalData.connectorType ||
        formData.location.address !== originalData.location?.address ||
        formData.location.lat !== originalData.location?.lat ||
        formData.location.lng !== originalData.location?.lng ||
        formData.pricePerUnit !== originalData.pricePerUnit ||
        formData.serialNumber !== originalData.serialNumber;
      
      setHasChanges(changed);
    }
  }, [formData, originalData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
      return;
    }

    if (!hasChanges) {
      setError('No changes made to update');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.put(`/api/chargers/${chargerId}`, formData);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update charger');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
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
  };

  const resetForm = () => {
    if (originalData) {
      setFormData({
        chargerName: originalData.chargerName || '',
        chargerType: originalData.chargerType || 'AC',
        connectorType: originalData.connectorType || 'Type2',
        location: {
          address: originalData.location?.address || '',
          lat: originalData.location?.lat || '',
          lng: originalData.location?.lng || ''
        },
        pricePerUnit: originalData.pricePerUnit || '',
        serialNumber: originalData.serialNumber || ''
      });
      setHasChanges(false);
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        return formData.chargerName && formData.chargerType && formData.connectorType;
      case 2:
        return formData.location.address && formData.location.lat && formData.location.lng;
      case 3:
        return formData.pricePerUnit && parseFloat(formData.pricePerUnit) > 0;
      default:
        return false;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[...Array(totalSteps)].map((_, index) => (
        <div key={index} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep > index + 1
                ? 'bg-green-600 text-white'
                : currentStep === index + 1
                ? 'bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-600'
            }`}
          >
            {index + 1}
          </div>
          {index < totalSteps - 1 && (
            <div
              className={`w-12 h-1 ${
                currentStep > index + 1 ? 'bg-green-600' : 'bg-gray-300'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  if (fetchLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading charger data...</p>
        </div>
      </div>
    );
  }

  const Step1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
        <p className="text-gray-600 mb-6">Update the basic details about your charger</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Charger Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.chargerName}
            onChange={(e) => handleChange('chargerName', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Main Street Charger"
            required
          />
          <div className="mt-1 text-xs text-gray-500">
            Current: <span className="font-medium">{originalData?.chargerName}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Serial Number
          </label>
          <input
            type="text"
            value={formData.serialNumber}
            onChange={(e) => handleChange('serialNumber', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., CHR001234"
          />
          <div className="mt-1 text-xs text-gray-500">
            Current: <span className="font-medium">{originalData?.serialNumber || 'Not set'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Charger Type <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.chargerType}
            onChange={(e) => handleChange('chargerType', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select Charger Type</option>
            <option value="AC">AC (Alternating Current)</option>
            <option value="DC">DC (Direct Current)</option>
            <option value="DC_Fast">DC Fast Charging</option>
            <option value="Type1">Type 1</option>
            <option value="Type2">Type 2</option>
            <option value="CCS">CCS (Combined Charging System)</option>
            <option value="CHAdeMO">CHAdeMO</option>
            <option value="Tesla">Tesla</option>
          </select>
          <div className="mt-1 text-xs text-gray-500">
            Current: <span className="font-medium">{originalData?.chargerType}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Connector Type <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.connectorType}
            onChange={(e) => handleChange('connectorType', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select Connector Type</option>
            <option value="Type1">Type 1 (J1772)</option>
            <option value="Type2">Type 2 (Mennekes)</option>
            <option value="CCS">CCS</option>
            <option value="CHAdeMO">CHAdeMO</option>
            <option value="Tesla">Tesla (NACS)</option>
            <option value="GB/T">GB/T (China)</option>
          </select>
          <div className="mt-1 text-xs text-gray-500">
            Current: <span className="font-medium">{originalData?.connectorType}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const Step2 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Details</h3>
        <p className="text-gray-600 mb-6">Update the exact location where the charger is installed</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.location.address}
            onChange={(e) => handleLocationChange('address', e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter complete address including street, city, state, and pincode"
            required
          />
          <div className="mt-1 text-xs text-gray-500">
            Current: <span className="font-medium">{originalData?.location?.address}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Latitude <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              value={formData.location.lat}
              onChange={(e) => handleLocationChange('lat', parseFloat(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 19.0760"
              required
            />
            <div className="mt-1 text-xs text-gray-500">
              Current: <span className="font-medium">{originalData?.location?.lat}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Longitude <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              value={formData.location.lng}
              onChange={(e) => handleLocationChange('lng', parseFloat(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 72.8777"
              required
            />
            <div className="mt-1 text-xs text-gray-500">
              Current: <span className="font-medium">{originalData?.location?.lng}</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Location Tip:</p>
              <p>Users rely on accurate coordinates to find your charger. Double-check the location before saving.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const Step3 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pricing Information</h3>
        <p className="text-gray-600 mb-6">Update your pricing for this charger</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Price per Unit <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
              <DollarSign className="h-5 w-5" />
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.pricePerUnit}
              onChange={(e) => handleChange('pricePerUnit', parseFloat(e.target.value))}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              required
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Current: <span className="font-medium">{formatCurrency(originalData?.pricePerUnit || 0)}</span>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Pricing Impact:</p>
              <p>Price changes will apply to new charging sessions starting immediately after update.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ReviewStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Changes</h3>
        <p className="text-gray-600 mb-6">Review all changes before updating the charger</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">
                  {formData.chargerName !== originalData?.chargerName ? (
                    <span className="text-blue-600">{formData.chargerName}</span>
                  ) : (
                    formData.chargerName
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <span className="font-medium">
                  {formData.chargerType !== originalData?.chargerType ? (
                    <span className="text-blue-600">{formData.chargerType}</span>
                  ) : (
                    formData.chargerType
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Connector:</span>
                <span className="font-medium">
                  {formData.connectorType !== originalData?.connectorType ? (
                    <span className="text-blue-600">{formData.connectorType}</span>
                  ) : (
                    formData.connectorType
                  )}
                </span>
              </div>
              {formData.serialNumber !== originalData?.serialNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Serial:</span>
                  <span className="font-medium text-blue-600">{formData.serialNumber}</span>
                </div>
              )}
            </div>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Location</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Address:</span>
                <span className="font-medium text-right max-w-xs">
                  {formData.location.address !== originalData?.location?.address ? (
                    <span className="text-blue-600">{formData.location.address}</span>
                  ) : (
                    formData.location.address
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Coordinates:</span>
                <span className="font-medium">
                  {(formData.location.lat !== originalData?.location?.lat || formData.location.lng !== originalData?.location?.lng) ? (
                    <span className="text-blue-600">{formData.location.lat}, {formData.location.lng}</span>
                  ) : (
                    `${formData.location.lat}, ${formData.location.lng}`
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t pt-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-gray-900">Pricing</h4>
            <span className="text-xl font-bold">
              {formData.pricePerUnit !== originalData?.pricePerUnit ? (
                <span className="text-green-600">{formatCurrency(formData.pricePerUnit || 0)}</span>
              ) : (
                formatCurrency(formData.pricePerUnit || 0)
              )}
            </span>
          </div>
        </div>
      </div>

      {!hasChanges && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">No Changes Detected:</p>
              <p>You haven't made any changes to the charger information.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Chargers</span>
            </button>
            <div className="flex items-center space-x-4">
              {hasChanges && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Reset Changes
                </button>
              )}
              <span className="text-sm text-gray-600">Step {currentStep} of {totalSteps}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg">
          {/* Progress Indicator */}
          <StepIndicator />

          {/* Error Display */}
          {error && (
            <div className="mx-8 mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Form Content */}
          <div className="p-8">
            <form onSubmit={handleSubmit}>
              {currentStep === 1 && <Step1 />}
              {currentStep === 2 && <Step2 />}
              {currentStep === 3 && <Step3 />}
              {currentStep === 4 && <ReviewStep />}

              {/* Navigation Buttons */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    if (currentStep === 1) {
                      onBack();
                    } else {
                      setCurrentStep(prev => prev - 1);
                    }
                  }}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>{currentStep === 1 ? 'Cancel' : 'Previous'}</span>
                </button>

                <div className="flex items-center space-x-3">
                  {currentStep < totalSteps && (
                    <button
                      type="submit"
                      disabled={!validateStep(currentStep)}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next Step
                    </button>
                  )}
                  
                  {currentStep === totalSteps && (
                    <button
                      type="submit"
                      disabled={loading || !validateStep(currentStep) || !hasChanges}
                      className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          <span>Update Charger</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditCharger;
