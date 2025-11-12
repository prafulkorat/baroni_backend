import mongoose from 'mongoose';

const countryServiceConfigSchema = new mongoose.Schema(
  {
    country: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      index: true 
    },
    countryCode: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      index: true 
    },
    services: {
      videoCall: { 
        type: Boolean, 
        default: true 
      },
      dedication: { 
        type: Boolean, 
        default: true 
      },
      liveShow: { 
        type: Boolean, 
        default: true 
      }
    },
    isActive: { 
      type: Boolean, 
      default: true, 
      index: true 
    },
    sortOrder: { 
      type: Number, 
      default: 0 
    }
  },
  { timestamps: true }
);

// Index for better query performance
countryServiceConfigSchema.index({ country: 1, isActive: 1 });
countryServiceConfigSchema.index({ countryCode: 1, isActive: 1 });

const CountryServiceConfig = mongoose.model('CountryServiceConfig', countryServiceConfigSchema);
export default CountryServiceConfig;
