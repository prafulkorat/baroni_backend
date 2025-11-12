import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    reviewerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: false, // Optional for system reviews
      index: true 
    },
    starId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      index: true 
    },
    rating: { 
      type: Number, 
      required: true, 
      min: 1, 
      max: 5 
    },
    comment: { 
      type: String, 
      trim: true, 
      maxlength: 500 
    },
    appointmentId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Appointment', 
      index: true 
    },
    dedicationRequestId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'DedicationRequest', 
      index: true 
    },
    liveShowId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'LiveShow', 
      index: true 
    },
    reviewType: { 
      type: String, 
      enum: ['appointment', 'dedication', 'live_show', 'system'], 
      required: true 
    },
    // Visibility flag - false for default/system ratings, true for user-submitted ratings
    isVisible: {
      type: Boolean,
      default: true,
      index: true
    },
    // Flag to identify if this is a default rating given to new stars
    isDefaultRating: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
reviewSchema.index({ starId: 1, createdAt: -1 });
reviewSchema.index({ reviewerId: 1, starId: 1 });
reviewSchema.index({ reviewType: 1, createdAt: -1 });
reviewSchema.index({ starId: 1, isVisible: 1, createdAt: -1 }); // For visible reviews only
reviewSchema.index({ isDefaultRating: 1, isVisible: 1 }); // For admin management

// Ensure one review per appointment/dedication/live show per fan
// Ensure one review per item type by using partial unique indexes
// Partial indexes avoid collisions when unrelated IDs are missing/null
reviewSchema.index({ 
  reviewerId: 1, 
  appointmentId: 1 
}, { 
  unique: true,
  partialFilterExpression: { appointmentId: { $exists: true, $ne: null } }
});

reviewSchema.index({ 
  reviewerId: 1, 
  dedicationRequestId: 1 
}, { 
  unique: true,
  partialFilterExpression: { dedicationRequestId: { $exists: true, $ne: null } }
});

reviewSchema.index({ 
  reviewerId: 1, 
  liveShowId: 1 
}, { 
  unique: true,
  partialFilterExpression: { liveShowId: { $exists: true, $ne: null } }
});

const Review = mongoose.model('Review', reviewSchema);
export default Review;










