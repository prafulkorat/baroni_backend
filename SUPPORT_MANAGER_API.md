# Support Manager API Documentation

## Overview
This API provides comprehensive support ticket management functionality for the Baroni platform, allowing users to create support tickets and admins to manage them efficiently. The system matches the mobile app screens shown in the Support Manager interface.

## Base URL
```
/api/support-manager
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

Admin endpoints require admin role in addition to authentication.

## Endpoints

### User Endpoints

#### 1. Create Support Ticket
Create a new support ticket.

**Endpoint:** `POST /api/support-manager`

**Authentication:** Required

**Request Body (multipart/form-data):**
```json
{
  "issueType": "payment",
  "title": "Payment Issue",
  "description": "I tried making a payment on 15th Sept 2025 at 9:15 AM. The transaction failed, but the amount of ₹1,200 was deducted from my bank account. I have attached the screenshot of the payment confirmation for reference. Please help me resolve this issue or initiate a refund.",
  "priority": "high",
  "category": "billing"
}
```

**File Upload:**
- `image`: Screenshot or attachment (optional, max 20MB, formats: JPG, JPEG, PNG)

**Response:**
```json
{
  "success": true,
  "message": "Support ticket created successfully",
  "data": {
    "_id": "65f1234567890abcdef12345",
    "ticketId": "#AT0000001",
    "issueType": "payment",
    "title": "Payment Issue",
    "description": "I tried making a payment on 15th Sept 2025 at 9:15 AM...",
    "image": "https://res.cloudinary.com/...",
    "status": "open",
    "priority": "high",
    "category": "billing",
    "userId": {
      "_id": "65f1234567890abcdef12346",
      "name": "John Mayer",
      "email": "john@example.com",
      "baroniId": "BAR123",
      "profilePic": "https://res.cloudinary.com/..."
    },
    "messages": [],
    "lastActivityAt": "2024-01-10T12:00:00.000Z",
    "createdAt": "2024-01-10T12:00:00.000Z",
    "updatedAt": "2024-01-10T12:00:00.000Z"
  }
}
```

#### 2. Get User's Support Tickets
Retrieve all support tickets created by the authenticated user.

**Endpoint:** `GET /api/support-manager/my-tickets`

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Support tickets retrieved successfully",
  "data": [
    {
      "_id": "65f1234567890abcdef12345",
      "ticketId": "#AT0000001",
      "issueType": "payment",
      "title": "Payment Issue",
      "description": "I tried making a payment on 15th Sept 2025...",
      "image": "https://res.cloudinary.com/...",
      "status": "open",
      "priority": "high",
      "category": "billing",
      "userId": {
        "_id": "65f1234567890abcdef12346",
        "name": "John Mayer",
        "email": "john@example.com",
        "baroniId": "BAR123",
        "profilePic": "https://res.cloudinary.com/..."
      },
      "assignedTo": null,
      "lastActivityAt": "2024-01-10T12:00:00.000Z",
      "createdAt": "2024-01-10T12:00:00.000Z",
      "updatedAt": "2024-01-10T12:00:00.000Z"
    }
  ]
}
```

#### 3. Get Specific Support Ticket
Retrieve details of a specific support ticket.

**Endpoint:** `GET /api/support-manager/:id`

**Authentication:** Required

**Parameters:**
- `id`: Ticket ID (MongoDB ObjectId)

**Response:**
```json
{
  "success": true,
  "message": "Support ticket retrieved successfully",
  "data": {
    "_id": "65f1234567890abcdef12345",
    "ticketId": "#AT0000001",
    "issueType": "payment",
    "title": "Payment Issue",
    "description": "I tried making a payment on 15th Sept 2025 at 9:15 AM. The transaction failed, but the amount of ₹1,200 was deducted from my bank account. I have attached the screenshot of the payment confirmation for reference. Please help me resolve this issue or initiate a refund.",
    "image": "https://res.cloudinary.com/...",
    "status": "open",
    "priority": "high",
    "category": "billing",
    "userId": {
      "_id": "65f1234567890abcdef12346",
      "name": "John Mayer",
      "email": "john@example.com",
      "baroniId": "BAR123",
      "profilePic": "https://res.cloudinary.com/..."
    },
    "assignedTo": null,
    "resolvedBy": null,
    "messages": [],
    "tags": [],
    "lastActivityAt": "2024-01-10T12:00:00.000Z",
    "firstResponseAt": null,
    "resolutionTime": null,
    "createdAt": "2024-01-10T12:00:00.000Z",
    "updatedAt": "2024-01-10T12:00:00.000Z"
  }
}
```

