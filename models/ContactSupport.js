import mongoose from 'mongoose';

const contactSupportSchema = new mongoose.Schema(
  {
    // Basic ticket information
    ticketId: {
      type: String,
      unique: true,
      required: false,
      index: true
    },
    issueType: {
      type: String,
      required: true,
      trim: true,
      enum: ['payment', 'technical', 'account', 'general', 'refund', 'booking', 'live_show', 'dedication', 'other', 'Autre']
    },
    title: {
      type: String,
      required: false,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    image: {
      type: String,
      trim: true,
      default: 'https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/placeholder_aws6oc.png',
    },
    
    // User information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    
    // Ticket status and management
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed', 'cancelled'],
      default: 'open',
      index: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true
    },
    
    // Assignment and resolution
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: {
      type: Date
    },
    
    // Communication and notes
    messages: [{
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
      },
      isInternal: {
        type: Boolean,
        default: false
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Additional metadata
    tags: [{
      type: String,
      trim: true
    }],
    category: {
      type: String,
      enum: ['billing', 'technical', 'account', 'feature_request', 'bug_report', 'general'],
      default: 'general'
    },
    
    // Timestamps and tracking
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    firstResponseAt: {
      type: Date
    },
    resolutionTime: {
      type: Number // in minutes
    },
    
    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// Generate unique ticket ID before saving
contactSupportSchema.pre('save', async function(next) {
  if (this.isNew && !this.ticketId) {
    const count = await this.constructor.countDocuments();
    this.ticketId = `#AT${String(count + 1).padStart(7, '0')}`;
  }
  
  // Auto-generate title from description if not provided
  if (!this.title && this.description) {
    // Take first 50 characters of description as title
    this.title = this.description.substring(0, 50).trim();
    if (this.description.length > 50) {
      this.title += '...';
    }
  }
  
  // Map 'Autre' to 'other' for consistency
  if (this.issueType === 'Autre') {
    this.issueType = 'other';
  }
  
  next();
});

// Update lastActivityAt when messages are added
contactSupportSchema.pre('save', function(next) {
  if (this.isModified('messages') && this.messages.length > 0) {
    this.lastActivityAt = new Date();
  }
  next();
});

// Indexes for better query performance
contactSupportSchema.index({ userId: 1, createdAt: -1 });
contactSupportSchema.index({ status: 1, priority: -1, createdAt: -1 });
contactSupportSchema.index({ assignedTo: 1, status: 1 });
contactSupportSchema.index({ ticketId: 1 });
contactSupportSchema.index({ issueType: 1, status: 1 });
contactSupportSchema.index({ lastActivityAt: -1 });
contactSupportSchema.index({ isDeleted: 1, status: 1 });

// Virtual for checking if ticket is active
contactSupportSchema.virtual('isActive').get(function() {
  return !this.isDeleted && ['open', 'in_progress'].includes(this.status);
});

// Method to add a message to the ticket
contactSupportSchema.methods.addMessage = function(senderId, message, isInternal = false) {
  this.messages.push({
    sender: senderId,
    message,
    isInternal,
    createdAt: new Date()
  });
  this.lastActivityAt = new Date();
  
  // Set first response time if this is the first admin response
  if (!isInternal && !this.firstResponseAt) {
    this.firstResponseAt = new Date();
  }
  
  return this.save();
};

// Method to update ticket status
contactSupportSchema.methods.updateStatus = function(newStatus, updatedBy) {
  const oldStatus = this.status;
  this.status = newStatus;
  this.lastActivityAt = new Date();
  
  if (newStatus === 'resolved') {
    this.resolvedBy = updatedBy;
    this.resolvedAt = new Date();
    
    // Calculate resolution time
    if (this.firstResponseAt) {
      this.resolutionTime = Math.round((this.resolvedAt - this.firstResponseAt) / (1000 * 60)); // in minutes
    }
  }
  
  return this.save();
};

// Method to assign ticket
contactSupportSchema.methods.assignTicket = function(assignedToId, assignedBy) {
  this.assignedTo = assignedToId;
  this.lastActivityAt = new Date();
  
  // Add internal message about assignment
  this.addMessage(assignedBy, `Ticket assigned to admin`, true);
  
  return this.save();
};

// Method to soft delete
contactSupportSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.status = 'closed';
  return this.save();
};

// Static method to get ticket statistics
contactSupportSchema.statics.getTicketStats = async function() {
  const stats = await this.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    cancelled: 0,
    total: 0
  };
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
    result.total += stat.count;
  });
  
  return result;
};

const ContactSupport = mongoose.model('ContactSupport', contactSupportSchema);
export default ContactSupport;
