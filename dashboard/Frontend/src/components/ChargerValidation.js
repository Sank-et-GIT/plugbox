import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';

// Validation rules
const validationRules = {
  chargerName: {
    required: true,
    minLength: 3,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-_,.#]+$/,
    message: 'Charger name must be 3-100 characters and contain only letters, numbers, spaces, and basic punctuation (- _ , . #)'
  },
  chargerType: {
    required: true,
    message: 'Charger type is required'
  },
  connectorType: {
    required: true,
    message: 'Connector type is required'
  },
  serialNumber: {
    required: false,
    minLength: 5,
    maxLength: 50,
    pattern: /^[A-Z0-9\-_]+$/,
    message: 'Serial number must be 5-50 characters and contain only uppercase letters, numbers, hyphens, and underscores'
  },
  address: {
    required: true,
    minLength: 10,
    maxLength: 500,
    message: 'Address must be 10-500 characters'
  },
  latitude: {
    required: true,
    min: -90,
    max: 90,
    message: 'Latitude must be between -90 and 90 degrees'
  },
  longitude: {
    required: true,
    min: -180,
    max: 180,
    message: 'Longitude must be between -180 and 180 degrees'
  },
  pricePerUnit: {
    required: true,
    min: 0.01,
    max: 10000,
    message: 'Price per unit must be between ₹0.01 and ₹10,000'
  }
};

// Charger type and connector compatibility
const compatibleCombinations = {
  'AC': ['Type1', 'Type2', 'J1772', 'Tesla'],
  'DC': ['CCS', 'CHAdeMO', 'Tesla'],
  'DC_Fast': ['CCS', 'CHAdeMO', 'Tesla'],
  'Type1': ['Type1'],
  'Type2': ['Type2'],
  'CCS': ['CCS'],
  'CHAdeMO': ['CHAdeMO'],
  'Tesla': ['Tesla']
};

// Validation function
const validateField = (name, value, chargerType = null, connectorType = null) => {
  const rule = validationRules[name];
  if (!rule) return { isValid: true, message: '' };

  // Required field validation
  if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return { isValid: false, message: `${name.replace(/([A-Z])/g, ' $1').trim()} is required` };
  }

  // Skip validation for optional fields if empty
  if (!rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return { isValid: true, message: '' };
  }

  // Convert to string for pattern validation
  const stringValue = typeof value === 'string' ? value : String(value);

  // Length validation
  if (rule.minLength && stringValue.length < rule.minLength) {
    return { isValid: false, message: rule.message };
  }

  if (rule.maxLength && stringValue.length > rule.maxLength) {
    return { isValid: false, message: rule.message };
  }

  // Pattern validation
  if (rule.pattern && !rule.pattern.test(stringValue)) {
    return { isValid: false, message: rule.message };
  }

  // Numeric validation
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return { isValid: false, message: rule.message };
    }
    if (rule.max !== undefined && value > rule.max) {
      return { isValid: false, message: rule.message };
    }
  }

  return { isValid: true, message: '' };
};

// Validate charger type and connector compatibility
const validateCompatibility = (chargerType, connectorType) => {
  if (!chargerType || !connectorType) return { isValid: true, message: '' };

  const allowedConnectors = compatibleCombinations[chargerType];
  if (!allowedConnectors || !allowedConnectors.includes(connectorType)) {
    return {
      isValid: false,
      message: `Charger type "${chargerType}" is not compatible with connector type "${connectorType}"`
    };
  }

  return { isValid: true, message: '' };
};

// Validation hook
export const useChargerValidation = (formData) => {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    const newErrors = {};

    // Validate individual fields
    Object.keys(validationRules).forEach(field => {
      let value;
      if (field === 'address') {
        value = formData.location?.address;
      } else if (field === 'latitude') {
        value = formData.location?.lat;
      } else if (field === 'longitude') {
        value = formData.location?.lng;
      } else {
        value = formData[field];
      }

      const validation = validateField(field, value, formData.chargerType, formData.connectorType);
      if (!validation.isValid) {
        newErrors[field] = validation.message;
      }
    });

    // Validate compatibility
    const compatibilityValidation = validateCompatibility(formData.chargerType, formData.connectorType);
    if (!compatibilityValidation.isValid) {
      newErrors.compatibility = compatibilityValidation.message;
    }

    setErrors(newErrors);
  }, [formData]);

  const isFormValid = Object.keys(errors).length === 0;

  return { errors, touched, setTouched, isFormValid };
};

