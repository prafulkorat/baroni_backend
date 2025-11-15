import {validationResult} from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import DedicationRequest from '../models/DedicationRequest.js';
import {generateUniqueTrackingId} from '../utils/trackingIdGenerator.js';
import {uploadVideo} from '../utils/uploadFile.js';
import { createTransaction, createHybridTransaction, completeTransaction, cancelTransaction } from '../services/transactionService.js';
import { TRANSACTION_TYPES, TRANSACTION_DESCRIPTIONS, createTransactionDescription } from '../utils/transactionConstants.js';
import Transaction from '../models/Transaction.js';
import NotificationHelper from '../utils/notificationHelper.js';
const { normalizeContact } = await import('../utils/normalizeContact.js');
import { deleteConversationBetweenUsers } from '../services/messagingCleanup.js';
import { sanitizeUserData } from '../utils/userDataHelper.js';
import { moveEscrowToJackpot, refundEscrow } from '../services/starWalletService.js';
import Review from '../models/Review.js';

const sanitize = (doc) => ({
  id: doc._id,
  trackingId: doc.trackingId,
  fanId: doc.fanId && typeof doc.fanId === 'object' ? sanitizeUserData(doc.fanId) : doc.fanId,
  starId: doc.starId && typeof doc.starId === 'object' ? sanitizeUserData(doc.starId) : doc.starId,
  starBaroniId: doc.starId && doc.starId.baroniId ? doc.starId.baroniId : undefined,
  occasion: doc.occasion,
  eventName: doc.eventName,
  eventDate: doc.eventDate,
  description: doc.description,
  price: doc.price,
  status: doc.status,
  ...(doc.paymentStatus ? { paymentStatus: doc.paymentStatus } : {}),
  videoUrl: doc.videoUrl,
  transactionId: doc.transactionId,
  // Domain payment lifecycle is tracked in paymentStatus
  approvedAt: doc.approvedAt,
  rejectedAt: doc.rejectedAt,
  cancelledAt: doc.cancelledAt,
  completedAt: doc.completedAt,

  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
});

// Fan creates a dedication requests
export const createDedicationRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    let { starId, starBaroniId, baroniId, occasion, eventName, eventDate, description, price, starName } = req.body;

    // Allow passing star by Baroni ID
    if (!starId && (starBaroniId || baroniId)) {
      const starByBaroni = await (await import('../models/User.js')).default.findOne({ baroniId: starBaroniId || baroniId, role: 'star' }).select('_id');
      if (!starByBaroni) return res.status(404).json({ success: false, message: 'Star not found' });
      starId = starByBaroni._id;
    }

    // Create hybrid transaction before creating dedication request
    let txnResult;
    try {
      const { contact: payloadContact } = req.body || {};
      const normalizedPhone = normalizeContact(payloadContact || '');
      if (!normalizedPhone) {
        return res.status(400).json({ success: false, message: 'User phone number is required' });
      }
      txnResult = await createHybridTransaction({
        type: TRANSACTION_TYPES.DEDICATION_REQUEST_PAYMENT,
        payerId: req.user._id,
        receiverId: starId,
        amount: price,
        description: createTransactionDescription(TRANSACTION_TYPES.DEDICATION_REQUEST_PAYMENT, req.user.name || req.user.pseudo || '', starName || '', req.user.role || 'fan', 'star'),
        userPhone: payloadContact,
        starName: starName || '',
        metadata: {
          occasion,
          eventName,
          eventDate: new Date(eventDate),
          dedicationType: 'request',
          message: description || '',
          payerName: req.user.name || req.user.pseudo || ''
        }
      });
    } catch (transactionError) {
      return res.status(400).json({
        success: false,
        message: 'Transaction failed: ' + transactionError.message
      });
    }

    // Get the created transaction ID
    const transaction = await Transaction.findOne({
      payerId: req.user._id,
      receiverId: starId,
      type: TRANSACTION_TYPES.DEDICATION_REQUEST_PAYMENT,
      status: { $in: ['pending', 'initiated'] }
    }).sort({ createdAt: -1 });

    if (!transaction) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve transaction'
      });
    }

    const created = await DedicationRequest.create({
      trackingId: await generateUniqueTrackingId(),
      fanId: req.user._id,
      starId,
      occasion,
      eventName,
      eventDate: new Date(eventDate),
      description,
      price,
      status: 'pending',
      paymentStatus: transaction.status === 'initiated' ? 'initiated' : 'pending',
      transactionId: transaction._id
    });

    // Notify star ONLY if payment is already complete (pending status)
    // If paymentStatus is 'initiated', wait for external payment to complete before notifying
    try {
      if (created.paymentStatus === 'pending') {
        await NotificationHelper.sendDedicationNotification('DEDICATION_REQUEST_CREATED', created, { currentUserId: req.user._id });
      }
    } catch (notificationError) {
      console.error('Error sending dedication notification:', notificationError);
    }

    const responseBody = { 
      success: true, 
      message: 'Dedication request created successfully',
      data: {
        dedicationRequest: sanitize(created)
      }
    };
    if (txnResult && txnResult.paymentMode === 'hybrid' || txnResult?.externalAmount > 0) {
      if (txnResult.externalPaymentMessage) {
        responseBody.data.externalPaymentMessage = txnResult.externalPaymentMessage;
      }
    }

    return res.status(201).json(responseBody);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Unified listing of dedication requests based on user role
