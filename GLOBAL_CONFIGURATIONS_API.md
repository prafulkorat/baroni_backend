# Global Configurations API Documentation

## Overview
This document describes the complete API system for managing Global Configurations as shown in the admin dashboard. The system includes global settings, category management (professions), and country service configurations.

## API Endpoints

### 1. Global Configuration Management

#### Get Global Configuration
**Endpoint:** `GET /api/config/`

**Description:** Retrieves all global configuration settings

**Authentication:** Public (no auth required)

**Response:**
```json
{
  "success": true,
  "message": "Global configuration retrieved successfully",
  "data": {
    "config": {
      "id": "config_id",
      "liveShowPriceHide": false,
      "videoCallPriceHide": false,
      "becomeBaronistarPriceHide": false,
      "isTestUser": false,
      "hideApplyToBecomeStar": false,
      "serviceLimits": {
        "liveShowDuration": 20,
        "videoCallDuration": 5,
        "slotDuration": 20,
        "dedicationUploadSize": 20,
        "maxLiveShowParticipants": 10000,
        "reconnectionTimeout": 5
      },
      "idVerificationFees": {
        "standardIdPrice": 0,
        "goldIdPrice": 0
      },
      "liveShowFees": {
        "hostingFee": 0
      },
      "contactSupport": {
        "companyServiceNumber": "+34895723487",
        "supportEmail": "support@playform.com",
        "servicesTermsUrl": "https://help.platform.com",
        "privacyPolicyUrl": "https://help.platform.com",
        "helpdeskLink": "https://help.platform.com"
      },
      "hideElementsPrice": {
        "hideDedications": false
      },
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

#### Update Global Configuration
**Endpoint:** `PUT /api/config/` or `POST /api/config/`

**Description:** Updates global configuration settings

**Authentication:** Admin required

**Request Body:**
```json
{
  "liveShowPriceHide": true,
  "videoCallPriceHide": false,
  "becomeBaronistarPriceHide": true,
  "isTestUser": false,
  "hideApplyToBecomeStar": true,
  "serviceLimits": {
    "maxLiveShowDuration": 30,
    "maxVideoCallDuration": 20,
    "defaultCallTime": 15,
    "dedicationUploadSize": 25,
    "maxLiveShowParticipants": 5000,
    "reconnectionTimeout": 10
  },
  "idVerificationFees": {
    "standardIdPrice": 10.99,
    "goldIdPrice": 25.99
  },
  "liveShowFees": {
    "hostingFee": 5.99
  },
  "contactSupport": {
    "companyServiceNumber": "+1234567890",
    "supportEmail": "support@baroni.com",
    "servicesTermsUrl": "https://baroni.com/terms",
    "privacyPolicyUrl": "https://baroni.com/privacy",
    "helpdeskLink": "https://baroni.com/help"
  },
  "hideElementsPrice": {
    "hideDedications": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Global configuration updated successfully",
  "data": {
    "config": {
      // Updated configuration object
    }
  }
}
```

### 2. Category Management (Professions)

#### Get Categories
**Endpoint:** `GET /api/config/categories`

**Description:** Retrieves all categories (professions)

**Authentication:** Public (no auth required)

**Response:**
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": {
    "categories": [
      {
        "id": "category_id",
        "name": "Actor",
        "image": "https://example.com/actor.jpg",
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z"
      },
      {
        "id": "category_id_2",
        "name": "Musician",
        "image": "https://example.com/musician.jpg",
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

#### Create Category
**Endpoint:** `POST /api/category/`

**Description:** Creates a new category (profession)

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Comedian"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "category": {
      "id": "category_id",
      "name": "Comedian",
      "image": "https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/placeholder_aws6oc.png",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

#### Update Category
**Endpoint:** `PUT /api/category/:id`

**Description:** Updates an existing category

**Authentication:** Required

**Request Body:**
```json
{
  "name": "Updated Actor Name"
}
```

#### Delete Category
**Endpoint:** `DELETE /api/category/:id`

**Description:** Deletes a category

**Authentication:** Required

### 3. Country Service Configuration Management

#### Get Country Service Configurations
**Endpoint:** `GET /api/config/country-services`

**Description:** Retrieves all country service configurations

**Authentication:** Public (no auth required)

**Query Parameters:**
- `isActive` (optional): Filter by active status (`true` or `false`)

**Response:**
```json
{
  "success": true,
  "message": "Country service configurations retrieved successfully",
  "data": {
    "countryConfigs": [
      {
        "id": "config_id",
        "country": "USA",
        "countryCode": "US",
        "services": {
          "videoCall": true,
          "dedication": false,
          "liveShow": true
        },
        "isActive": true,
        "sortOrder": 0,
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

#### Create Country Service Configuration
**Endpoint:** `POST /api/config/country-services`

**Description:** Creates a new country service configuration

**Authentication:** Admin required

**Request Body:**
```json
{
  "country": "Nigeria",
  "countryCode": "NG",
  "services": {
    "videoCall": true,
    "dedication": true,
    "liveShow": true
  },
  "sortOrder": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Country service configuration created successfully",
  "data": {
    "countryConfig": {
      "id": "config_id",
      "country": "Nigeria",
      "countryCode": "NG",
      "services": {
        "videoCall": true,
        "dedication": true,
        "liveShow": true
      },
      "isActive": true,
      "sortOrder": 1,
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  }
}
```

#### Update Country Service Configuration
**Endpoint:** `PUT /api/config/country-services/:configId`

**Description:** Updates an existing country service configuration

**Authentication:** Admin required

**Request Body:**
```json
{
  "country": "Updated Country Name",
  "countryCode": "UC",
  "services": {
    "videoCall": false,
    "dedication": true,
    "liveShow": false
  },
  "isActive": false,
  "sortOrder": 2
}
```

#### Delete Country Service Configuration
**Endpoint:** `DELETE /api/config/country-services/:configId`

**Description:** Deletes a country service configuration

**Authentication:** Admin required

## Data Models

### Global Configuration Model
```javascript
{
  // Existing fields
  liveShowPriceHide: Boolean,
  videoCallPriceHide: Boolean,
  becomeBaronistarPriceHide: Boolean,
  isTestUser: Boolean,
  hideApplyToBecomeStar: Boolean,
  
  // Service Limits & Defaults
  serviceLimits: {
    maxLiveShowDuration: Number, // in minutes
    maxVideoCallDuration: Number, // in minutes
    defaultCallTime: Number, // in minutes
    dedicationUploadSize: Number, // in MB
    maxLiveShowParticipants: Number,
    reconnectionTimeout: Number // in minutes
  },
  
  // ID Verification Fees
  idVerificationFees: {
    standardIdPrice: Number,
    goldIdPrice: Number
  },
  
  // Live Show Fees
  liveShowFees: {
    hostingFee: Number
  },
  
  // Contact & Support Info
  contactSupport: {
    companyServiceNumber: String,
    supportEmail: String,
    servicesTermsUrl: String,
    privacyPolicyUrl: String,
    helpdeskLink: String
  },
  
  // Hide Elements Price
  hideElementsPrice: {
    hideDedications: Boolean
  }
}
```

### Category Model (Professions)
```javascript
{
  name: String, // Required, unique
  image: String, // Required, URL
  createdAt: Date,
  updatedAt: Date
}
```

### Country Service Configuration Model
```javascript
{
  country: String, // Required, unique
  countryCode: String, // Required, unique, 2-3 uppercase letters
  services: {
    videoCall: Boolean, // Default: true
    dedication: Boolean, // Default: true
    liveShow: Boolean // Default: true
  },
  isActive: Boolean, // Default: true
  sortOrder: Number, // Default: 0
  createdAt: Date,
  updatedAt: Date
}
```

## Validation Rules

### Global Configuration
- Service limits: All numeric values must be positive
- Max durations: 1-1440 minutes
- Upload size: 1-1000 MB
- Max participants: 1-100000
- Reconnection timeout: 1-60 minutes
- Fees: Must be positive numbers
- URLs: Must be valid URLs
- Email: Must be valid email format

### Category (Profession)
- Name: 2-50 characters, letters and spaces only
- Image: Must be valid URL
- Name must be unique

### Country Service Configuration
- Country: 2-100 characters
- Country Code: 2-3 uppercase letters only
- Country and country code must be unique
- Services: Boolean values only

## Error Responses

Standard error format:
```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created (for POST requests)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized
- `403`: Forbidden (admin access required)
- `404`: Not Found
- `409`: Conflict (duplicate entries)
- `500`: Internal Server Error

## Authentication

- **Public endpoints:** No authentication required
- **Admin endpoints:** Require admin role
- **Category management:** Uses existing category authentication
- Include `Authorization: Bearer <token>` header for protected endpoints

## Usage Examples

### Frontend Integration

```javascript
// Get global configuration
const config = await fetch('/api/config/').then(r => r.json());

// Update service limits
await fetch('/api/config/', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    serviceLimits: {
      maxLiveShowDuration: 30,
      maxVideoCallDuration: 20
    }
  })
});

// Get categories (professions)
const categories = await fetch('/api/config/categories').then(r => r.json());

// Create country service config
await fetch('/api/config/country-services', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    country: 'France',
    countryCode: 'FR',
    services: {
      videoCall: true,
      dedication: true,
      liveShow: false
    }
  })
});
```

## Notes

1. **Backward Compatibility:** Legacy endpoints are maintained for existing integrations
2. **Category Management:** Uses existing category system instead of separate profession model
3. **Singleton Pattern:** Global configuration uses singleton pattern (only one config document)
4. **Validation:** Comprehensive validation for all input fields
5. **Error Handling:** Consistent error responses across all endpoints