// Validation input component
export const ValidatedInput = ({ 
  name, 
  label, 
  value, 
  onChange, 
  type = 'text', 
  required = false,
  placeholder = '',
  className = '',
  ...props 
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isValid, setIsValid] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const validation = validateField(name, value);
    setIsValid(validation.isValid);
    setErrorMessage(validation.message);
  }, [name, value]);

  const inputClassName = `
    w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors
    ${isValid === false ? 'border-red-300 focus:ring-red-500' : ''}
    ${isValid === true ? 'border-green-300 focus:ring-green-500' : ''}
    ${isValid === null ? 'border-gray-300 focus:ring-blue-500' : ''}
    ${className}
  `;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={inputClassName}
          {...props}
        />
        
        {isValid === true && !isFocused && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Check className="h-4 w-4 text-green-500" />
          </div>
        )}
        
        {isValid === false && !isFocused && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <X className="h-4 w-4 text-red-500" />
          </div>
        )}
      </div>
      
      {isValid === false && !isFocused && errorMessage && (
        <div className="flex items-center space-x-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

// Validation select component
export const ValidatedSelect = ({ 
  name, 
  label, 
  value, 
  onChange, 
  options, 
  required = false,
  className = '',
  ...props 
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isValid, setIsValid] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const validation = validateField(name, value);
    setIsValid(validation.isValid);
    setErrorMessage(validation.message);
  }, [name, value]);

  const selectClassName = `
    w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors
    ${isValid === false ? 'border-red-300 focus:ring-red-500' : ''}
    ${isValid === true ? 'border-green-300 focus:ring-green-500' : ''}
    ${isValid === null ? 'border-gray-300 focus:ring-blue-500' : ''}
    ${className}
  `;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={selectClassName}
          {...props}
        >
          <option value="">{props.placeholder || 'Select an option'}</option>
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        {isValid === true && !isFocused && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <Check className="h-4 w-4 text-green-500" />
          </div>
        )}
        
        {isValid === false && !isFocused && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <X className="h-4 w-4 text-red-500" />
          </div>
        )}
      </div>
      
      {isValid === false && !isFocused && errorMessage && (
        <div className="flex items-center space-x-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

// Validation textarea component
export const ValidatedTextarea = ({ 
  name, 
  label, 
  value, 
  onChange, 
  required = false,
  placeholder = '',
  rows = 3,
  className = '',
  ...props 
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isValid, setIsValid] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const validation = validateField(name, value);
    setIsValid(validation.isValid);
    setErrorMessage(validation.message);
  }, [name, value]);

  const textareaClassName = `
    w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors resize-none
    ${isValid === false ? 'border-red-300 focus:ring-red-500' : ''}
    ${isValid === true ? 'border-green-300 focus:ring-green-500' : ''}
    ${isValid === null ? 'border-gray-300 focus:ring-blue-500' : ''}
    ${className}
  `;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <textarea
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          rows={rows}
          className={textareaClassName}
          {...props}
        />
        
        {isValid === true && !isFocused && (
          <div className="absolute right-3 top-3">
            <Check className="h-4 w-4 text-green-500" />
          </div>
        )}
        
        {isValid === false && !isFocused && (
          <div className="absolute right-3 top-3">
            <X className="h-4 w-4 text-red-500" />
          </div>
        )}
      </div>
      
      {isValid === false && !isFocused && errorMessage && (
        <div className="flex items-center space-x-1 text-xs text-red-600">
          <AlertCircle className="h-3 w-3" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

// Compatibility warning component
export const CompatibilityWarning = ({ chargerType, connectorType }) => {
  const compatibility = validateCompatibility(chargerType, connectorType);
  
  if (compatibility.isValid) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
      <div className="flex items-start space-x-2">
        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-yellow-800">Compatibility Warning</p>
          <p className="text-sm text-yellow-700 mt-1">{compatibility.message}</p>
        </div>
      </div>
    </div>
  );
};

// Form validation summary
export const ValidationSummary = ({ errors, touched }) => {
  const visibleErrors = Object.keys(errors).filter(key => touched[key] && errors[key]);

  if (visibleErrors.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start space-x-2">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-red-800">Please fix the following errors:</p>
          <ul className="mt-2 text-sm text-red-700 space-y-1">
            {visibleErrors.map((field, index) => (
              <li key={index} className="flex items-start space-x-1">
                <span>•</span>
                <span>{errors[field]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default {
  useChargerValidation,
  ValidatedInput,
  ValidatedSelect,
  ValidatedTextarea,
  CompatibilityWarning,
  ValidationSummary,
  validateField,
  validateCompatibility
};
