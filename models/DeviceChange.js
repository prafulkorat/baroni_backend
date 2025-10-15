import mongoose from 'mongoose';

const deviceChangeSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User', 
      required: true, 
      index: true 
    },
    previousDeviceType: { 
      type: String, 
      enum: ['ios', 'android'], 
      index: true 
    },
    newDeviceType: { 
      type: String, 
      enum: ['ios', 'android'], 
      required: true, 
      index: true 
    },
    changeDate: { 
      type: Date, 
      default: Date.now, 
      index: true 
    },
    userAgent: { 
      type: String 
    },
    ipAddress: { 
      type: String 
    }
  },
  { timestamps: true }
);

// Indexes for better query performance
deviceChangeSchema.index({ userId: 1, changeDate: -1 });
deviceChangeSchema.index({ newDeviceType: 1, changeDate: -1 });

const DeviceChange = mongoose.model('DeviceChange', deviceChangeSchema);
export default DeviceChange;
