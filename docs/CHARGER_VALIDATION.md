# Charger Validation System Documentation

## Overview

This document describes the comprehensive validation system implemented for new charger creation and management in the PlugBox EV charging platform. The validation system ensures data integrity, business rule compliance, and provides excellent user experience with real-time feedback.

## Architecture

### Backend Validation
- **Location**: `backend/src/middleware/validation.ts`
- **Purpose**: Server-side validation for all charger operations
- **Features**: Input sanitization, business logic validation, error handling

### Frontend Validation
- **Location**: `dashboard/Frontend/src/components/ChargerValidation.js`
- **Purpose**: Real-time client-side validation with visual feedback
- **Features**: Live validation, compatibility checking, user-friendly error messages

### Error Messages
- **Location**: `backend/src/utils/errorMessages.ts`
- **Purpose**: Centralized error message definitions
- **Features**: Consistent messaging, internationalization support, detailed help text

## Validation Rules

### 1. Charger Name
- **Required**: Yes
- **Length**: 3-100 characters
- **Pattern**: Letters, numbers, spaces, and basic punctuation (`- _ , . #`)
- **Examples**: "Main Street Charger", "Parking Lot A-1", "Mall Floor 2-Charger 5"

### 2. Serial Number
- **Required**: No (optional)
- **Length**: 5-50 characters (if provided)
- **Pattern**: Uppercase letters, numbers, hyphens, and underscores
- **Uniqueness**: Must be unique across all chargers
- **Examples**: "CHR001234", "EV-CHARGER-001", "TESLA_S001"

### 3. Charger Type
- **Required**: Yes
- **Options**: AC, DC, DC_Fast, Type1, Type2, CCS, CHAdeMO, Tesla
- **Compatibility**: Must be compatible with selected connector type

### 4. Connector Type
- **Required**: Yes
- **Options**: Type1, Type2, CCS, CHAdeMO, Tesla, GB/T, J1772
- **Compatibility**: Must be compatible with selected charger type

### 5. Location Address
- **Required**: Yes
- **Length**: 10-500 characters
- **Format**: Free text with complete address
- **Examples**: "123 Main Street, Mumbai, Maharashtra 400001, India"

### 6. Geographic Coordinates
- **Latitude**: Required, -90 to 90 degrees
- **Longitude**: Required, -180 to 180 degrees
- **Format**: Decimal degrees
- **Examples**: Mumbai (19.0760, 72.8777), Delhi (28.7041, 77.1025)

### 7. Price per Unit
- **Required**: Yes
- **Range**: ₹0.01 to ₹10,000
- **Format**: Decimal with 2 places
- **Purpose**: Price per kWh or charging session

## Compatibility Matrix

| Charger Type | Compatible Connectors | Incompatible Connectors |
|--------------|----------------------|------------------------|
| AC | Type1, Type2, J1772, Tesla | CCS, CHAdeMO |
| DC | CCS, CHAdeMO, Tesla | Type1, Type2, J1772 |
| DC_Fast | CCS, CHAdeMO, Tesla | Type1, Type2, J1772 |
| Type1 | Type1 | All others |
| Type2 | Type2 | All others |
| CCS | CCS | All others |
| CHAdeMO | CHAdeMO | All others |
| Tesla | Tesla | All others |

## Status Transition Rules

### Valid Transitions
- **OFFLINE** → Available, On_Maintenance
- **Available** → Offline, In_Session, Reserved, On_Maintenance
- **In_Session** → Available, Offline, On_Maintenance
- **Reserved** → Available, Offline, In_Session, On_Maintenance
- **On_Maintenance** → Available, Offline

### Invalid Transitions
- Any transition not listed above is invalid
- System prevents invalid status changes
- Clear error messages guide users

## API Endpoints with Validation

### POST /api/chargers
- **Purpose**: Create new charger
- **Validation**: Full validation middleware
- **Response**: Success/error with detailed messages

### PUT /api/chargers/:id
- **Purpose**: Update existing charger
- **Validation**: Partial validation (only provided fields)
- **Response**: Success/error with detailed messages

### DELETE /api/chargers/:id
- **Purpose**: Delete charger
- **Validation**: Business logic checks (active sessions/bookings)
- **Response**: Success/error with detailed messages

