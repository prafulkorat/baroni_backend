import mongoose from 'mongoose';

const configSchema = new mongoose.Schema(
  {
    // Existing fields
    liveShowPriceHide: { type: Boolean, default: false },
    videoCallPriceHide: { type: Boolean, default: false },
    becomeBaronistarPriceHide: { type: Boolean, default: false },
    isTestUser: { type: Boolean, default: false },
    
    // Service Limits & Defaults
    serviceLimits: {
      liveShowDuration: { type: Number, default: 16 }, // in minutes
      videoCallDuration: { type: Number, default: 16 }, // in minutes
      slotDuration: { type: Number, default: 16 }, // in minutes
      dedicationUploadSize: { type: Number, default: 16 }, // in MB
      maxLiveShowParticipants: { type: Number, default: 10000 },
      reconnectionTimeout: { type: Number, default: 16 } // in minutes
    },
    
    // ID Verification Fees
    idVerificationFees: {
      standardIdPrice: { type: Number, default: 0 },
      goldIdPrice: { type: Number, default: 0 }
    },
    
    // Live Show Fees
    liveShowFees: {
      hostingFee: { type: Number, default: 0 }
    },
    
    // Contact & Support Info
    contactSupport: {
      companyServiceNumber: { type: String, default: '+34895723487' },
      supportEmail: { type: String, default: 'support@playform.com' },
      servicesTermsUrl: { type: String, default: 'https://help.platform.com' },
      privacyPolicyUrl: { type: String, default: 'https://help.platform.com' },
      helpdeskLink: { type: String, default: 'https://help.platform.com' }
    },
    
    // Hide Elements Price
    hideElementsPrice: {
      hideDedications: { type: Boolean, default: false }
    },
    
    // Hide Apply to Become Star
    hideApplyToBecomeStar: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Ensure only a single config document is used operationally
configSchema.statics.getSingleton = async function () {
  const existing = await this.findOne();
  if (existing) return existing;
  return this.create({});
};

const Config = mongoose.model('Config', configSchema);
export default Config;






