import mongoose from 'mongoose';

const starWalletSchema = new mongoose.Schema(
  {
    starId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    escrow: {
      type: Number,
      default: 0,
      min: 0
    },
    jackpot: {
      type: Number,
      default: 0,
      min: 0
    },
    totalEarned: {
      type: Number,
      default: 0,
      min: 0
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

// Index for efficient queries
starWalletSchema.index({ starId: 1 });
starWalletSchema.index({ createdAt: -1 });

const StarWallet = mongoose.model('StarWallet', starWalletSchema);
export default StarWallet;

