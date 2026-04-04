import { Request, Response, NextFunction } from 'express';

// Validation error class
export class ValidationError extends Error {
  public statusCode: number;
  public details: any;

  constructor(message: string, details: any = null) {
    super(message);
    this.statusCode = 400;
    this.details = details;
    this.name = 'ValidationError';
  }
}

// Common validation utilities
export const validators = {
  // String validators
  required: (value: any, fieldName: string) => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      throw new ValidationError(`${fieldName} is required`);
    }
    return true;
  },

  minLength: (value: string, min: number, fieldName: string) => {
    if (value.length < min) {
      throw new ValidationError(`${fieldName} must be at least ${min} characters long`);
    }
    return true;
  },

  maxLength: (value: string, max: number, fieldName: string) => {
    if (value.length > max) {
      throw new ValidationError(`${fieldName} must not exceed ${max} characters`);
    }
    return true;
  },

  // Number validators
  isNumber: (value: any, fieldName: string) => {
    if (isNaN(Number(value))) {
      throw new ValidationError(`${fieldName} must be a valid number`);
    }
    return true;
  },

  min: (value: number, min: number, fieldName: string) => {
    if (value < min) {
      throw new ValidationError(`${fieldName} must be at least ${min}`);
    }
    return true;
  },

  max: (value: number, max: number, fieldName: string) => {
    if (value > max) {
      throw new ValidationError(`${fieldName} must not exceed ${max}`);
    }
    return true;
  },

  positive: (value: number, fieldName: string) => {
    if (value <= 0) {
      throw new ValidationError(`${fieldName} must be a positive number`);
    }
    return true;
  },

  // Coordinate validators
  latitude: (value: number, fieldName: string) => {
    if (value < -90 || value > 90) {
      throw new ValidationError(`${fieldName} must be between -90 and 90 degrees`);
    }
    return true;
  },

  longitude: (value: number, fieldName: string) => {
    if (value < -180 || value > 180) {
      throw new ValidationError(`${fieldName} must be between -180 and 180 degrees`);
    }
    return true;
  },

  // Enum validators
  enum: (value: string, allowedValues: string[], fieldName: string) => {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    }
    return true;
  },

  // Pattern validators
  alphanumeric: (value: string, fieldName: string) => {
    if (!/^[a-zA-Z0-9\s]+$/.test(value)) {
      throw new ValidationError(`${fieldName} can only contain letters, numbers, and spaces`);
    }
    return true;
  },

  alphanumericWithSpecial: (value: string, fieldName: string) => {
    if (!/^[a-zA-Z0-9\s\-_,.#]+$/.test(value)) {
      throw new ValidationError(`${fieldName} can only contain letters, numbers, spaces, and basic punctuation (- _ , . #)`);
    }
    return true;
  },

  // Serial number validator
  serialNumber: (value: string, fieldName: string) => {
    if (value && !/^[A-Z0-9\-_]+$/.test(value)) {
      throw new ValidationError(`${fieldName} can only contain uppercase letters, numbers, hyphens, and underscores`);
    }
    return true;
  }
};

// Charger validation schema
export const validateChargerCreation = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body } = req;
    const errors: string[] = [];

    // Validate chargerName
    try {
      validators.required(body.chargerName, 'Charger name');
      validators.minLength(body.chargerName, 3, 'Charger name');
      validators.maxLength(body.chargerName, 100, 'Charger name');
      validators.alphanumericWithSpecial(body.chargerName, 'Charger name');
    } catch (err) {
      errors.push(err.message);
    }

    // Validate chargerType
    try {
      validators.required(body.chargerType, 'Charger type');
      validators.enum(body.chargerType, ['AC', 'DC', 'DC_Fast', 'Type1', 'Type2', 'CCS', 'CHAdeMO', 'Tesla'], 'Charger type');
    } catch (err) {
      errors.push(err.message);
    }

    // Validate connectorType
    try {
      validators.required(body.connectorType, 'Connector type');
      validators.enum(body.connectorType, ['Type1', 'Type2', 'CCS', 'CHAdeMO', 'Tesla', 'GB/T', 'J1772'], 'Connector type');
    } catch (err) {
      errors.push(err.message);
    }

    // Validate location object
    if (!body.location || typeof body.location !== 'object') {
      errors.push('Location information is required');
    } else {
      // Validate address
      try {
        validators.required(body.location.address, 'Address');
        validators.minLength(body.location.address, 10, 'Address');
        validators.maxLength(body.location.address, 500, 'Address');
      } catch (err) {
        errors.push(err.message);
      }

      // Validate latitude
      try {
        validators.required(body.location.lat, 'Latitude');
        validators.isNumber(body.location.lat, 'Latitude');
        validators.latitude(parseFloat(body.location.lat), 'Latitude');
      } catch (err) {
        errors.push(err.message);
      }

      // Validate longitude
      try {
        validators.required(body.location.lng, 'Longitude');
        validators.isNumber(body.location.lng, 'Longitude');
        validators.longitude(parseFloat(body.location.lng), 'Longitude');
      } catch (err) {
        errors.push(err.message);
      }
    }

    // Validate pricePerUnit
    try {
      validators.required(body.pricePerUnit, 'Price per unit');
      validators.isNumber(body.pricePerUnit, 'Price per unit');
      validators.positive(parseFloat(body.pricePerUnit), 'Price per unit');
      validators.max(parseFloat(body.pricePerUnit), 10000, 'Price per unit'); // Max ₹10,000 per unit
    } catch (err) {
      errors.push(err.message);
    }

    // Validate serialNumber (optional)
    if (body.serialNumber) {
      try {
        validators.minLength(body.serialNumber, 5, 'Serial number');
        validators.maxLength(body.serialNumber, 50, 'Serial number');
        validators.serialNumber(body.serialNumber, 'Serial number');
      } catch (err) {
        errors.push(err.message);
      }
    }

    // Business logic validations
    try {
      // Validate charger type and connector type compatibility
      const incompatibleCombinations = [
        { chargerType: 'AC', connectorType: 'CCS' },
        { chargerType: 'AC', connectorType: 'CHAdeMO' },
        { chargerType: 'Type1', connectorType: 'Type2' },
        { chargerType: 'Type2', connectorType: 'Type1' }
      ];

      const isIncompatible = incompatibleCombinations.some(
        combo => combo.chargerType === body.chargerType && combo.connectorType === body.connectorType
      );

      if (isIncompatible) {
        errors.push(`Charger type "${body.chargerType}" is not compatible with connector type "${body.connectorType}"`);
      }
    } catch (err) {
      errors.push(err.message);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors,
        details: {
          receivedData: body,
          validationErrors: errors
        }
      });
    }

    // Sanitize data
    req.body = {
      chargerName: body.chargerName.trim(),
      chargerType: body.chargerType,
      connectorType: body.connectorType,
      location: {
        address: body.location.address.trim(),
        lat: parseFloat(body.location.lat),
        lng: parseFloat(body.location.lng)
      },
      pricePerUnit: parseFloat(body.pricePerUnit),
      serialNumber: body.serialNumber ? body.serialNumber.trim().toUpperCase() : undefined
    };

    next();
  } catch (error) {
    console.error('Validation middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal validation error',
      error: error.message
    });
  }
};

