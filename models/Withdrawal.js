import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema(
  {
    starId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ['initiated', 'approved', 'rejected', 'completed', 'failed'],
      default: 'initiated',
      index: true
    },
    note: {
      type: String
    },
    processedAt: {
      type: Date
    },
    metadata: {
      type: Object
    }
  },
  { timestamps: true }
);

withdrawalSchema.index({ starId: 1, createdAt: -1 });
withdrawalSchema.index({ adminId: 1, createdAt: -1 });

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
export default Withdrawal;