export const listDedicationRequests = async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};

    // Set filter based on user role
    if (req.user.role === 'fan') {
      filter.fanId = req.user._id;
    } else if (req.user.role === 'star') {
      filter.starId = req.user._id;
      // Star should only see requests where payment is complete (not 'initiated')
      filter.paymentStatus = { $ne: 'initiated' };
    } else if (req.user.role === 'admin') {
      // Admin can see all requests - no filter applied
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Add status filter if provided
    if (status && ['pending', 'approved', 'cancelled', 'rejected', 'completed'].includes(status)) {
      filter.status = status;
    }

    // Date filtering: exact date or range via startDate/endDate (for eventDate field)
    const { date, startDate, endDate } = req.query || {};
    
    if (date && typeof date === 'string' && date.trim()) {
      // Exact date match - use UTC dates to avoid timezone issues
      const dateStr = date.trim();
      const [year, month, day] = dateStr.split('-').map(v => parseInt(v, 10));
      // Create UTC dates for start and end of day
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      filter.eventDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (startDate || endDate) {
      // Date range filtering - use UTC dates to avoid timezone issues
      const range = {};
      if (startDate && typeof startDate === 'string' && startDate.trim()) {
        const [year, month, day] = startDate.trim().split('-').map(v => parseInt(v, 10));
        range.$gte = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      }
      if (endDate && typeof endDate === 'string' && endDate.trim()) {
        const [year, month, day] = endDate.trim().split('-').map(v => parseInt(v, 10));
        range.$lte = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      }
      if (Object.keys(range).length > 0) {
        filter.eventDate = range;
      }
    }

    const items = await DedicationRequest.find(filter)
      .populate('fanId', 'name pseudo profilePic agoraKey')
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
      .sort({ createdAt: -1 });

    // Get all dedication request IDs to fetch reviews
    const dedicationRequestIds = items.map(item => item._id);
    
    // Create a map of dedication request ID to review
    const reviewMap = {};
    
    // Fetch reviews only if there are items and there are completed dedication requests
    if (dedicationRequestIds.length > 0) {
      const reviews = await Review.find({
        dedicationRequestId: { $in: dedicationRequestIds },
        reviewType: 'dedication'
      }).select('dedicationRequestId rating comment createdAt');

      reviews.forEach(review => {
        reviewMap[review.dedicationRequestId.toString()] = {
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt
        };
      });
    }

    const withComputed = items.map((doc) => {
      const base = sanitize(doc);
      const eventAt = base.eventDate ? new Date(base.eventDate) : undefined;
      const timeToNowMs = eventAt ? (eventAt.getTime() - Date.now()) : undefined;
      
      // Add review information for all dedication requests
      const reviewInfo = {};
      
      if (base.status === 'completed') {
        const review = reviewMap[base.id];
        reviewInfo.is_review_completed = !!review;
        if (review) {
          reviewInfo.review_rating = review.rating;
          reviewInfo.review_comment = review.comment;
          reviewInfo.review_created_at = review.createdAt;
        } else {
          // If no review exists, set to null
          reviewInfo.review_rating = null;
          reviewInfo.review_comment = null;
          reviewInfo.review_created_at = null;
        }
      } else {
        // For non-completed statuses, set is_review_completed to false and all review fields to null
        reviewInfo.is_review_completed = false;
        reviewInfo.review_rating = null;
        reviewInfo.review_comment = null;
        reviewInfo.review_created_at = null;
      }
      
      return { 
        ...base, 
        eventAt: eventAt ? eventAt.toISOString() : undefined, 
        timeToNowMs,
        ...reviewInfo
      };
    });

    // Apply proper sorting logic: by status priority, then by date ascending
    // Status priority: (1) pending, (2) approved, (3) completed, (4) cancelled/rejected
    // Within each status group, sort by date ascending (nearest to furthest)
    
    const getStatusPriority = (status) => {
      switch (status) {
        case 'pending': return 1;
        case 'approved': return 2;
        case 'completed': return 3;
        case 'cancelled':
        case 'rejected': return 4;
        default: return 5;
      }
    };
    
    // Sort by status priority first, then by event date ascending (nearest to furthest)
    const data = withComputed.sort((a, b) => {
      // First, compare by status priority
      const statusPriorityA = getStatusPriority(a.status);
      const statusPriorityB = getStatusPriority(b.status);
      
      if (statusPriorityA !== statusPriorityB) {
        return statusPriorityA - statusPriorityB;
      }
      
      // If same status, sort by event date ascending (nearest to furthest)
      // Use eventDate if available, otherwise fallback to createdAt
      let timeA, timeB;
      
      // Get event time for dedication request A
      if (a.eventDate) {
        timeA = new Date(a.eventDate).getTime();
      } else if (a.eventAt) {
        timeA = new Date(a.eventAt).getTime();
      } else {
        // Fallback to createdAt
        timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      }
      
      // Get event time for dedication request B
      if (b.eventDate) {
        timeB = new Date(b.eventDate).getTime();
      } else if (b.eventAt) {
        timeB = new Date(b.eventAt).getTime();
      } else {
        // Fallback to createdAt
        timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      }
      
      return timeA - timeB;
    });

    return res.json({ 
      success: true, 
      message: 'Dedication requests retrieved successfully',
      data: data
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get a specific dedication request
export const getDedicationRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const item = await DedicationRequest.findById(req.params.id)
      .populate('fanId', 'name pseudo profilePic agoraKey')
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' });

    if (!item) return res.status(404).json({ success: false, message: 'Not found' });

    // Check if user has access to this request
    if (req.user.role === 'admin') {
      // Admin can access any request
    } else if (item.fanId._id.toString() !== req.user._id.toString() &&
        item.starId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    // Stars should not be able to access requests where payment is not complete
    if (req.user.role === 'star' && item.paymentStatus === 'initiated') {
      return res.status(403).json({ success: false, message: 'Request not available - payment pending' });
    }

    // Get review information for all dedication requests
    let reviewInfo = {};
    
    if (item.status === 'completed') {
      const review = await Review.findOne({
        dedicationRequestId: item._id,
        reviewType: 'dedication'
      }).select('rating comment createdAt');
      
      if (review) {
        reviewInfo.is_review_completed = true;
        reviewInfo.review_rating = review.rating;
        reviewInfo.review_comment = review.comment;
        reviewInfo.review_created_at = review.createdAt;
      } else {
        // If no review exists, set is_review_completed to false and all review fields to null
        reviewInfo.is_review_completed = false;
        reviewInfo.review_rating = null;
        reviewInfo.review_comment = null;
        reviewInfo.review_created_at = null;
      }
    } else {
      // For non-completed statuses, set is_review_completed to false and all review fields to null
      reviewInfo.is_review_completed = false;
      reviewInfo.review_rating = null;
      reviewInfo.review_comment = null;
      reviewInfo.review_created_at = null;
    }

    const sanitizedItem = sanitize(item);
    const responseData = {
      ...sanitizedItem,
      ...reviewInfo
    };

    return res.json({ 
      success: true, 
      message: 'Dedication request retrieved successfully',
      data: {
        dedicationRequest: responseData
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Star or admin approves a dedication request
export const approveDedicationRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    let filter = { _id: req.params.id, status: 'pending' };

    // If not admin, ensure user is the star
    if (req.user.role !== 'admin') {
      filter.starId = req.user._id;
    }

    const item = await DedicationRequest.findOne(filter);

    if (!item) return res.status(404).json({ success: false, message: 'Request not found or already processed' });

    // Stars cannot approve requests where payment is not complete
    if (req.user.role === 'star' && item.paymentStatus === 'initiated') {
      return res.status(403).json({ success: false, message: 'Cannot approve - payment not complete' });
    }

    item.status = 'approved';
    item.approvedAt = new Date();

    const updated = await item.save();

    // Send notification to fan about dedication request approval
    try {
      await NotificationHelper.sendDedicationNotification('DEDICATION_ACCEPTED', updated, { currentUserId: req.user._id });
    } catch (notificationError) {
      console.error('Error sending dedication approval notification:', notificationError);
    }

    return res.json({ 
      success: true, 
      message: 'Dedication request approved successfully',
      data: {
        dedicationRequest: sanitize(updated)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Star rejects a dedication request
export const rejectDedicationRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    let filter = { _id: req.params.id, status: 'pending' };

    // If not admin, ensure user is the star
    if (req.user.role !== 'admin') {
      filter.starId = req.user._id;
    }

    const item = await DedicationRequest.findOne(filter);

    if (!item) return res.status(404).json({ success: false, message: 'Request not found or already processed' });

    // Stars cannot reject requests where payment is not complete
    if (req.user.role === 'star' && item.paymentStatus === 'initiated') {
      return res.status(403).json({ success: false, message: 'Cannot reject - payment not complete' });
    }

    item.status = 'rejected';
    item.rejectedAt = new Date();

    // Refund escrow if payment was pending (before we set it to refunded)
    if (item.paymentStatus === 'pending') {
      try {
        await refundEscrow(item.starId, null, item._id);
      } catch (escrowError) {
        console.error('Failed to refund escrow for rejected dedication request:', escrowError);
      }
    }
    
    item.paymentStatus = 'refunded';

    // Cancel and refund the pending transaction, if any
    if (item.transactionId) {
      try {
        await cancelTransaction(item.transactionId);
      } catch (transactionError) {
        console.error('Failed to cancel transaction for rejected dedication request:', transactionError);
        // Proceed with rejection even if refund fails; can be reconciled later
      }
    }

    const updated = await item.save();

    // Send notification to fan about dedication request rejection
    try {
      await NotificationHelper.sendDedicationNotification('DEDICATION_REJECTED', updated, { currentUserId: req.user._id });
    } catch (notificationError) {
      console.error('Error sending dedication rejection notification:', notificationError);
    }

    return res.json({ 
      success: true, 
      message: 'Dedication request rejected successfully',
      data: {
        dedicationRequest: sanitize(updated)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Star uploads the dedication video (keeps status approved, fan will complete)
export const uploadDedicationVideo = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Video file is required' });
    }

    let filter = { _id: req.params.id, status: 'approved' };

    // If not admin, ensure user is the star
    if (req.user.role !== 'admin') {
      filter.starId = req.user._id;
    }

    const item = await DedicationRequest.findOne(filter);

    if (!item) return res.status(404).json({ success: false, message: 'Approved request not found' });

    // Upload video to storage
    item.videoUrl = await uploadVideo(req.file.buffer);
    
    // Ensure transaction is completed (coin-only transactions are pending until completion)
    if (item.transactionId) {
      try {
        await completeTransaction(item.transactionId);
        console.log(`[UploadDedicationVideo] Completed transaction ${item.transactionId} before finalizing dedication`);
      } catch (transactionError) {
        console.error('[UploadDedicationVideo] Failed to complete transaction before finalizing dedication:', transactionError);
        // Continue; reconciliation can be handled later
      }
    }

    // Move escrow to jackpot for the star after completion
    try {
      await moveEscrowToJackpot(item.starId, null, item._id);
      console.log(`[UploadDedicationVideo] Moved escrow to jackpot for star ${item.starId}`);
    } catch (walletError) {
      console.error(`[UploadDedicationVideo] Failed to move escrow to jackpot:`, walletError);
      // Continue with dedication completion even if wallet update fails
    }
    
    // Automatically mark as completed when video is uploaded
    item.status = 'completed';
    item.paymentStatus = 'completed';
    item.completedAt = new Date();
    
    const updated = await item.save();

    // Notify fan about video upload
    try {
      await NotificationHelper.sendDedicationNotification('DEDICATION_COMPLETED', updated, { currentUserId: req.user._id });
      await NotificationHelper.sendDedicationNotification('DEDICATION_VIDEO_UPLOADED', updated, { currentUserId: req.user._id });
    } catch (notificationError) {
      console.error('Error sending dedication completion notification:', notificationError);
    }

    return res.json({ 
      success: true, 
      message: 'Dedication video uploaded and marked as completed successfully',
      data: {
        dedicationRequest: sanitize(updated)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Fan confirms completion (completes transaction and marks as completed)
export const completeDedicationByFan = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    let filter = { _id: req.params.id, status: 'approved' };

    // If not admin, ensure user is the fan
    if (req.user.role !== 'admin') {
      filter.fanId = req.user._id;
    }

    const item = await DedicationRequest.findOne(filter);
    if (!item) return res.status(404).json({ success: false, message: 'Approved request not found' });

    if (!item.videoUrl) {
      return res.status(400).json({ success: false, message: 'Video not uploaded yet' });
    }

    // Complete the transaction and transfer coins to star
    if (item.transactionId) {
      try {
        await completeTransaction(item.transactionId);
      } catch (transactionError) {
        return res.status(500).json({
          success: false,
          message: 'Failed to complete transaction: ' + transactionError.message
        });
      }
    }

    item.status = 'completed';
    item.paymentStatus = 'completed';
    item.completedAt = new Date();
    const updated = await item.save();

    // Send completion notification
    try {
      await NotificationHelper.sendDedicationNotification('DEDICATION_COMPLETED', updated, { currentUserId: req.user._id });
    } catch (notificationError) {
      console.error('Error sending dedication completion notification:', notificationError);
    }

    // Cleanup messages between fan and star after completion
    try {
      await deleteConversationBetweenUsers(item.fanId, item.starId);
    } catch (_e) {}

    return res.json({ 
      success: true, 
      message: 'Dedication completed successfully',
      data: {
        dedicationRequest: sanitize(updated)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Fan cancels their own dedication request (only if pending)
export const cancelDedicationRequest = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    let filter = { _id: req.params.id, status: 'pending' };

    // If not admin, ensure user is the fan
    if (req.user.role !== 'admin') {
      filter.fanId = req.user._id;
    }

    const item = await DedicationRequest.findOne(filter);

    if (!item) return res.status(404).json({ success: false, message: 'Request not found or cannot be cancelled' });

    // Refund escrow if payment was pending
    if (item.paymentStatus === 'pending') {
      try {
        await refundEscrow(item.starId, null, item._id);
      } catch (escrowError) {
        console.error('Failed to refund escrow for cancelled dedication request:', escrowError);
      }
    }
    
    // Cancel the transaction and refund coins if it's pending
    if (item.transactionId) {
      try {
        await cancelTransaction(item.transactionId);
      } catch (transactionError) {
        console.error('Failed to cancel transaction:', transactionError);
        // Continue with cancellation even if refund fails
      }
    }

    item.status = 'cancelled';
    item.paymentStatus = 'refunded';
    item.cancelledAt = new Date();
    const updated = await item.save();

    // Notify counterpart only if payment was complete
    // If paymentStatus is 'initiated', star never saw the request, so don't notify them
    try {
      if (updated.paymentStatus !== 'initiated') {
        await NotificationHelper.sendDedicationNotification('DEDICATION_CANCELLED', updated, { currentUserId: req.user._id });
      } else {
        console.log(`[CancelDedicationRequest] Skipping notification - payment not complete (paymentStatus: ${updated.paymentStatus})`);
      }
    } catch (notificationError) {
      console.error('Error sending dedication cancellation notification:', notificationError);
    }
    return res.json({ 
      success: true, 
      message: 'Dedication request cancelled successfully',
      data: {
        dedicationRequest: sanitize(updated)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Get dedication request by tracking ID (public endpoint)
export const getDedicationRequestByTrackingId = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { trackingId } = req.params;

    const item = await DedicationRequest.findOne({ trackingId })
      .populate('fanId', 'name pseudo profilePic agoraKey')
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' });

    if (!item) return res.status(404).json({ success: false, message: 'Request not found' });

    return res.json({ 
      success: true, 
      message: 'Dedication request retrieved successfully',
      data: {
        dedicationRequest: sanitize(item)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