// Charger update validation (similar but more flexible)
export const validateChargerUpdate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body } = req;
    const errors: string[] = [];

    // Only validate fields that are being updated
    if (body.chargerName !== undefined) {
      try {
        validators.minLength(body.chargerName, 3, 'Charger name');
        validators.maxLength(body.chargerName, 100, 'Charger name');
        validators.alphanumericWithSpecial(body.chargerName, 'Charger name');
      } catch (err) {
        errors.push(err.message);
      }
    }

    if (body.chargerType !== undefined) {
      try {
        validators.enum(body.chargerType, ['AC', 'DC', 'DC_Fast', 'Type1', 'Type2', 'CCS', 'CHAdeMO', 'Tesla'], 'Charger type');
      } catch (err) {
        errors.push(err.message);
      }
    }

    if (body.connectorType !== undefined) {
      try {
        validators.enum(body.connectorType, ['Type1', 'Type2', 'CCS', 'CHAdeMO', 'Tesla', 'GB/T', 'J1772'], 'Connector type');
      } catch (err) {
        errors.push(err.message);
      }
    }

    if (body.location !== undefined) {
      if (typeof body.location !== 'object') {
        errors.push('Location must be an object');
      } else {
        if (body.location.address !== undefined) {
          try {
            validators.minLength(body.location.address, 10, 'Address');
            validators.maxLength(body.location.address, 500, 'Address');
          } catch (err) {
            errors.push(err.message);
          }
        }

        if (body.location.lat !== undefined) {
          try {
            validators.isNumber(body.location.lat, 'Latitude');
            validators.latitude(parseFloat(body.location.lat), 'Latitude');
          } catch (err) {
            errors.push(err.message);
          }
        }

        if (body.location.lng !== undefined) {
          try {
            validators.isNumber(body.location.lng, 'Longitude');
            validators.longitude(parseFloat(body.location.lng), 'Longitude');
          } catch (err) {
            errors.push(err.message);
          }
        }
      }
    }

    if (body.pricePerUnit !== undefined) {
      try {
        validators.isNumber(body.pricePerUnit, 'Price per unit');
        validators.positive(parseFloat(body.pricePerUnit), 'Price per unit');
        validators.max(parseFloat(body.pricePerUnit), 10000, 'Price per unit');
      } catch (err) {
        errors.push(err.message);
      }
    }

    if (body.serialNumber !== undefined) {
      try {
        validators.minLength(body.serialNumber, 5, 'Serial number');
        validators.maxLength(body.serialNumber, 50, 'Serial number');
        validators.serialNumber(body.serialNumber, 'Serial number');
      } catch (err) {
        errors.push(err.message);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    // Sanitize data
    if (body.chargerName) body.chargerName = body.chargerName.trim();
    if (body.location?.address) body.location.address = body.location.address.trim();
    if (body.location?.lat) body.location.lat = parseFloat(body.location.lat);
    if (body.location?.lng) body.location.lng = parseFloat(body.location.lng);
    if (body.pricePerUnit) body.pricePerUnit = parseFloat(body.pricePerUnit);
    if (body.serialNumber) body.serialNumber = body.serialNumber.trim().toUpperCase();

    next();
  } catch (error) {
    console.error('Validation middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal validation error',
      error: error.message
    });
  }
};

// Status update validation
export const validateStatusUpdate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const errors: string[] = [];

    try {
      validators.required(status, 'Status');
      validators.enum(status, ['Available', 'Offline', 'In_Session', 'Reserved', 'On_Maintenance'], 'Status');
    } catch (err) {
      errors.push(err.message);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    next();
  } catch (error) {
    console.error('Status validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal validation error',
      error: error.message
    });
  }
};