#### 4. Update Support Ticket
Update an existing support ticket (user can only update their own tickets).

**Endpoint:** `PUT /api/support-manager/:id`

**Authentication:** Required

**Parameters:**
- `id`: Ticket ID (MongoDB ObjectId)

**Request Body (multipart/form-data):**
```json
{
  "issueType": "payment",
  "title": "Updated Payment Issue",
  "description": "Updated description...",
  "priority": "urgent",
  "category": "billing"
}
```

**File Upload:**
- `image`: New screenshot or attachment (optional)

**Response:**
```json
{
  "success": true,
  "message": "Support ticket updated successfully",
  "data": {
    "_id": "65f1234567890abcdef12345",
    "ticketId": "#AT0000001",
    "issueType": "payment",
    "title": "Updated Payment Issue",
    "description": "Updated description...",
    "image": "https://res.cloudinary.com/...",
    "status": "open",
    "priority": "urgent",
    "category": "billing",
    "userId": {
      "_id": "65f1234567890abcdef12346",
      "name": "John Mayer",
      "email": "john@example.com",
      "baroniId": "BAR123",
      "profilePic": "https://res.cloudinary.com/..."
    },
    "assignedTo": null,
    "lastActivityAt": "2024-01-10T12:00:00.000Z",
    "createdAt": "2024-01-10T12:00:00.000Z",
    "updatedAt": "2024-01-10T14:30:00.000Z"
  }
}
```

#### 5. Delete Support Ticket
Delete a support ticket (soft delete).

**Endpoint:** `DELETE /api/support-manager/:id`

**Authentication:** Required

**Parameters:**
- `id`: Ticket ID (MongoDB ObjectId)

**Response:**
```json
{
  "success": true,
  "message": "Support ticket deleted successfully"
}
```

#### 6. Add Message to Ticket
Add a message to a support ticket.

**Endpoint:** `POST /api/support-manager/:id/message`

**Authentication:** Required

**Parameters:**
- `id`: Ticket ID (MongoDB ObjectId)

**Request Body:**
```json
{
  "message": "Thank you for your response. I have provided additional information.",
  "isInternal": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message added successfully",
  "data": {
    "_id": "65f1234567890abcdef12345",
    "ticketId": "#AT0000001",
    "messages": [
      {
        "_id": "65f1234567890abcdef12347",
        "sender": {
          "_id": "65f1234567890abcdef12346",
          "name": "John Mayer",
          "email": "john@example.com",
          "baroniId": "BAR123",
          "profilePic": "https://res.cloudinary.com/..."
        },
        "message": "Thank you for your response. I have provided additional information.",
        "isInternal": false,
        "createdAt": "2024-01-10T15:00:00.000Z"
      }
    ],
    "lastActivityAt": "2024-01-10T15:00:00.000Z"
  }
}
```

### Admin Endpoints

#### 7. Get All Support Tickets (Admin)
Retrieve all support tickets with filtering, search, and pagination.

**Endpoint:** `GET /api/support-manager/admin/all`

**Authentication:** Required (Admin role)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `status` (optional): Filter by status (open, in_progress, resolved, closed, cancelled)
- `priority` (optional): Filter by priority (low, medium, high, urgent)
- `issueType` (optional): Filter by issue type
- `search` (optional): Search by ticket ID, title, description, user name, or Baroni ID
- `sortBy` (optional): Sort field (createdAt, updatedAt, lastActivityAt, priority, status, title)
- `sortOrder` (optional): Sort direction (asc, desc)
- `assignedTo` (optional): Filter by assigned admin ID

**Example:** `GET /api/support-manager/admin/all?page=1&limit=10&status=open&search=payment&sortBy=createdAt&sortOrder=desc`

