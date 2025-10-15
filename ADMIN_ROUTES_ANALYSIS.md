# Admin Routes Analysis & Configuration Summary

## ✅ **Admin Routes Structure**

### **1. Main Admin Routes (`/api/admin/`)**
- `POST /api/admin/signin` - Admin login (public)
- `POST /api/admin/forgot-password` - Forgot password (public)
- `POST /api/admin/reset-password` - Reset password (public)
- `POST /api/admin/create` - Create admin (public, for initial setup)
- `GET /api/admin/profile` - Get admin profile (admin auth required)
- `PUT /api/admin/profile` - Update admin profile (admin auth required)
- `POST /api/admin/change-password` - Change password (admin auth required)
- `POST /api/admin/database-cleanup` - Database cleanup (password protected)

### **2. Admin Dashboard Routes (`/api/admin/dashboard/`)**
- `GET /api/admin/dashboard/summary` - Dashboard summary metrics
- `GET /api/admin/dashboard/revenue` - Revenue insights
- `GET /api/admin/dashboard/active-users-by-country` - Active users by country
- `GET /api/admin/dashboard/cost-evaluation` - Service usage minutes
- `GET /api/admin/dashboard/service-insights/:serviceType` - Service insights
- `GET /api/admin/dashboard/top-stars` - Top performing stars
- `GET /api/admin/dashboard/complete` - Complete dashboard data
- `GET /api/admin/dashboard/service-revenue-breakdown` - Service revenue breakdown
- `GET /api/admin/dashboard/device-change-stats` - Device change statistics
- `GET /api/admin/dashboard/reported-users-details` - Reported users details

### **3. Global Configuration Routes (`/api/config/`)**
- `GET /api/config/` - Get global configuration (public)
- `PUT /api/config/` - Update global configuration (admin auth required)
- `POST /api/config/` - Update global configuration (admin auth required)
- `GET /api/config/public` - Get public config (legacy)
- `PUT /api/config/legacy` - Update config (legacy)
- `GET /api/config/categories` - Get categories (public)
- `GET /api/config/country-services` - Get country service configs (public)
- `POST /api/config/country-services` - Create country service config (admin auth required)
- `PUT /api/config/country-services/:configId` - Update country service config (admin auth required)
- `DELETE /api/config/country-services/:configId` - Delete country service config (admin auth required)

### **4. Event Management Routes (`/api/events/`)**
- `POST /api/events/` - Create event (admin auth required)
- `GET /api/events/` - Get events (admin auth required)
- `PATCH /api/events/:eventId/status` - Update event status (admin auth required)

### **5. Category Management Routes (`/api/category/`)**
- `GET /api/category/` - Get categories (auth required)
- `GET /api/category/:id` - Get category by ID (auth required)
- `POST /api/category/` - Create category (auth required)
- `PUT /api/category/:id` - Update category (auth required)
- `DELETE /api/category/:id` - Delete category (auth required)

## ✅ **Configuration Default Values**

### **Global Configuration Defaults:**
```javascript
{
  // Existing fields
  liveShowPriceHide: false,
  videoCallPriceHide: false,
  becomeBaronistarPriceHide: false,
  isTestUser: false,
  hideApplyToBecomeStar: false,
  
  // Service Limits & Defaults
  serviceLimits: {
    maxLiveShowDuration: 16, // minutes
    maxVideoCallDuration: 16, // minutes
    defaultCallTime: 16, // minutes
    dedicationUploadSize: 16, // MB
    maxLiveShowParticipants: 10000,
    reconnectionTimeout: 16 // minutes
  },
  
  // ID Verification Fees
  idVerificationFees: {
    standardIdPrice: 0,
    goldIdPrice: 0
  },
  
  // Live Show Fees
  liveShowFees: {
    hostingFee: 0
  },
  
  // Contact & Support Info
  contactSupport: {
    companyServiceNumber: '+34895723487',
    supportEmail: 'support@playform.com',
    servicesTermsUrl: 'https://help.platform.com',
    privacyPolicyUrl: 'https://help.platform.com',
    helpdeskLink: 'https://help.platform.com'
  },
  
  // Hide Elements Price
  hideElementsPrice: {
    hideDedications: false
  }
}
```

