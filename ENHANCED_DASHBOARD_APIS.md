# Enhanced Admin Dashboard APIs Documentation

## Overview
This document describes the newly added APIs for the admin dashboard that were missing from the original implementation.

## New APIs Added

### 1. Service Revenue Breakdown API

**Endpoint:** `GET /api/admin/dashboard/service-revenue-breakdown`

**Description:** Provides detailed revenue breakdown by service type (Video Calls, Live Show, Dedication, etc.)

**Query Parameters:**
- `period` (optional): Time period filter (`current_month`, `last_month`, `last_7_days`, `last_30_days`)

**Response:**
```json
{
  "success": true,
  "message": "Service revenue breakdown retrieved successfully",
  "data": {
    "serviceRevenue": [
      {
        "service": "Video Calls",
        "revenue": 834,
        "transactionCount": 15,
        "averageTransaction": 55.6
      },
      {
        "service": "Live Show",
        "revenue": 834,
        "transactionCount": 8,
        "averageTransaction": 104.25
      },
      {
        "service": "Dedication",
        "revenue": 834,
        "transactionCount": 12,
        "averageTransaction": 69.5
      }
    ],
    "totalRevenue": 2502
  }
}
```

### 2. Device Change Tracking API

**Endpoint:** `GET /api/admin/dashboard/device-change-stats`

**Description:** Provides device type statistics with change tracking

**Query Parameters:**
- `period` (optional): Time period filter

**Response:**
```json
{
  "success": true,
  "message": "Device change stats retrieved successfully",
  "data": {
    "androidUsers": {
      "count": 4859,
      "change": 563
    },
    "iosUsers": {
      "count": 6859,
      "change": 563
    }
  }
}
```

### 3. Detailed Reported Users API

**Endpoint:** `GET /api/admin/dashboard/reported-users-details`

**Description:** Provides detailed information about reported users with pagination

**Query Parameters:**
- `status` (optional): Filter by report status (`pending`, `reviewed`, `resolved`, `dismissed`)
- `limit` (optional): Number of results per page (1-100, default: 50)
- `page` (optional): Page number (default: 1)

**Response:**
```json
{
  "success": true,
  "message": "Reported users details retrieved successfully",
  "data": {
    "reports": [
      {
        "id": "report_id",
        "reporter": {
          "id": "reporter_id",
          "name": "Reporter Name",
          "pseudo": "reporter_pseudo",
          "profilePic": "profile_url"
        },
        "reportedUser": {
          "id": "reported_user_id",
          "name": "Reported User Name",
          "pseudo": "reported_pseudo",
          "profilePic": "profile_url",
          "role": "star"
        },
        "reason": "Inappropriate behavior",
        "description": "Detailed description of the issue",
        "status": "pending",
        "createdAt": "2024-01-15T10:00:00.000Z"
      }
    ],
    "counts": {
      "stars": 4859,
      "fans": 6859,
      "total": 11718
    },
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 11718
    }
  }
}
```

## Event Management APIs

### 4. Create Event API

**Endpoint:** `POST /api/events`

**Description:** Creates a new event, ad, promotion, or announcement

**Request Body:**
```json
{
  "title": "New Year Promotion",
  "description": "Special promotion for New Year",
  "type": "promotion",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T23:59:59.000Z",
  "targetAudience": "all",
  "targetCountry": "Nigeria",
  "priority": "high",
  "budget": 1000,
  "image": "https://example.com/image.jpg",
  "link": "https://baroni.com/promotion"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event created successfully",
  "data": {
    "_id": "event_id",
    "title": "New Year Promotion",
    "type": "promotion",
    "status": "draft",
    "createdBy": "admin_id",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### 5. Get Events API

**Endpoint:** `GET /api/events`

**Description:** Retrieves events with filtering and pagination

**Query Parameters:**
- `status` (optional): Filter by status (`draft`, `active`, `paused`, `completed`, `cancelled`)
- `type` (optional): Filter by type (`event`, `ad`, `promotion`, `announcement`)
- `limit` (optional): Results per page (1-100, default: 20)
- `page` (optional): Page number (default: 1)

**Response:**
```json
{
  "success": true,
  "message": "Events retrieved successfully",
  "data": {
    "events": [
      {
        "_id": "event_id",
        "title": "New Year Promotion",
        "type": "promotion",
        "status": "active",
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-01-31T23:59:59.000Z",
        "targetAudience": "all",
        "priority": "high",
        "budget": 1000,
        "metrics": {
          "impressions": 0,
          "clicks": 0,
          "conversions": 0
        },
        "createdBy": {
          "_id": "admin_id",
          "name": "Admin Name",
          "pseudo": "admin_pseudo"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5
    }
  }
}
```

### 6. Update Event Status API

**Endpoint:** `PATCH /api/events/:eventId/status`

**Description:** Updates the status of an event

**Path Parameters:**
- `eventId`: MongoDB ObjectId of the event

**Request Body:**
```json
{
  "status": "active"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Event status updated successfully",
  "data": {
    "_id": "event_id",
    "title": "New Year Promotion",
    "status": "active",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

## New Models Added

### DeviceChange Model
Tracks device type changes for users:
```javascript
{
  userId: ObjectId,
  previousDeviceType: String, // 'ios' or 'android'
  newDeviceType: String, // 'ios' or 'android'
  changeDate: Date,
  userAgent: String,
  ipAddress: String
}
```

### Event Model
Manages events, ads, promotions, and announcements:
```javascript
{
  title: String,
  description: String,
  type: String, // 'event', 'ad', 'promotion', 'announcement'
  startDate: Date,
  endDate: Date,
  targetAudience: String, // 'all', 'fans', 'stars', 'specific_country'
  targetCountry: String,
  status: String, // 'draft', 'active', 'paused', 'completed', 'cancelled'
  priority: String, // 'low', 'medium', 'high', 'urgent'
  budget: Number,
  spentAmount: Number,
  image: String,
  link: String,
  metrics: {
    impressions: Number,
    clicks: Number,
    conversions: Number
  },
  createdBy: ObjectId
}
```

### Enhanced ReportUser Model
Updated with additional fields:
```javascript
{
  reporterId: ObjectId,
  reportedUserId: ObjectId,
  reportedUserRole: String, // 'fan' or 'star'
  reason: String,
  description: String,
  status: String // 'pending', 'reviewed', 'resolved', 'dismissed'
}
```

## Authentication
All APIs require admin authentication:
- Include `Authorization: Bearer <admin_token>` header
- Token obtained from `/api/admin/signin`

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
- `403`: Forbidden (admin access required)
- `404`: Not Found
- `500`: Internal Server Error

## Testing
Use the updated Postman collection (`ADMIN_DASHBOARD_POSTMAN_COLLECTION.json`) to test all APIs. The collection includes:
- Admin authentication
- All dashboard APIs
- Event management APIs
- Error testing scenarios
