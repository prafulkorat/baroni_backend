import mongoose from 'mongoose';

const jackpotWithdrawalRequestSchema = new mongoose.Schema(
  {
    starId: {
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
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    note: {
      type: String
    },
    rejectionReason: {
      type: String
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
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

jackpotWithdrawalRequestSchema.index({ starId: 1, createdAt: -1 });
jackpotWithdrawalRequestSchema.index({ status: 1, createdAt: -1 });
jackpotWithdrawalRequestSchema.index({ approvedBy: 1, createdAt: -1 });
jackpotWithdrawalRequestSchema.index({ rejectedBy: 1, createdAt: -1 });

const JackpotWithdrawalRequest = mongoose.model('JackpotWithdrawalRequest', jackpotWithdrawalRequestSchema);
export default JackpotWithdrawalRequest;

