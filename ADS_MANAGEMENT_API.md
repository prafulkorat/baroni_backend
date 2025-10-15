# Ads Management API Documentation

## Overview
This API provides comprehensive ads management functionality for the Baroni platform, allowing users to create, manage, and track their advertisements.

## Base URL
```
/api/ads
```

## Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Create Ad
Create a new advertisement.

**Endpoint:** `POST /api/ads`

**Authentication:** Required

**Request Body (multipart/form-data):**
```json
{
  "title": "Spiritual Talk - Sunday Healing",
  "link": "https://example.com/event", // Optional
  "budget": 100.50, // Optional
  "targetAudience": "all", // Optional: all, fans, stars, specific_country
  "targetCountry": "US", // Optional: 2-letter country code
  "priority": "medium", // Optional: low, medium, high, urgent
  "startDate": "2024-01-15T10:00:00Z", // Optional, defaults to now
  "endDate": "2024-01-20T18:00:00Z" // Optional
}
```

**File Upload:**
- `image`: Image file (required, max 20MB, formats: JPG, JPEG)

**Response:**
```json
{
  "success": true,
  "message": "Ad created successfully",
  "data": {
    "_id": "65f1234567890abcdef12345",
    "title": "Spiritual Talk - Sunday Healing",
    "link": "https://example.com/event",
    "image": "https://res.cloudinary.com/...",
    "status": "draft",
    "createdBy": {
      "_id": "65f1234567890abcdef12346",
      "name": "John Doe",
      "email": "john@example.com",
      "baroniId": "BAR123"
    },
    "metrics": {
      "impressions": 0,
      "clicks": 0,
      "views": 0
    },
    "budget": 100.50,
    "spentAmount": 0,
    "targetAudience": "all",
    "priority": "medium",
    "startDate": "2024-01-15T10:00:00.000Z",
    "endDate": "2024-01-20T18:00:00.000Z",
    "createdAt": "2024-01-10T12:00:00.000Z",
    "updatedAt": "2024-01-10T12:00:00.000Z"
  }
}
```

### 2. Get User's Ads
Retrieve all ads created by the authenticated user.

**Endpoint:** `GET /api/ads`

**Authentication:** Required

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `status` (optional): Filter by status (active, paused, draft, expired)
- `sortBy` (optional): Sort field (createdAt, updatedAt, title, status, priority, startDate, endDate)
- `sortOrder` (optional): Sort direction (asc, desc)

**Example:** `GET /api/ads?page=1&limit=10&status=active&sortBy=createdAt&sortOrder=desc`