**Response:**
```json
{
  "success": true,
  "message": "Support tickets retrieved successfully",
  "data": {
    "tickets": [
      {
        "_id": "65f1234567890abcdef12345",
        "ticketId": "#AT0000001",
        "issueType": "payment",
        "title": "Payment Issue",
        "description": "I tried making a payment on 15th Sept 2025...",
        "image": "https://res.cloudinary.com/...",
        "status": "open",
        "priority": "high",
        "category": "billing",
        "userId": {
          "_id": "65f1234567890abcdef12346",
          "name": "John Mayer",
          "email": "john@example.com",
          "baroniId": "BAR123",
          "profilePic": "https://res.cloudinary.com/..."
        },
        "assignedTo": null,
        "resolvedBy": null,
        "lastActivityAt": "2024-01-10T12:00:00.000Z",
        "createdAt": "2024-01-10T12:00:00.000Z",
        "updatedAt": "2024-01-10T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalTickets": 45,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### 8. Update Ticket Status (Admin)
Update the status of a support ticket.

**Endpoint:** `PUT /api/support-manager/admin/:id/status`

**Authentication:** Required (Admin role)

**Parameters:**
- `id`: Ticket ID (MongoDB ObjectId)

**Request Body:**
```json
{
  "status": "in_progress",
  "message": "We are investigating your payment issue. Please allow 24-48 hours for resolution."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Ticket status updated successfully",
  "data": {
    "_id": "65f1234567890abcdef12345",
    "ticketId": "#AT0000001",
    "status": "in_progress",
    "messages": [
      {
        "_id": "65f1234567890abcdef12348",
        "sender": {
          "_id": "65f1234567890abcdef12349",
          "name": "Admin User",
          "email": "admin@example.com",
          "baroniId": "ADMIN001",
          "profilePic": "https://res.cloudinary.com/..."
        },
        "message": "We are investigating your payment issue. Please allow 24-48 hours for resolution.",
        "isInternal": false,
        "createdAt": "2024-01-10T16:00:00.000Z"
      }
    ],
    "lastActivityAt": "2024-01-10T16:00:00.000Z",
    "firstResponseAt": "2024-01-10T16:00:00.000Z"
  }
}
```

#### 9. Assign Ticket (Admin)
Assign a support ticket to a specific admin.

**Endpoint:** `PUT /api/support-manager/admin/:id/assign`

**Authentication:** Required (Admin role)

**Parameters:**
- `id`: Ticket ID (MongoDB ObjectId)

**Request Body:**
```json
{
  "assignedTo": "65f1234567890abcdef12350"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Ticket assigned successfully",
  "data": {
    "_id": "65f1234567890abcdef12345",
    "ticketId": "#AT0000001",
    "assignedTo": {
      "_id": "65f1234567890abcdef12350",
      "name": "Support Admin",
      "email": "support@example.com",
      "baroniId": "ADMIN002"
    },
    "messages": [
      {
        "_id": "65f1234567890abcdef12351",
        "sender": {
          "_id": "65f1234567890abcdef12349",
          "name": "Admin User",
          "email": "admin@example.com",
          "baroniId": "ADMIN001"
        },
        "message": "Ticket assigned to admin",
        "isInternal": true,
        "createdAt": "2024-01-10T17:00:00.000Z"
      }
    ],
    "lastActivityAt": "2024-01-10T17:00:00.000Z"
  }
}
```

#### 10. Get Ticket Statistics (Admin)
Get comprehensive statistics for the support dashboard.

**Endpoint:** `GET /api/support-manager/admin/statistics`

**Authentication:** Required (Admin role)

**Response:**
```json
{
  "success": true,
  "message": "Ticket statistics retrieved successfully",
  "data": {
    "open": 15,
    "in_progress": 8,
    "resolved": 120,
    "closed": 5,
    "cancelled": 2,
    "total": 150,
    "avgResolutionTime": 45.5,
    "avgFirstResponseTime": 2.3
  }
}
```

#### 11. Get Admin Users (Admin)
Get list of admin users for ticket assignment.

**Endpoint:** `GET /api/support-manager/admin/users`

**Authentication:** Required (Admin role)

**Response:**
```json
{
  "success": true,
  "message": "Admin users retrieved successfully",
  "data": [
    {
      "_id": "65f1234567890abcdef12349",
      "name": "Admin User",
      "email": "admin@example.com",
      "baroniId": "ADMIN001",
      "profilePic": "https://res.cloudinary.com/..."
    },
    {
      "_id": "65f1234567890abcdef12350",
      "name": "Support Admin",
      "email": "support@example.com",
      "baroniId": "ADMIN002",
      "profilePic": "https://res.cloudinary.com/..."
    }
  ]
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Title must be between 1 and 200 characters"
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
  "message": "Access denied"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Support ticket not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error creating support ticket",
  "error": "Database connection failed"
}
```

## Data Models

### Support Ticket Schema
```javascript
{
  ticketId: String, // Auto-generated unique ID (e.g., "#AT0000001")
  issueType: String, // payment, technical, account, general, refund, booking, live_show, dedication, other
  title: String, // Required, 1-200 characters
  description: String, // Required, 1-2000 characters
  image: String, // Optional, image URL
  userId: ObjectId, // Reference to User
  status: String, // open, in_progress, resolved, closed, cancelled
  priority: String, // low, medium, high, urgent
  assignedTo: ObjectId, // Reference to User (admin)
  resolvedBy: ObjectId, // Reference to User (admin)
  resolvedAt: Date, // When ticket was resolved
  messages: [{
    sender: ObjectId, // Reference to User
    message: String, // 1-1000 characters
    isInternal: Boolean, // Internal admin notes
    createdAt: Date
  }],
  tags: [String], // Optional tags
  category: String, // billing, technical, account, feature_request, bug_report, general
  lastActivityAt: Date, // Last activity timestamp
  firstResponseAt: Date, // First admin response time
  resolutionTime: Number, // Resolution time in minutes
  isDeleted: Boolean, // Soft delete flag
  deletedAt: Date, // Soft delete timestamp
  createdAt: Date, // Auto-generated
  updatedAt: Date // Auto-generated
}
```

## Usage Examples

### Create Support Ticket
```javascript
const formData = new FormData();
formData.append('issueType', 'payment');
formData.append('title', 'Payment Issue');
formData.append('description', 'I tried making a payment but it failed...');
formData.append('priority', 'high');
formData.append('category', 'billing');
formData.append('image', imageFile);