### PATCH /api/chargers/:id/status
- **Purpose**: Update charger status
- **Validation**: Status transition rules
- **Response**: Success/error with detailed messages

## Frontend Components

### ValidatedInput
- Real-time validation with visual feedback
- Shows checkmark/X icons for validation state
- Displays error messages below input
- Supports all standard input types

### ValidatedSelect
- Dropdown validation with visual feedback
- Compatibility filtering for connector types
- Disabled state for dependent fields

### ValidatedTextarea
- Multi-line text validation
- Character count awareness
- Real-time error display

### CompatibilityWarning
- Shows warnings for incompatible type combinations
- Provides guidance for correct selections
- Prevents form submission with incompatible types

### ValidationSummary
- Lists all current validation errors
- Shows only for touched fields
- Helps users identify and fix issues

## Error Handling

### Backend Error Responses
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Charger name must be at least 3 characters long",
    "Latitude must be between -90 and 90 degrees"
  ],
  "details": {
    "receivedData": { ... },
    "validationErrors": [ ... ]
  }
}
```

### Frontend Error Display
- Individual field errors below each input
- Summary of all errors at form top
- Visual indicators (red borders, icons)
- Compatibility warnings in yellow boxes

## Security Features

### Input Sanitization
- Trimming of whitespace
- Case normalization for serial numbers
- Type conversion for numeric fields
- HTML escaping for text inputs

### Business Logic Validation
- Serial number uniqueness checks
- Status transition validation
- Active session/booking prevention for deletion
- Vendor ownership verification

### Error Message Security
- No sensitive information exposure
- Generic messages for system errors
- Detailed messages only for validation failures

## Performance Considerations

### Client-Side
- Debounced validation (300ms delay)
- Efficient re-rendering with React hooks
- Minimal DOM manipulation
- Cached validation results

### Server-Side
- Early validation termination
- Efficient database queries
- Minimal memory usage
- Fast error response generation

## Testing Strategy

### Unit Tests
- Individual validation rule testing
- Edge case validation
- Error message accuracy
- Performance benchmarks

### Integration Tests
- Complete form validation flow
- API endpoint validation
- Error response formatting
- Cross-browser compatibility

### User Acceptance Tests
- Real-world usage scenarios
- Error message clarity
- User experience validation
- Accessibility compliance

## Configuration

### Environment Variables
```env
VALIDATION_STRICT_MODE=true
VALIDATION_DEBUG_MODE=false
VALIDATION_ERROR_LOGGING=true
```

### Customization Options
- Validation rule parameters
- Error message templates
- Compatibility matrix updates
- Status transition rules

## Future Enhancements

### Planned Features
- Multi-language error messages
- Custom validation rules
- Advanced compatibility checking
- Real-time coordinate validation

### Potential Improvements
- Machine learning for validation
- Enhanced user guidance
- Progressive validation
- Contextual error messages

## Support and Maintenance

### Common Issues
1. **Coordinate Validation**: Ensure decimal format, not DMS
2. **Serial Number**: Check for duplicates in existing chargers
3. **Compatibility**: Verify charger/connector type matching
4. **Status Transitions**: Review transition matrix

### Troubleshooting Steps
1. Check browser console for JavaScript errors
2. Verify network requests in developer tools
3. Review server logs for validation errors
4. Test with minimal data sets

### Contact Information
- Development Team: dev-team@plugbox.com
- Support: support@plugbox.com
- Documentation: https://docs.plugbox.com/validation

---

## Quick Reference

### Validation Checklist
- [ ] Charger name: 3-100 chars, valid pattern
- [ ] Serial number: 5-50 chars, unique (if provided)
- [ ] Charger type: Valid selection
- [ ] Connector type: Compatible with charger type
- [ ] Address: 10-500 chars, complete
- [ ] Latitude: -90 to 90, valid number
- [ ] Longitude: -180 to 180, valid number
- [ ] Price per unit: ₹0.01 to ₹10,000, positive

### Common Error Solutions
- **"Charger name is required"** → Enter at least 3 characters
- **"Incompatible types"** → Select compatible charger/connector combination
- **"Invalid coordinates"** → Use decimal degrees format
- **"Duplicate serial number"** → Use a unique serial number

This validation system ensures data quality while providing excellent user experience through real-time feedback and clear error messaging.