**Response:**
```json
{
  "success": true,
  "message": "Ads retrieved successfully",
  "data": {
    "ads": [
      {
        "_id": "65f1234567890abcdef12345",
        "title": "Spiritual Talk - Sunday Healing",
        "link": "https://example.com/event",
        "image": "https://res.cloudinary.com/...",
        "status": "active",
        "metrics": {
          "impressions": 150,
          "clicks": 25,
          "views": 120
        },
        "budget": 100.50,
        "spentAmount": 45.20,
        "targetAudience": "all",
        "priority": "medium",
        "startDate": "2024-01-15T10:00:00.000Z",
        "endDate": "2024-01-20T18:00:00.000Z",
        "createdAt": "2024-01-10T12:00:00.000Z",
        "updatedAt": "2024-01-12T14:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalAds": 25,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 3. Get Specific Ad
Retrieve details of a specific ad.

**Endpoint:** `GET /api/ads/:id`

**Authentication:** Required

**Parameters:**
- `id`: Ad ID (MongoDB ObjectId)

**Response:**
```json
{
  "success": true,
  "message": "Ad retrieved successfully",
  "data": {
    "_id": "65f1234567890abcdef12345",
    "title": "Spiritual Talk - Sunday Healing",
    "link": "https://example.com/event",
    "image": "https://res.cloudinary.com/...",
    "status": "active",
    "createdBy": {
      "_id": "65f1234567890abcdef12346",
      "name": "John Doe",
      "email": "john@example.com",
      "baroniId": "BAR123"
    },
    "metrics": {
      "impressions": 150,
      "clicks": 25,
      "views": 120
    },
    "budget": 100.50,
    "spentAmount": 45.20,
    "targetAudience": "all",
    "targetCountry": "US",
    "priority": "medium",
    "startDate": "2024-01-15T10:00:00.000Z",
    "endDate": "2024-01-20T18:00:00.000Z",
    "createdAt": "2024-01-10T12:00:00.000Z",
    "updatedAt": "2024-01-12T14:30:00.000Z"
  }
}
```

### 4. Update Ad
Update an existing ad.

**Endpoint:** `PUT /api/ads/:id`

**Authentication:** Required

**Parameters:**
- `id`: Ad ID (MongoDB ObjectId)

**Request Body (multipart/form-data):**
```json
{
  "title": "Updated Spiritual Talk - Sunday Healing",
  "link": "https://newexample.com/event",
  "budget": 150.00,
  "targetAudience": "fans",
  "targetCountry": "US",
  "priority": "high",
  "status": "active",
  "startDate": "2024-01-16T10:00:00Z",
  "endDate": "2024-01-25T18:00:00Z"
}
```

**File Upload:**
- `image`: New image file (optional, max 20MB, formats: JPG, JPEG)

**Response:**
```json
{
  "success": true,
  "message": "Ad updated successfully",
  "data": {
    "_id": "65f1234567890abcdef12345",
    "title": "Updated Spiritual Talk - Sunday Healing",
    "link": "https://newexample.com/event",
    "image": "https://res.cloudinary.com/...",
    "status": "active",
    "createdBy": {
      "_id": "65f1234567890abcdef12346",
      "name": "John Doe",
      "email": "john@example.com",
      "baroniId": "BAR123"
    },
    "metrics": {
      "impressions": 150,
      "clicks": 25,
      "views": 120
    },
    "budget": 150.00,
    "spentAmount": 45.20,
    "targetAudience": "fans",
    "targetCountry": "US",
    "priority": "high",
    "startDate": "2024-01-16T10:00:00.000Z",
    "endDate": "2024-01-25T18:00:00.000Z",
    "createdAt": "2024-01-10T12:00:00.000Z",
    "updatedAt": "2024-01-15T16:45:00.000Z"
  }
}
```

### 5. Delete Ad
Delete an ad (soft delete).

**Endpoint:** `DELETE /api/ads/:id`

**Authentication:** Required

**Parameters:**
- `id`: Ad ID (MongoDB ObjectId)

**Response:**
```json
{
  "success": true,
  "message": "Ad deleted successfully"
}
```

### 6. Get Active Ads (Public)
Retrieve active ads for display (public endpoint).

**Endpoint:** `GET /api/ads/public/active`

**Authentication:** Not required

**Query Parameters:**
- `limit` (optional): Number of ads to return (default: 10, max: 50)
- `country` (optional): Filter by country (2-letter country code)
- `audience` (optional): Filter by audience (all, fans, stars)

**Example:** `GET /api/ads/public/active?limit=5&country=US&audience=fans`

**Response:**
```json
{
  "success": true,
  "message": "Active ads retrieved successfully",
  "data": [
    {
      "_id": "65f1234567890abcdef12345",
      "title": "Spiritual Talk - Sunday Healing",
      "link": "https://example.com/event",
      "image": "https://res.cloudinary.com/...",
      "status": "active",
      "createdBy": {
        "_id": "65f1234567890abcdef12346",
        "name": "John Doe",
        "baroniId": "BAR123"
      },
      "metrics": {
        "impressions": 150,
        "clicks": 25,
        "views": 120
      },
      "targetAudience": "all",
      "priority": "medium",
      "startDate": "2024-01-15T10:00:00.000Z",
      "endDate": "2024-01-20T18:00:00.000Z"
    }
  ]
}
```

### 7. Track Ad Click
Track when an ad is clicked (public endpoint).

**Endpoint:** `POST /api/ads/:id/click`

**Authentication:** Not required

**Parameters:**
- `id`: Ad ID (MongoDB ObjectId)

**Response:**
```json
{
  "success": true,
  "message": "Click tracked successfully"
}
```

### 8. Get Ad Analytics
Get analytics data for a specific ad.

**Endpoint:** `GET /api/ads/:id/analytics`

**Authentication:** Required

**Parameters:**
- `id`: Ad ID (MongoDB ObjectId)

**Response:**
```json
{
  "success": true,
  "message": "Ad analytics retrieved successfully",
  "data": {
    "impressions": 150,
    "clicks": 25,
    "views": 120,
    "clickThroughRate": "16.67",
    "budget": 100.50,
    "spentAmount": 45.20,
    "remainingBudget": 55.30,
    "status": "active",
    "createdAt": "2024-01-10T12:00:00.000Z",
    "startDate": "2024-01-15T10:00:00.000Z",
    "endDate": "2024-01-20T18:00:00.000Z"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Title must be between 1 and 100 characters"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Ad not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error creating ad",
  "error": "Database connection failed"
}
```

## Data Models

### Ad Schema
```javascript
{
  title: String, // Required, 1-100 characters
  link: String, // Optional, valid URL
  image: String, // Required, image URL
  status: String, // active, paused, draft, expired
  createdBy: ObjectId, // Reference to User
  metrics: {
    impressions: Number, // Default: 0
    clicks: Number, // Default: 0
    views: Number // Default: 0
  },
  startDate: Date, // Default: now
  endDate: Date, // Optional
  budget: Number, // Optional, positive number
  spentAmount: Number, // Default: 0
  targetAudience: String, // all, fans, stars, specific_country
  targetCountry: String, // Optional, 2-letter country code
  priority: String, // low, medium, high, urgent
  isDeleted: Boolean, // Default: false
  deletedAt: Date, // Set when soft deleted
  createdAt: Date, // Auto-generated
  updatedAt: Date // Auto-generated
}
```

## Usage Examples

### Create an Ad
```javascript
const formData = new FormData();
formData.append('title', 'Spiritual Talk - Sunday Healing');
formData.append('link', 'https://example.com/event');
formData.append('budget', '100.50');
formData.append('targetAudience', 'all');
formData.append('priority', 'medium');
formData.append('image', imageFile);

fetch('/api/ads', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});
```

### Get User's Ads
```javascript
fetch('/api/ads?page=1&limit=10&status=active', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});
```

### Update an Ad
```javascript
const formData = new FormData();
formData.append('title', 'Updated Title');
formData.append('status', 'active');

fetch('/api/ads/65f1234567890abcdef12345', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});
```

### Delete an Ad
```javascript
fetch('/api/ads/65f1234567890abcdef12345', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer ' + token
  }
});
```

## Notes

1. **Image Upload**: All image uploads are handled through Cloudinary. Maximum file size is 20MB, supported formats are JPG and JPEG.

2. **Soft Delete**: Ads are not permanently deleted but marked as deleted with a timestamp.

3. **Analytics**: Impressions are automatically tracked when ads are fetched via the public endpoint. Clicks and views need to be manually tracked.

4. **Scheduling**: Ads can be scheduled with start and end dates. Only ads within their active period and with status 'active' will be returned by the public endpoint.

5. **Targeting**: Ads can be targeted to specific audiences (all users, fans only, stars only) and countries.

6. **Priority**: Higher priority ads appear first in the public feed.

7. **Budget Tracking**: Budget and spending amounts are tracked for future payment integration.
