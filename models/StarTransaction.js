import mongoose from 'mongoose';

const starTransactionSchema = new mongoose.Schema(
  {
    starId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    fanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      index: true
    },
    dedicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DedicationRequest',
      index: true
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    type: {
      type: String,
      enum: ['appointment', 'dedication', 'commission', 'withdrawal'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled', 'refunded'],
      default: 'pending',
      index: true
    },
    escrowMovement: {
      type: String,
      enum: ['deposit', 'release'],
      default: 'deposit'
    },
    completedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// Index for efficient queries
starTransactionSchema.index({ starId: 1, createdAt: -1 });
starTransactionSchema.index({ fanId: 1, createdAt: -1 });
starTransactionSchema.index({ appointmentId: 1 });
starTransactionSchema.index({ dedicationId: 1 });
starTransactionSchema.index({ status: 1, createdAt: -1 });
starTransactionSchema.index({ transactionId: 1 });

const StarTransaction = mongoose.model('StarTransaction', starTransactionSchema);
export default StarTransaction;

