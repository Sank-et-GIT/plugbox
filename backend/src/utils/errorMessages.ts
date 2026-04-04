// Comprehensive error messages for charger validation
export const CHARGER_ERROR_MESSAGES = {
  // Required field errors
  REQUIRED_FIELD: {
    chargerName: 'Charger name is required',
    chargerType: 'Charger type is required',
    connectorType: 'Connector type is required',
    address: 'Address is required',
    latitude: 'Latitude is required',
    longitude: 'Longitude is required',
    pricePerUnit: 'Price per unit is required'
  },

  // Length validation errors
  INVALID_LENGTH: {
    chargerName: {
      min: 'Charger name must be at least 3 characters long',
      max: 'Charger name must not exceed 100 characters'
    },
    serialNumber: {
      min: 'Serial number must be at least 5 characters long',
      max: 'Serial number must not exceed 50 characters'
    },
    address: {
      min: 'Address must be at least 10 characters long',
      max: 'Address must not exceed 500 characters'
    }
  },

  // Pattern validation errors
  INVALID_PATTERN: {
    chargerName: 'Charger name can only contain letters, numbers, spaces, and basic punctuation (- _ , . #)',
    serialNumber: 'Serial number can only contain uppercase letters, numbers, hyphens, and underscores'
  },

  // Numeric validation errors
  INVALID_NUMBER: {
    latitude: 'Latitude must be a valid number',
    longitude: 'Longitude must be a valid number',
    pricePerUnit: 'Price per unit must be a valid number'
  },

  // Range validation errors
    INVALID_RANGE: {
    latitude: 'Latitude must be between -90 and 90 degrees',
    longitude: 'Longitude must be between -180 and 180 degrees',
    pricePerUnit: 'Price per unit must be between ₹0.01 and ₹10,000'
  },

  // Positive number validation
  POSITIVE_NUMBER: {
    pricePerUnit: 'Price per unit must be a positive number'
  },

  // Enum validation errors
  INVALID_ENUM: {
    chargerType: 'Charger type must be one of: AC, DC, DC_Fast, Type1, Type2, CCS, CHAdeMO, Tesla',
    connectorType: 'Connector type must be one of: Type1, Type2, CCS, CHAdeMO, Tesla, GB/T, J1772',
    status: 'Status must be one of: Available, Offline, In_Session, Reserved, On_Maintenance'
  },

  // Compatibility validation errors
  INCOMPATIBLE_TYPES: {
    'AC-CCS': 'AC chargers are not compatible with CCS connectors',
    'AC-CHAdeMO': 'AC chargers are not compatible with CHAdeMO connectors',
    'Type1-Type2': 'Type 1 chargers are not compatible with Type 2 connectors',
    'Type2-Type1': 'Type 2 chargers are not compatible with Type 1 connectors'
  },

  // Business logic errors
  BUSINESS_LOGIC: {
    duplicateSerialNumber: 'A charger with this serial number already exists',
    chargerNotFound: 'Charger not found',
    cannotDeleteActiveCharger: 'Cannot delete charger with active bookings or sessions',
    invalidStatusTransition: 'Invalid status transition',
    accessDenied: 'Access denied: You can only access your own chargers',
    unauthorized: 'Authentication required to perform this action'
  },

  // Database errors
  DATABASE: {
    connectionError: 'Database connection error. Please try again later.',
    constraintViolation: 'Data constraint violation. Please check your input.',
    foreignKeyViolation: 'Referenced data not found.',
    uniqueViolation: 'This record already exists.',
    unknownError: 'An unexpected database error occurred.'
  },

  // HTTP status messages
  HTTP_STATUS: {
    400: 'Bad request. Please check your input data.',
    401: 'Authentication required. Please log in.',
    403: 'Access denied. You do not have permission to perform this action.',
    404: 'Resource not found.',
    409: 'Conflict. The resource already exists.',
    422: 'Validation failed. Please check your input.',
    429: 'Too many requests. Please try again later.',
    500: 'Internal server error. Please try again later.',
    503: 'Service unavailable. Please try again later.'
  }
};

// Helper function to get error message
export const getErrorMessage = (type: string, field?: string, context?: any): string => {
  const errorCategory = CHARGER_ERROR_MESSAGES[type as keyof typeof CHARGER_ERROR_MESSAGES];
  
  if (!errorCategory) {
    return 'An unknown error occurred.';
  }

  // Handle nested error objects
  if (field && typeof errorCategory === 'object' && !Array.isArray(errorCategory)) {
    const fieldError = (errorCategory as any)[field];
    
    if (typeof fieldError === 'object' && !Array.isArray(fieldError)) {
      // Handle min/max validation
      if (context?.min && fieldError.min) {
        return fieldError.min;
      }
      if (context?.max && fieldError.max) {
        return fieldError.max;
      }
      return fieldError.default || 'Invalid input.';
    }
    
    return fieldError || 'Invalid input.';
  }

  // Handle compatibility errors
  if (type === 'INCOMPATIBLE_TYPES' && context) {
    const key = `${context.chargerType}-${context.connectorType}`;
    return (errorCategory as any)[key] || 'Charger type and connector type are not compatible.';
  }

  // Handle status transition errors
  if (type === 'BUSINESS_LOGIC' && field === 'invalidStatusTransition') {
    return `Cannot change status from ${context?.from} to ${context?.to}`;
  }

  return typeof errorCategory === 'string' ? errorCategory : 'An error occurred.';
};

