import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    baroniId: { type: String, unique: true, sparse: true, index: true },
    contact: { type: String, trim: true, unique: true, sparse: true },
    email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    password: { type: String },
    coinBalance: { type: Number, default: 20, min: 0 },
    name: { type: String, trim: true },
    pseudo: { type: String, trim: true },
    profilePic: { type: String,default: 'https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/placeholder_aws6oc.png' },
    preferredLanguage: { type: String },
    preferredCurrency: { type: String, default: 'F' },
    country: { type: String },
    about: { type: String, trim: true},
    location: { type: String, trim: true },
    profession: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    role: { type: String, enum: ['fan', 'star', 'admin'], default: 'fan' },
    availableForBookings: { type: Boolean, default: true },
    appNotification: { type: Boolean, default: true },
    hidden: { type: Boolean, default: false },
    fcmToken: { type: String, sparse: true, index: true },
    apnsToken: { type: String, sparse: true, index: true },
    voipToken: { type: String, sparse: true, index: true },
    deviceType: { type: String, enum: ['ios', 'android'], sparse: true, index: true },
    isDev: { type: Boolean, default: false, index: true },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    providers: {
      google: {
        id: { type: String, index: true },
      },
      apple: {
        id: { type: String, index: true },
      },
    },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    profileImpressions: { type: Number, default: 0, min: 0 },
    // Incremented on every successful login to invalidate old tokens
    sessionVersion: { type: Number, default: 0 },
    // Unique 7-digit numeric key for RTC/RTM token generation
    agoraKey: { type: String, unique: true, sparse: true, index: true },
    // Agora Chat token for messaging
    chatToken: { type: String, sparse: true },
    // Payment status for star promotion (initiated, pending, completed, refunded)
    paymentStatus: { type: String, enum: ['initiated', 'pending', 'completed', 'refunded'], default: null, index: true },
    // Rating system fields for stars
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Ensure legacy unique index on `pseudo` is removed if it exists
userSchema.index({ pseudo: 1 }, { unique: false, sparse: false, name: 'pseudo_1_non_unique' });

// Pre-save hook to set default about text and rating for star users
userSchema.pre('save', function(next) {
  // Only set defaults if user is becoming a star
  if (this.role === 'star') {
    // Set default about text if not already set
    if (!this.about || this.about.trim() === '') {
      this.about = "Coucou, c'est ta star 🌟 ! Je suis là pour te partager de la bonne humeur, de l'énergie et des dédicaces pleines d'amour.";
    }
    
    // Only set default rating if this is a completely new star (no reviews yet)
    // Don't override existing ratings that might have been set by the rating system
    if (this.isNew && this.totalReviews === 0) {
      this.averageRating = 5;
      this.totalReviews = 1;
    }
  }
  next();
});

const User = mongoose.model('User', userSchema);
export default User;