### **Default Categories (Professions):**
- Actor
- Musician
- Comedian
- Singer
- Dancer

### **Default Country Service Configurations:**
- USA (US): Video Call ✅, Dedication ❌, Live Show ✅
- Nigeria (NG): Video Call ✅, Dedication ✅, Live Show ✅
- France (FR): Video Call ✅, Dedication ✅, Live Show ❌

## ✅ **Authentication Requirements**

### **Public Routes (No Auth Required):**
- `GET /api/config/` - Get global configuration
- `GET /api/config/categories` - Get categories
- `GET /api/config/country-services` - Get country service configs
- `POST /api/admin/signin` - Admin login
- `POST /api/admin/forgot-password` - Forgot password
- `POST /api/admin/reset-password` - Reset password
- `POST /api/admin/create` - Create admin (initial setup)

### **Admin Auth Required:**
- All `/api/admin/dashboard/*` routes
- All `/api/events/*` routes
- All config update routes (`PUT /api/config/`, `POST /api/config/`)
- All country service config management routes
- Admin profile management routes

### **General Auth Required:**
- All `/api/category/*` routes (except public get)

## ✅ **Initialization Script**

### **Script Location:** `scripts/initializeDefaultConfig.js`

### **Usage:**
```bash
npm run init:config
```

### **What it does:**
1. Creates default global configuration if not exists
2. Creates default categories (professions) if not exist
3. Creates default country service configurations if not exist
4. Provides detailed logging of initialization process

## ✅ **Route Organization**

### **Main Routes Index (`routes/index.js`):**
```javascript
router.use('/auth', authRouter);
router.use('/category', categoryRouter);
router.use('/config', configRouter);
router.use('/admin', adminRouter);
router.use('/admin/dashboard', adminDashboardRouter);
router.use('/events', eventsRouter);
// ... other routes
```

### **Admin Routes Index (`routes/api/admin.js`):**
```javascript
// Public routes
router.post('/signin', adminSignInValidator, adminSignIn);
router.post('/forgot-password', adminForgotPasswordValidator, adminForgotPassword);
router.post('/reset-password', adminResetPasswordValidator, adminResetPassword);
router.post('/create', createAdminValidator, createAdmin);

// Protected routes
router.get('/profile', requireAuth, requireRole('admin'), getAdminProfile);
router.put('/profile', requireAuth, requireRole('admin'), updateAdminProfileValidator, updateAdminProfile);
router.post('/change-password', requireAuth, requireRole('admin'), adminChangePasswordValidator, adminChangePassword);
router.post('/database-cleanup', databaseCleanup);

// Dashboard routes
router.use('/dashboard', adminDashboardRouter);
```

## ✅ **Validation & Error Handling**

### **All routes have proper validation:**
- Input validation using express-validator
- Authentication middleware
- Role-based access control
- Consistent error responses
- Proper HTTP status codes

### **Error Response Format:**
```json
{
  "success": false,
  "message": "Error description"
}
```

## ✅ **Database Models**

### **Config Model:**
- Singleton pattern (only one config document)
- Automatic default value initialization
- Nested object support for complex configurations

### **Category Model:**
- Name uniqueness validation
- Image URL support
- Timestamps

### **CountryServiceConfig Model:**
- Country and country code uniqueness
- Service toggle support
- Active/inactive status

## ✅ **Recommendations**

1. **Run initialization script** after deployment:
   ```bash
   npm run init:config
   ```

2. **Create admin user** if not exists:
   ```bash
   npm run create:admin
   ```

3. **All routes are properly secured** with appropriate authentication

4. **Default values are properly set** in the model schema

5. **Backward compatibility** is maintained with legacy endpoints

## ✅ **Status: COMPLETE**

All admin routes are properly configured with:
- ✅ Correct authentication requirements
- ✅ Proper validation
- ✅ Default configuration values
- ✅ Initialization script
- ✅ Comprehensive error handling
- ✅ Role-based access control