fetch('/api/support-manager', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});
```

### Search Tickets (Admin)
```javascript
fetch('/api/support-manager/admin/all?search=payment&status=open&page=1&limit=10', {
  headers: {
    'Authorization': 'Bearer ' + adminToken
  }
});
```

### Update Ticket Status (Admin)
```javascript
fetch('/api/support-manager/admin/65f1234567890abcdef12345/status', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + adminToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    status: 'resolved',
    message: 'Issue has been resolved. Refund processed.'
  })
});
```

### Assign Ticket (Admin)
```javascript
fetch('/api/support-manager/admin/65f1234567890abcdef12345/assign', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer ' + adminToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    assignedTo: '65f1234567890abcdef12350'
  })
});
```

## Mobile App Integration

The API perfectly matches the mobile app screens:

### Support Manager Screen
- **Search functionality** → `GET /api/support-manager/admin/all?search=...`
- **Filter tabs** → `GET /api/support-manager/admin/all?status=open|in_progress|resolved`
- **Ticket list** → Paginated response with user info, status, and attachments
- **Ticket details** → `GET /api/support-manager/:id`

### Ticket Details Screen
- **Ticket info** → Complete ticket data with user details
- **Messages** → Communication history with timestamps
- **Attachments** → Image display from Cloudinary URLs
- **Status buttons** → `PUT /api/support-manager/admin/:id/status`
- **Assignment** → `PUT /api/support-manager/admin/:id/assign`

## Features Implemented

✅ **Complete Ticket Management System**
✅ **Auto-generated Ticket IDs** (e.g., #AT4445209)
✅ **Status Tracking** (Open, In Progress, Resolved, Closed, Cancelled)
✅ **Priority Management** (Low, Medium, High, Urgent)
✅ **Admin Assignment System**
✅ **Message Threading** (User ↔ Admin communication)
✅ **File Attachments** (Screenshots, documents)
✅ **Search & Filtering** (By status, priority, issue type, user)
✅ **Pagination** (Efficient data loading)
✅ **Statistics Dashboard** (Ticket counts, resolution times)
✅ **Soft Delete** (Data preservation)
✅ **Role-based Access** (User vs Admin permissions)
✅ **Real-time Activity Tracking**
✅ **Resolution Time Analytics**

The system is now ready for production use and matches all the functionality shown in your mobile app screens!