// Helper function to format validation errors for API response
export const formatValidationErrors = (errors: string[]): { success: boolean; message: string; errors: string[] } => {
  return {
    success: false,
    message: 'Validation failed',
    errors: errors
  };
};

// Helper function to create success response
export const createSuccessResponse = (message: string, data?: any) => {
  return {
    success: true,
    message,
    data
  };
};

// Helper function to create error response
export const createErrorResponse = (message: string, statusCode: number = 500, details?: any) => {
  return {
    success: false,
    message,
    statusCode,
    details
  };
};

// Validation rule descriptions for frontend help text
export const VALIDATION_RULES = {
  chargerName: {
    description: 'Enter a descriptive name for your charger',
    rules: [
      'Must be 3-100 characters long',
      'Can contain letters, numbers, spaces, and basic punctuation',
      'Examples: "Main Street Charger", "Parking Lot A-1"'
    ]
  },
  serialNumber: {
    description: 'Enter the manufacturer serial number (optional)',
    rules: [
      'Must be 5-50 characters if provided',
      'Can only contain uppercase letters, numbers, hyphens, and underscores',
      'Must be unique across all chargers'
    ]
  },
  chargerType: {
    description: 'Select the type of charger',
    rules: [
      'AC: Standard alternating current charging',
      'DC: Direct current fast charging',
      'DC_Fast: Ultra-fast DC charging',
      'Type-specific: Dedicated connector types'
    ]
  },
  connectorType: {
    description: 'Select the connector type available on this charger',
    rules: [
      'Must be compatible with the charger type',
      'Type 1: Common in North America',
      'Type 2: Standard in Europe',
      'CCS: Combined Charging System (fast charging)',
      'CHAdeMO: Fast charging standard',
      'Tesla: Tesla proprietary connector',
      'GB/T: Chinese standard',
      'J1772: Level 2 charging standard'
    ]
  },
  address: {
    description: 'Enter the complete address where the charger is installed',
    rules: [
      'Must be 10-500 characters long',
      'Include street address, city, state, and postal code',
      'Helps users locate your charger easily'
    ]
  },
  latitude: {
    description: 'Enter the geographic latitude of the charger location',
    rules: [
      'Must be between -90 and 90 degrees',
      'Positive values are north of the equator',
      'Negative values are south of the equator',
      'Example: 19.0760 (Mumbai)'
    ]
  },
  longitude: {
    description: 'Enter the geographic longitude of the charger location',
    rules: [
      'Must be between -180 and 180 degrees',
      'Positive values are east of the Prime Meridian',
      'Negative values are west of the Prime Meridian',
      'Example: 72.8777 (Mumbai)'
    ]
  },
  pricePerUnit: {
    description: 'Enter the price per charging unit (typically per kWh)',
    rules: [
      'Must be between ₹0.01 and ₹10,000',
      'Should reflect your local market rates',
      'Consider electricity costs and profit margin'
    ]
  }
};

// Status transition rules
export const STATUS_TRANSITION_RULES = {
  OFFLINE: {
    canTransitionTo: ['Available', 'On_Maintenance'],
    description: 'Offline chargers can be made available or put under maintenance'
  },
  Available: {
    canTransitionTo: ['Offline', 'In_Session', 'Reserved', 'On_Maintenance'],
    description: 'Available chargers can start charging, be reserved, or go offline/maintenance'
  },
  In_Session: {
    canTransitionTo: ['Available', 'Offline', 'On_Maintenance'],
    description: 'Chargers in session can become available, go offline, or enter maintenance'
  },
  Reserved: {
    canTransitionTo: ['Available', 'Offline', 'In_Session', 'On_Maintenance'],
    description: 'Reserved chargers can start charging, become available, or go offline/maintenance'
  },
  On_Maintenance: {
    canTransitionTo: ['Available', 'Offline'],
    description: 'Chargers under maintenance can only be made available or taken offline'
  }
};

export default {
  CHARGER_ERROR_MESSAGES,
  getErrorMessage,
  formatValidationErrors,
  createSuccessResponse,
  createErrorResponse,
  VALIDATION_RULES,
  STATUS_TRANSITION_RULES
};
