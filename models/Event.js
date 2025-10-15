import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: true, 
      trim: true 
    },
    description: { 
      type: String, 
      trim: true 
    },
    type: { 
      type: String, 
      enum: ['event', 'ad', 'promotion', 'announcement'], 
      required: true, 
      index: true 
    },
    startDate: { 
      type: Date, 
      required: true, 
      index: true 
    },
    endDate: { 
      type: Date, 
      required: true, 
      index: true 
    },
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
    status: { 
      type: String, 
      enum: ['draft', 'active', 'paused', 'completed', 'cancelled'], 
      default: 'draft', 
      index: true 
    },
    priority: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'urgent'], 
      default: 'medium', 
      index: true 
    },
    budget: { 
      type: Number, 
      min: 0 
    },
    spentAmount: { 
      type: Number, 
      min: 0, 
      default: 0 
    },
    image: { 
      type: String 
    },
    link: { 
      type: String 
    },
    metrics: {
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 }
    },
    createdBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      index: true 
    }
  },
  { timestamps: true }
);

// Indexes for better query performance
eventSchema.index({ type: 1, status: 1, startDate: -1 });
eventSchema.index({ targetAudience: 1, targetCountry: 1 });
eventSchema.index({ createdBy: 1, createdAt: -1 });

const Event = mongoose.model('Event', eventSchema);
export default Event;
