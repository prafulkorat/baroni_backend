# Admin Management API Documentation

This document provides comprehensive API documentation for the admin management endpoints that handle user management, star management, review management, and reported users management.

## Base URL
```
/api/admin/management
```

All endpoints require admin authentication and role verification.

## Authentication
All endpoints require:
- Valid JWT token in Authorization header
- Admin role verification

## User Management APIs

### 1. Get All Users
**GET** `/users`

Get all users with filtering, searching, and pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `search` (optional): Search by name, pseudo, baroniId, email, or contact
- `role` (optional): Filter by role (fan, star, all)
- `country` (optional): Filter by country
- `status` (optional): Filter by status (active, blocked, all)
- `sortBy` (optional): Sort field (name, pseudo, email, role, country, createdAt, lastLoginAt)
- `sortOrder` (optional): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "id": "user_id",
        "baroniId": "BR12345",
        "name": "John Doe",
        "pseudo": "johndoe",
        "email": "john@example.com",
        "contact": "+1234567890",
        "profilePic": "url",
        "role": "star",
        "country": "USA",
        "profession": "Actor",
        "availableForBookings": true,
        "hidden": false,
        "status": "active",
        "coinBalance": 100,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "lastLoginAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    },
    "filters": {
      "countries": ["USA", "Canada", "UK"],
      "roles": ["star", "fan"],
      "statuses": ["active", "blocked"]
    },
    "stats": {
      "roles": {
        "star": 50,
        "fan": 50
      },
      "status": {
        "active": 80,
        "blocked": 20
      }
    }
  }
}
```

### 2. Get User Details
**GET** `/users/:userId`

Get detailed information about a specific user.

**Response:**
```json
{
  "success": true,
  "message": "User details retrieved successfully",
  "data": {
    "user": {
      "id": "user_id",
      "baroniId": "BR12345",
      "contact": "+1234567890",
      "email": "john@example.com",
      "password": "[HIDDEN]",
      "coinBalance": 100,
      "name": "John Doe",
      "pseudo": "johndoe",
      "profilePic": "url",
      "preferredLanguage": "en",
      "preferredCurrency": "F",
      "country": "USA",
      "about": "About text",
      "location": "Los Angeles",
      "profession": "Actor",
      "role": "star",
      "availableForBookings": true,
      "appNotification": true,
      "hidden": false,
      "fcmToken": "fcm_token_here",
      "apnsToken": "apns_token_here",
      "voipToken": "voip_token_here",
      "deviceType": "ios",
      "isDev": false,
      "favorites": [
        {
          "id": "favorite_user_id",
          "name": "Favorite User",
          "pseudo": "favoriteuser",
          "profilePic": "url",
          "role": "star"
        }
      ],
      "isDeleted": false,
      "deletedAt": null,
      "providers": {
        "google": {
          "id": "google_id"
        },
        "apple": {
          "id": "apple_id"
        }
      },
      "passwordResetToken": "[HIDDEN]",
      "passwordResetExpires": "2024-01-01T00:00:00.000Z",
      "profileImpressions": 150,
      "sessionVersion": 1,
      "agoraKey": "1234567",
      "chatToken": "[HIDDEN]",
      "paymentStatus": "completed",
      "averageRating": 4.5,
      "totalReviews": 25,
      "feature_star": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "services": [],
    "dedicationSamples": [],
    "reviews": [],
    "reports": {
      "asReporter": [],
      "asReported": []
    },
    "stats": {
      "totalSpent": 500,
      "totalEarned": 1000,
      "transactionCount": 10
    }
  }
}
```

### 3. Update User Status
**PATCH** `/users/:userId/status`

Block or unblock a user.

**Request Body:**
```json
{
  "action": "block", // or "unblock"
  "reason": "Violation of terms"
}
```

### 4. Update User Role
**PATCH** `/users/:userId/role`

Change user role between fan and star.

**Request Body:**
```json
{
  "role": "star" // or "fan"
}
```

### 5. Delete User
**DELETE** `/users/:userId`

Soft delete a user.

**Request Body:**
```json
{
  "reason": "Account closure request"
}
```

### 6. Get User Statistics
**GET** `/users-stats`

Get user statistics and analytics.

**Query Parameters:**
- `period` (optional): Time period (current_month, last_month, last_7_days, last_30_days)

## Star Management APIs

### 1. Get All Stars
**GET** `/stars`

Get all stars with filtering and search capabilities.

**Query Parameters:**
- `page`, `limit`, `search`, `country`, `status`, `sortBy`, `sortOrder`

### 2. Get Star Profile
**GET** `/stars/:starId`

Get comprehensive star profile with revenue and activity data.

**Response:**
```json
{
  "success": true,
  "message": "Star profile retrieved successfully",
  "data": {
    "star": {
      "id": "star_id",
      "baroniId": "BR12345",
      "name": "Emma Johnson",
      "pseudo": "emma_j",
      "email": "emma@example.com",
      "contact": "+1234567890",
      "profilePic": "url",
      "role": "star",
      "country": "USA",
      "profession": "Actor",
      "about": "Award-winning actress...",
      "location": "Hollywood",
      "availableForBookings": true,
      "hidden": false,
      "appNotification": true,
      "coinBalance": 500,
      "deviceType": "ios",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-01T00:00:00.000Z"
    },
    "rating": {
      "average": 5,
      "totalReviews": 90
    },
    "services": [
      {
        "id": "service_id",
        "type": "Video Call",
        "price": 75,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "dedicationSamples": [
      {
        "id": "sample_id",
        "type": "Birthday Wish",
        "video": "video_url",
        "description": "Sample description",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "overview": {
      "videoCalls": 184,
      "dedications": 184,
      "liveShows": 184,
      "engagedUsers": 184
    },
    "cancelled": {
      "videoCalls": 10,
      "dedications": 5,
      "liveShows": 2
    },
    "revenue": {
      "total": 14230,
      "escrow": 497
    }
  }
}
```

### 3. Update Star Profile
**PUT** `/stars/:starId`

Update star profile information.

**Request Body:**
```json
{
  "name": "Emma Johnson",
  "pseudo": "emma_j",
  "email": "emma@example.com",
  "contact": "+1234567890",
  "profilePic": "url",
  "country": "USA",
  "profession": "profession_id",
  "about": "Updated about text",
  "location": "Hollywood",
  "availableForBookings": true,
  "hidden": false,
  "appNotification": true
}
```

### 4. Star Services Management

#### Get Star Services
**GET** `/stars/:starId/services`

#### Add Star Service
**POST** `/stars/:starId/services`

**Request Body:**
```json
{
  "type": "Video Call",
  "price": 75
}
```

#### Update Star Service
**PUT** `/stars/:starId/services/:serviceId`

#### Delete Star Service
**DELETE** `/stars/:starId/services/:serviceId`

### 5. Star Dedication Samples Management

#### Get Star Dedication Samples
**GET** `/stars/:starId/dedication-samples`

#### Add Star Dedication Sample
**POST** `/stars/:starId/dedication-samples`

**Request Body:**
```json
{
  "type": "Birthday Wish",
  "video": "video_url",
  "description": "Sample description"
}
```

#### Update Star Dedication Sample
**PUT** `/stars/:starId/dedication-samples/:sampleId`

#### Delete Star Dedication Sample
**DELETE** `/stars/:starId/dedication-samples/:sampleId`

## Review Management APIs

### 1. Get All Reviews
**GET** `/reviews`

Get all reviews with filtering and search capabilities.

**Query Parameters:**
- `page`, `limit`, `search`, `starId`, `reviewerId`, `rating`, `reviewType`, `sortBy`, `sortOrder`

**Response:**
```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": {
    "reviews": [
      {
        "id": "review_id",
        "rating": 5,
        "comment": "Emma was amazing! She created a birthday message...",
        "reviewType": "dedication",
        "reviewer": {
          "id": "reviewer_id",
          "name": "Michael R.",
          "pseudo": "michael_r",
          "profilePic": "url"
        },
        "star": {
          "id": "star_id",
          "name": "Emma Johnson",
          "pseudo": "emma_j",
          "profilePic": "url",
          "role": "star"
        },
        "appointmentId": null,
        "dedicationRequestId": "dedication_id",
        "liveShowId": null,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    },
    "stats": {
      "averageRating": 4.5,
      "totalReviews": 100,
      "ratingDistribution": [
        { "rating": 5, "count": 60 },
        { "rating": 4, "count": 25 },
        { "rating": 3, "count": 10 },
        { "rating": 2, "count": 3 },
        { "rating": 1, "count": 2 }
      ],
      "typeDistribution": [
        { "type": "appointment", "count": 40 },
        { "type": "dedication", "count": 35 },
        { "type": "live_show", "count": 25 }
      ]
    },
    "filters": {
      "reviewTypes": ["appointment", "dedication", "live_show"],
      "ratings": [1, 2, 3, 4, 5]
    }
  }
}
```

### 2. Get Review Details
**GET** `/reviews/:reviewId`

### 3. Update Review
**PUT** `/reviews/:reviewId`

**Request Body:**
```json
{
  "rating": 5,
  "comment": "Updated comment"
}
```

### 4. Delete Review
**DELETE** `/reviews/:reviewId`

### 5. Get Star Reviews
**GET** `/stars/:starId/reviews`

### 6. Get Review Statistics
**GET** `/reviews-stats`

## Reported Users Management APIs

### 1. Get All Reported Users
**GET** `/reported-users`

Get all reported users with filtering and search capabilities.

**Query Parameters:**
- `page`, `limit`, `search`, `status`, `reportedUserRole`, `country`, `sortBy`, `sortOrder`

**Response:**
```json
{
  "success": true,
  "message": "Reported users retrieved successfully",
  "data": {
    "reports": [
      {
        "id": "report_id",
        "reporter": {
          "id": "reporter_id",
          "name": "John Meyer",
          "pseudo": "john_m",
          "profilePic": "url",
          "role": "fan",
          "country": "USA"
        },
        "reportedUser": {
          "id": "reported_user_id",
          "name": "Jane Doe",
          "pseudo": "jane_d",
          "profilePic": "url",
          "role": "star",
          "country": "Senegal"
        },
        "reason": "Inappropriate behavior",
        "description": "Detailed description of the issue",
        "status": "pending",
        "reportedUserRole": "star",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "pages": 3
    },
    "filters": {
      "countries": ["USA", "Senegal", "Canada"],
      "statuses": ["pending", "reviewed", "resolved", "dismissed"],
      "roles": ["star", "fan"]
    },
    "stats": {
      "status": {
        "pending": 20,
        "reviewed": 15,
        "resolved": 10,
        "dismissed": 5
      },
      "roles": {
        "star": 30,
        "fan": 20
      }
    },
    "mostReportedUsers": [
      {
        "userId": "user_id",
        "userName": "John Meyer",
        "userPseudo": "john_m",
        "userProfilePic": "url",
        "userRole": "star",
        "userCountry": "Senegal",
        "reportCount": 5
      }
    ]
  }
}
```

### 2. Get Reported User Details
**GET** `/reported-users/:reportId`

### 3. Update Report Status
**PATCH** `/reported-users/:reportId/status`

**Request Body:**
```json
{
  "status": "resolved",
  "adminNotes": "Investigation completed, user warned"
}
```

### 4. Block Reported User
**POST** `/reported-users/:reportId/block`

**Request Body:**
```json
{
  "reason": "Multiple violations reported"
}
```

### 5. Unblock Reported User
**POST** `/reported-users/:reportId/unblock`

**Request Body:**
```json
{
  "reason": "Investigation completed, no violations found"
}
```

### 6. Delete Report
**DELETE** `/reported-users/:reportId`

### 7. Get Reported Users Statistics
**GET** `/reported-users-stats`

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource not found)
- `500`: Internal Server Error

## Rate Limiting

All endpoints are subject to rate limiting to prevent abuse.

## Notes

1. All timestamps are in ISO 8601 format (UTC)
2. All monetary values are in the base currency
3. Pagination is 1-based (page 1, 2, 3...)
4. Search is case-insensitive and supports partial matches
5. All file uploads should use the existing file upload endpoints
6. Admin actions are logged for audit purposes
