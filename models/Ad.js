import mongoose from 'mongoose';

const adSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: true, 
      trim: true,
      maxlength: 100
    },
    link: { 
      type: String, 
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Optional field
          return /^https?:\/\/.+/.test(v);
        },
        message: 'Link must be a valid URL'
      }
    },
    image: { 
      type: String, 
      required: true 
    },
    status: { 
      type: String, 
      enum: ['active', 'paused', 'draft', 'expired'], 
      default: 'draft',
      index: true 
    },
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      index: true 
    },
    // Analytics and metrics
    metrics: {
      impressions: { type: Number, default: 0, min: 0 },
      clicks: { type: Number, default: 0, min: 0 },
      views: { type: Number, default: 0, min: 0 }
    },
    // Scheduling
    startDate: { 
      type: Date, 
      default: Date.now,
      index: true 
    },
    endDate: { 
      type: Date,
      index: true 
    },
    // Budget and spending
    budget: { 
      type: Number, 
      min: 0 
    },
    spentAmount: { 
      type: Number, 
      min: 0, 
      default: 0 
    },
    // Target audience
    targetAudience: { 
      type: String, 
      enum: ['all', 'fans', 'stars', 'specific_country'], 
      default: 'all',
      index: true 
    },
    targetCountry: { 
      type: String, 
      index: true 
    },
    // Priority for display
    priority: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'urgent'], 
      default: 'medium',
      index: true 
    },
    // Soft delete
    isDeleted: { 
      type: Boolean, 
      default: false, 
      index: true 
    },
    deletedAt: { 
      type: Date 
    }
  },
  { 
    timestamps: true 
  }
);

// Indexes for better query performance
adSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
adSchema.index({ status: 1, startDate: -1, priority: -1 });
adSchema.index({ targetAudience: 1, targetCountry: 1 });
adSchema.index({ isDeleted: 1, status: 1 });

// Virtual for checking if ad is currently active
adSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && 
         this.startDate <= now && 
         (!this.endDate || this.endDate >= now) &&
         !this.isDeleted;
});

// Method to increment impressions
adSchema.methods.incrementImpressions = function() {
  this.metrics.impressions += 1;
  return this.save();
};

// Method to increment clicks
adSchema.methods.incrementClicks = function() {
  this.metrics.clicks += 1;
  return this.save();
};

// Method to increment views
adSchema.methods.incrementViews = function() {
  this.metrics.views += 1;
  return this.save();
};

// Method to soft delete
adSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.status = 'expired';
  return this.save();
};

// Pre-save middleware to validate dates
adSchema.pre('save', function(next) {
  if (this.endDate && this.startDate && this.endDate <= this.startDate) {
    return next(new Error('End date must be after start date'));
  }
  next();
});

export default mongoose.model('Ad', adSchema);
