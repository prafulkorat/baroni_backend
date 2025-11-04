import mongoose from 'mongoose';

const rateSchema = new mongoose.Schema(
  {
    videoCall: { type: Number, min: 0, max: 1, default: 0.16 },
    liveShow: { type: Number, min: 0, max: 1, default: 0.16 },
    dedication: { type: Number, min: 0, max: 1, default: 0.16 }
  },
  { _id: false }
);

const countryOverrideSchema = new mongoose.Schema(
  {
    country: { type: String, required: true, trim: true },
    countryCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    rates: { type: rateSchema, required: true }
  },
  { _id: false }
);

const commissionConfigSchema = new mongoose.Schema(
  {
    globalDefault: { type: Number, min: 0, max: 1, default: 0.15 },
    serviceDefaults: { type: rateSchema, default: () => ({}) },
    countryOverrides: { type: [countryOverrideSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

commissionConfigSchema.statics.getSingleton = async function () {
  const existing = await this.findOne();
  if (existing) return existing;
  return this.create({});
};

const CommissionConfig = mongoose.model('CommissionConfig', commissionConfigSchema);
export default CommissionConfig;


