# Rating Visibility Management API Documentation

## Overview
This API provides comprehensive rating visibility management functionality for the Baroni platform. The system allows admins to control which ratings are visible to users, particularly managing default ratings that are automatically given to new stars.

## Key Features
- **Visibility Control**: Default ratings are hidden by default, user-submitted ratings are visible
- **Admin Management**: Admins can toggle visibility of any rating
- **Bulk Operations**: Update visibility of multiple ratings at once
- **Statistics**: Comprehensive analytics on rating visibility
- **Star Management**: View and manage stars with default ratings

## Base URL
```
/api/admin/rating-management
```

## Authentication
All endpoints require admin authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <admin-jwt-token>
```

## Endpoints

### 1. Get All Reviews (Admin)
Retrieve all reviews with filtering, search, and pagination.

**Endpoint:** `GET /api/admin/rating-management/reviews`

**Authentication:** Required (Admin role)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `starId` (optional): Filter by specific star ID
- `reviewType` (optional): Filter by review type (appointment, dedication, live_show, system)
- `isVisible` (optional): Filter by visibility (true, false)
- `isDefaultRating` (optional): Filter by default rating flag (true, false)
- `search` (optional): Search by comment, reviewer name, or star name
- `sortBy` (optional): Sort field (createdAt, updatedAt, rating, reviewType)
- `sortOrder` (optional): Sort direction (asc, desc)

**Example:** `GET /api/admin/rating-management/reviews?page=1&limit=10&isVisible=false&isDefaultRating=true&sortBy=createdAt&sortOrder=desc`

**Response:**
```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": {
    "reviews": [
      {
        "id": "65f1234567890abcdef12345",
        "rating": 5,
        "comment": "Welcome to Baroni! This is your default rating as a new star.",
        "reviewer": null,
        "star": {
          "id": "65f1234567890abcdef12346",
          "name": "John Doe",
          "pseudo": "johndoe",
          "baroniId": "BAR123",
          "profilePic": "https://res.cloudinary.com/..."
        },
        "reviewType": "system",
        "isVisible": false,
        "isDefaultRating": true,
        "createdAt": "2024-01-10T12:00:00.000Z",
        "updatedAt": "2024-01-10T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalReviews": 45,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 2. Update Review Visibility
Update the visibility of a specific review.

**Endpoint:** `PUT /api/admin/rating-management/reviews/:reviewId/visibility`

**Authentication:** Required (Admin role)

**Parameters:**
- `reviewId`: Review ID (MongoDB ObjectId)

**Request Body:**
```json
{
  "isVisible": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Review visibility updated to hidden",
  "data": {
    "review": {
      "id": "65f1234567890abcdef12345",
      "rating": 5,
      "comment": "Welcome to Baroni! This is your default rating as a new star.",
      "reviewer": null,
      "star": {
        "id": "65f1234567890abcdef12346",
        "name": "John Doe",
        "pseudo": "johndoe",
        "baroniId": "BAR123",
        "profilePic": "https://res.cloudinary.com/..."
      },
      "reviewType": "system",
      "isVisible": false,
      "isDefaultRating": true,
      "updatedAt": "2024-01-10T14:30:00.000Z"
    }
  }
}
```

### 3. Bulk Update Review Visibility
Update visibility for multiple reviews at once.

**Endpoint:** `PUT /api/admin/rating-management/reviews/bulk-visibility`

**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "reviewIds": [
    "65f1234567890abcdef12345",
    "65f1234567890abcdef12346",
    "65f1234567890abcdef12347"
  ],
  "isVisible": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Visibility updated for 3 reviews",
  "data": {
    "modifiedCount": 3,
    "affectedStars": 2
  }
}
```

### 4. Get Review Statistics
Get comprehensive statistics about rating visibility.

**Endpoint:** `GET /api/admin/rating-management/statistics`

**Authentication:** Required (Admin role)

**Response:**
```json
{
  "success": true,
  "message": "Review statistics retrieved successfully",
  "data": {
    "total": 150,
    "visible": 120,
    "hidden": 30,
    "defaultRatings": 25,
    "breakdown": [
      {
        "isVisible": true,
        "isDefaultRating": false,
        "reviewType": "appointment",
        "count": 80,
        "avgRating": 4.2
      },
      {
        "isVisible": false,
        "isDefaultRating": true,
        "reviewType": "system",
        "count": 25,
        "avgRating": 5.0
      },
      {
        "isVisible": true,
        "isDefaultRating": false,
        "reviewType": "dedication",
        "count": 30,
        "avgRating": 4.5
      },
      {
        "isVisible": true,
        "isDefaultRating": false,
        "reviewType": "live_show",
        "count": 10,
        "avgRating": 4.0
      },
      {
        "isVisible": false,
        "isDefaultRating": false,
        "reviewType": "appointment",
        "count": 5,
        "avgRating": 2.0
      }
    ]
  }
}
```

### 5. Get Stars with Default Ratings
Get list of stars who have default ratings and their visibility status.

**Endpoint:** `GET /api/admin/rating-management/stars-with-default-ratings`

**Authentication:** Required (Admin role)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

**Response:**
```json
{
  "success": true,
  "message": "Stars with default ratings retrieved successfully",
  "data": {
    "stars": [
      {
        "_id": "65f1234567890abcdef12346",
        "star": {
          "_id": "65f1234567890abcdef12346",
          "name": "John Doe",
          "pseudo": "johndoe",
          "baroniId": "BAR123",
          "profilePic": "https://res.cloudinary.com/...",
          "averageRating": 4.8
        },
        "defaultRating": 5,
        "defaultComment": "Welcome to Baroni! This is your default rating as a new star.",
        "visibleReviews": 8,
        "totalReviews": 9,
        "createdAt": "2024-01-10T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalStars": 25,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

## User-Facing Rating Endpoints

### Get Star Reviews (Updated)
The existing endpoint now only returns visible reviews.

**Endpoint:** `GET /api/ratings/star/:starId`

**Authentication:** Required

**Response:** Only includes reviews where `isVisible: true`

## Data Models

### Updated Review Schema
```javascript
{
  reviewerId: ObjectId, // Reference to User (optional for system reviews)
  starId: ObjectId, // Reference to User (required)
  rating: Number, // 1-5 stars
  comment: String, // Optional comment
  appointmentId: ObjectId, // Reference to Appointment (optional)
  dedicationRequestId: ObjectId, // Reference to DedicationRequest (optional)
  liveShowId: ObjectId, // Reference to LiveShow (optional)
  reviewType: String, // appointment, dedication, live_show, system
  isVisible: Boolean, // Visibility flag (default: true)
  isDefaultRating: Boolean, // Default rating flag (default: false)
  createdAt: Date, // Auto-generated
  updatedAt: Date // Auto-generated
}
```

## Usage Examples

### Hide Default Ratings
```javascript
// Hide all default ratings
fetch('/api/admin/rating-management/reviews/bulk-visibility', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + adminToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reviewIds: ['65f1234567890abcdef12345', '65f1234567890abcdef12346'],
    isVisible: false
  })
});
```

### Show Specific Rating
```javascript
// Make a specific rating visible
fetch('/api/admin/rating-management/reviews/65f1234567890abcdef12345/visibility', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + adminToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    isVisible: true
  })
});
```

### Get Hidden Reviews
```javascript
// Get all hidden reviews
fetch('/api/admin/rating-management/reviews?isVisible=false&page=1&limit=20', {
  headers: {
    'Authorization': 'Bearer ' + adminToken
  }
});
```

### Get Default Ratings Only
```javascript
// Get all default ratings
fetch('/api/admin/rating-management/reviews?isDefaultRating=true', {
  headers: {
    'Authorization': 'Bearer ' + adminToken
  }
});
```

## Key Implementation Details

### 1. Default Rating Behavior
- New stars automatically get a 5-star default rating
- Default ratings have `isVisible: false` and `isDefaultRating: true`
- These ratings are not shown to users on the frontend
- They still count towards the star's average rating calculation

### 2. User-Submitted Ratings
- All user-submitted ratings have `isVisible: true` by default
- These are shown to users on the frontend
- Users can only see visible ratings

### 3. Average Rating Calculation
- Only visible reviews (`isVisible: true`) are counted in average rating
- Hidden reviews do not affect the star's displayed rating
- This ensures default ratings don't inflate star ratings

### 4. Admin Control
- Admins can toggle visibility of any rating
- Bulk operations allow efficient management
- Statistics provide insights into rating distribution

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "isVisible must be a boolean value"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Admin access required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Review not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error updating review visibility",
  "error": "Database connection failed"
}
```

## Migration Notes

### Existing Data
- Existing reviews will have `isVisible: true` and `isDefaultRating: false` by default
- Default ratings created by the system will have `isVisible: false` and `isDefaultRating: true`
- No data migration is required for existing reviews

### Frontend Changes Required
- Update rating display logic to only show visible reviews
- Admin interface needed for rating visibility management
- Statistics dashboard for rating management

## Benefits

1. **Clean User Experience**: Users only see genuine user reviews
2. **Admin Control**: Full control over rating visibility
3. **Fair Rating System**: Default ratings don't inflate star ratings
4. **Bulk Management**: Efficient handling of multiple ratings
5. **Analytics**: Comprehensive statistics for rating management
6. **Flexibility**: Can show/hide any rating as needed

The rating visibility system is now fully implemented and ready for production use!
