import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import Availability from '../models/Availability.js';
import Appointment from '../models/Appointment.js';
import { createTransaction, createHybridTransaction, completeTransaction, cancelTransaction } from '../services/transactionService.js';
import { TRANSACTION_TYPES, TRANSACTION_DESCRIPTIONS, createTransactionDescription, TRANSACTION_STATUSES } from '../utils/transactionConstants.js';
import Transaction from '../models/Transaction.js'; // Added missing import for Transaction
import NotificationHelper from '../utils/notificationHelper.js';
import { deleteConversationBetweenUsers } from '../services/messagingCleanup.js';
import { sanitizeUserData } from '../utils/userDataHelper.js';
import { moveEscrowToJackpot, refundEscrow } from '../services/starWalletService.js';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import { convertLocalToUTC } from '../utils/timezoneHelper.js';

const toUser = (u) => u ? sanitizeUserData(u) : null;

const toAvailability = (a) => (
  a && a._id ? {
    id: a._id,
    date: a.date,
    timeSlots: Array.isArray(a.timeSlots) ? a.timeSlots.map((t) => ({ id: t._id, slot: t.slot, status: t.status })) : [],
  } : a
);

const sanitize = (doc) => {
  // Calculate duration in seconds - use callDuration if available, otherwise 0
  const durationInSeconds = typeof doc.callDuration === 'number' ? doc.callDuration : 0;
  
  return {
    id: doc._id,
    star: toUser(doc.starId),
    fan: toUser(doc.fanId),
    availability: toAvailability(doc.availabilityId),
    timeSlotId: doc.timeSlotId,
    date: doc.date,
    time: doc.time,
    utcStartTime: doc.utcStartTime,
    price: doc.price,
    // Map in_progress to approved for outward responses as requested
    status: doc.status === 'in_progress' ? 'approved' : doc.status,
    ...(doc.paymentStatus ? { paymentStatus: doc.paymentStatus } : {}),
    transactionId: doc.transactionId,
    // Keep transaction status light; paymentStatus covers domain payment lifecycle
    completedAt: doc.completedAt,
    // Both callDuration and duration should be in seconds with same value
    callDuration: durationInSeconds, // Duration in seconds
    duration: durationInSeconds, // Duration in seconds (same as callDuration)
    // Always include isRescheduled flag (defaults to false if not set)
    isRescheduled: doc.isRescheduled === true,
    ...(doc.parentAppointment ? { parentAppointment: doc.parentAppointment } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

// Get single appointment details
export const getAppointmentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID is required'
      });
    }

    // Find appointment - fans can only see their own, stars can see their own, admins can see all
    let filter = { _id: id };
    if (userRole === 'fan') {
      filter.fanId = userId;
    } else if (userRole === 'star') {
      filter.starId = userId;
    }
    // Admin can see all appointments (no additional filter)

    const appointment = await Appointment.findOne(filter)
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
      .populate('fanId', 'name pseudo profilePic baroniId email contact role agoraKey')
      .populate('availabilityId', 'date timeSlots')
      .populate('transactionId', 'amount status type')
      .lean();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Stars should not be able to access appointments where payment is not complete
    if (req.user.role === 'star' && appointment.paymentStatus === 'initiated') {
      return res.status(403).json({ 
        success: false, 
        message: 'Appointment not available - payment pending' 
      });
    }

    // Add computed fields similar to listAppointments
    const parseStartDate = (dateStr, timeStr) => {
      const [year, month, day] = (dateStr || '').split('-').map((v) => parseInt(v, 10));
      let hours = 0;
      let minutes = 0;
      if (typeof timeStr === 'string') {
        const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (m) {
          hours = parseInt(m[1], 10);
          minutes = parseInt(m[2], 10);
          const ampm = m[3].toUpperCase();
          if (ampm === 'PM' && hours !== 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
        }
      }
      const d = new Date(year || 0, (month || 1) - 1, day || 1, hours, minutes, 0, 0);
      return d;
    };

    let timeSlotObj = undefined;
    if (appointment.availabilityId && appointment.availabilityId.timeSlots) {
      const found = appointment.availabilityId.timeSlots.find((s) => String(s._id) === String(appointment.timeSlotId));
      if (found) timeSlotObj = { id: found._id, slot: found.slot, status: found.status };
    }

    const startAt = parseStartDate(appointment.date, appointment.time);
    const timeToNowMs = startAt.getTime() - Date.now();

    const appointmentData = {
      ...sanitize(appointment),
      timeSlot: timeSlotObj,
      startAt: isNaN(startAt.getTime()) ? undefined : startAt.toISOString(),
      timeToNowMs
    };

    return res.status(200).json({
      success: true,
      message: 'Appointment details retrieved successfully',
      data: {
        appointment: appointmentData
      }
    });

  } catch (error) {
    console.error('Error fetching appointment details:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching appointment details',
      error: error.message
    });
  }
};

export const createAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    let { starId, starBaroniId, baroniId, availabilityId, timeSlotId, price, starName } = req.body;

    // Allow passing star by Baroni ID
    if (!starId && (starBaroniId || baroniId)) {
      const starByBaroni = await (await import('../models/User.js')).default.findOne({ baroniId: starBaroniId || baroniId, role: 'star' }).select('_id');
      if (!starByBaroni) return res.status(404).json({ success: false, message: 'Star not found' });
      starId = starByBaroni._id;
    }

    const availability = await Availability.findOne({ _id: availabilityId, userId: starId });
    if (!availability) return res.status(404).json({ success: false, message: 'Availability not found' });

    // Validate that the appointment date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(availability.date);

    if (appointmentDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book appointments for past dates'
      });
    }

    // If the appointment is for today, validate that the time slot is not in the past
    const isToday = appointmentDate.getTime() === today.getTime();
    if (isToday) {
      const slot = availability.timeSlots.find((s) => String(s._id) === String(timeSlotId));
      if (slot) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();

        const timeMatch = slot.slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeMatch) {
          let hour = parseInt(timeMatch[1], 10);
          const minute = parseInt(timeMatch[2], 10);
          const ampm = timeMatch[3].toUpperCase();

          if (ampm === 'PM' && hour !== 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;

          const slotTime = hour * 60 + minute;
          if (slotTime <= currentTime) {
            return res.status(400).json({
              success: false,
              message: `Cannot book appointments for past time slots. Time slot "${slot.slot}" is in the past.`
            });
          }
        }
      }
    }

    const slot = availability.timeSlots.find((s) => String(s._id) === String(timeSlotId));
    if (!slot) return res.status(404).json({ success: false, message: 'Time slot unavailable' });
    // Check if slot is unavailable (booked) or locked (payment link sent, waiting for payment)
    if (slot.status === 'unavailable' || slot.status === 'locked') {
      return res.status(409).json({ 
        success: false, 
        message: slot.status === 'locked' 
          ? 'Time slot is temporarily locked. Please wait for the previous booking to complete or timeout.' 
          : 'Time slot unavailable' 
      });
    }

    // Create hybrid transaction before creating appointment
    let transactionResult;
    try {
      const { contact: payloadContact } = req.body || {};
      const { normalizeContact } = await import('../utils/normalizeContact.js');
      const normalizedPhone = normalizeContact(payloadContact || '');
      if (!normalizedPhone) {
        return res.status(400).json({ success: false, message: 'User phone number is required' });
      }
      transactionResult = await createHybridTransaction({
        type: TRANSACTION_TYPES.APPOINTMENT_PAYMENT,
        payerId: req.user._id,
        receiverId: starId,
        amount: price,
        description: createTransactionDescription(TRANSACTION_TYPES.APPOINTMENT_PAYMENT, req.user.name || req.user.pseudo || '', starName || '', req.user.role || 'fan', 'star'),
        userPhone: normalizedPhone,
        starName: starName || '',
        metadata: {
          appointmentType: 'booking',
          availabilityId,
          timeSlotId,
          date: availability.date,
          time: slot.slot,
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
      type: TRANSACTION_TYPES.APPOINTMENT_PAYMENT,
      status: { $in: ['pending', 'initiated'] }
    }).sort({ createdAt: -1 });

    if (!transaction) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve transaction'
      });
    }

    // Get fan's country for timezone conversion
    const fan = await (await import('../models/User.js')).default.findById(req.user._id).select('country');
    const fanCountry = fan?.country || null;

    // Convert local time to UTC based on fan's country
    const utcStartTime = convertLocalToUTC(availability.date, slot.slot, fanCountry);

    // Log UTC time for debugging
    console.log(`[CreateAppointment] Appointment UTC conversion:`, {
      date: availability.date,
      time: slot.slot,
      country: fanCountry || 'unknown',
      utcStartTime: utcStartTime.toISOString(),
      utcTimestamp: utcStartTime.getTime()
    });

    const created = await Appointment.create({
      starId,
      fanId: req.user._id,
      availabilityId,
      timeSlotId,
      date: availability.date,
      time: slot.slot,
      utcStartTime,
      price,
      status: 'pending',
      paymentStatus: transaction.status === 'initiated' ? 'initiated' : 'pending',
      transactionId: transaction._id,
    });

    // Verify UTC time was stored correctly
    console.log(`[CreateAppointment] Appointment created with UTC time:`, {
      appointmentId: created._id,
      storedUtcStartTime: created.utcStartTime?.toISOString(),
      storedUtcTimestamp: created.utcStartTime?.getTime()
    });

    // Handle slot reservation based on payment mode
    try {
      if (transactionResult.paymentMode === 'coin') {
        // For coin-only payments, mark slot as unavailable (booked) immediately
        const coinUpdateResult = await Availability.updateOne(
          { _id: availabilityId, userId: starId, 'timeSlots._id': timeSlotId, 'timeSlots.status': 'available' },
          { $set: { 'timeSlots.$.status': 'unavailable' } }
        );
        if (coinUpdateResult.matchedCount === 0) {
          console.warn(`[CreateAppointment] ⚠ Slot not found or already booked for coin-only payment - appointment ${created._id}`);
        } else {
          console.log(`[CreateAppointment] ✓ Slot marked as unavailable for coin-only payment - appointment ${created._id}, updateResult:`, coinUpdateResult);
        }
      } else if (transactionResult.paymentMode === 'hybrid' && transaction.externalPaymentId) {
        // For hybrid payments with external payment link, lock the slot for 10 minutes
        // Slot will be unlocked if payment not completed within 10 minutes, or marked unavailable if payment completes
        const lockUpdateResult = await Availability.updateOne(
          { _id: availabilityId, userId: starId, 'timeSlots._id': timeSlotId, 'timeSlots.status': 'available' },
          { 
            $set: { 
              'timeSlots.$.status': 'locked',
              'timeSlots.$.paymentReferenceId': transaction.externalPaymentId,
              'timeSlots.$.lockedAt': new Date()
            } 
          }
        );
        if (lockUpdateResult.matchedCount === 0) {
          console.warn(`[CreateAppointment] ⚠ Slot not found or already booked/locked for hybrid payment - appointment ${created._id}`);
        } else {
          console.log(`[CreateAppointment] ✓ Slot locked for external payment (10 min timeout) - appointment ${created._id}, payment ${transaction.externalPaymentId}, updateResult:`, lockUpdateResult);
        }
      } else {
        console.warn(`[CreateAppointment] ⚠ No slot status update - paymentMode: ${transactionResult.paymentMode}, externalPaymentId: ${transaction.externalPaymentId || 'none'}`);
      }
    } catch (slotError) {
      console.error('[CreateAppointment] ✗ Error updating slot status:', slotError);
      // Don't fail the appointment creation if slot update fails, but log the error
    }

    // Handle coin-only payments immediately
    if (transactionResult.paymentMode === 'coin') {
      try {
        // Complete the transaction immediately for coin-only payments
        // NOTE: completeTransaction does NOT send notification (removed to avoid duplicates)
        await completeTransaction(transaction._id);
        
        // Send notification to star for coin-only payments (only once, here)
        console.log(`[AppointmentCreated] Sending notification for coin-only payment - appointment ${created._id}`);
        await NotificationHelper.sendAppointmentNotification('APPOINTMENT_CREATED', created, { currentUserId: req.user._id });
        
        console.log(`[AppointmentCreated] ✓ Coin-only payment completed, notification sent for appointment ${created._id}`);
      } catch (error) {
        console.error('[AppointmentCreated] ✗ Error handling coin-only payment:', error);
      }
    }
    // For hybrid payments, notification will be sent after payment completion in paymentCallbackService
    // (only for hybrid payments, not coin-only, to avoid duplicates)

    const responseBody = { 
      success: true, 
      message: 'Appointment created successfully',
      data: {
        appointment: sanitize(created)
      }
    };
    if (transactionResult && transactionResult.paymentMode === 'hybrid' || transactionResult?.externalAmount > 0) {
      if (transactionResult.externalPaymentMessage) {
        responseBody.data.externalPaymentMessage = transactionResult.externalPaymentMessage;
      }
    }
    return res.status(201).json(responseBody);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const listAppointments = async (req, res) => {
  try {
    // Log raw request details for debugging
    console.log(`[ListAppointments] ===== REQUEST RECEIVED =====`);
    console.log(`[ListAppointments] Raw req.query:`, JSON.stringify(req.query, null, 2));
    console.log(`[ListAppointments] req.query type:`, typeof req.query);
    console.log(`[ListAppointments] req.query.limit:`, req.query?.limit, `(type: ${typeof req.query?.limit})`);
    console.log(`[ListAppointments] req.query.page:`, req.query?.page, `(type: ${typeof req.query?.page})`);
    console.log(`[ListAppointments] Full req.url:`, req.url);
    console.log(`[ListAppointments] Full req.originalUrl:`, req.originalUrl);
    
    // Admin can see all appointments - no filter by user ID
    // Stars see only their own appointments, Fans see only their own appointments
    let filter = {};
    
    if (req.user.role === 'admin') {
      // Admin sees all appointments - no filter needed
      filter = {};
    } else if (req.user.role === 'star') {
      // Stars see only their own appointments
      filter = { starId: req.user._id };
      // Stars should only see appointments where payment is complete (not 'initiated')
      filter.paymentStatus = { $ne: 'initiated' };
    } else {
      // Fans see only their own appointments
      filter = { fanId: req.user._id };
    }
    
    // Optional date filtering: exact date or range via startDate/endDate (expects YYYY-MM-DD strings)
    const { date, startDate, endDate, status, page, limit } = req.query || {};
    
    console.log(`[ListAppointments] After destructuring - page:`, page, `limit:`, limit);
    console.log(`[ListAppointments] Date filter params - date:`, date, `startDate:`, startDate, `endDate:`, endDate);
    
    // Apply date filter - this should properly exclude appointments from dates before the filter
    if (date && typeof date === 'string' && date.trim()) {
      // Exact date match - ensure proper format (YYYY-MM-DD)
      const trimmedDate = date.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
        filter.date = trimmedDate;
        console.log(`[ListAppointments] Applied exact date filter:`, trimmedDate);
      }
    } else if (startDate || endDate) {
      // Normalize date strings (remove whitespace)
      const normalizedStartDate = startDate && typeof startDate === 'string' ? startDate.trim() : '';
      const normalizedEndDate = endDate && typeof endDate === 'string' ? endDate.trim() : '';
      
      // Validate date format (YYYY-MM-DD)
      const isValidDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
      
      // Date range filtering - if both are same, it's an exact match
      if (normalizedStartDate && normalizedEndDate && normalizedStartDate === normalizedEndDate && isValidDate(normalizedStartDate)) {
        // Exact date match when both are same
        filter.date = normalizedStartDate;
        console.log(`[ListAppointments] Applied exact date filter (from range):`, normalizedStartDate);
      } else {
        // Range filtering - ensure both dates are valid strings
        const range = {};
        if (normalizedStartDate && isValidDate(normalizedStartDate)) {
          range.$gte = normalizedStartDate;
          console.log(`[ListAppointments] Applied startDate filter:`, normalizedStartDate);
        }
        if (normalizedEndDate && isValidDate(normalizedEndDate)) {
          range.$lte = normalizedEndDate;
          console.log(`[ListAppointments] Applied endDate filter:`, normalizedEndDate);
        }
        // Only apply range filter if at least one date is provided and valid
        if (Object.keys(range).length > 0) {
          filter.date = range;
          console.log(`[ListAppointments] Applied date range filter:`, range);
        }
      }
    }
    
    // Status filtering
    if (status && typeof status === 'string' && status.trim()) {
      const validStatuses = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];
      if (validStatuses.includes(status.trim())) {
        filter.status = status.trim();
        console.log(`[ListAppointments] Applied status filter:`, status.trim());
      }
    }
    
    // Log the final filter being applied
    console.log(`[ListAppointments] ===== FINAL FILTER =====`);
    console.log(`[ListAppointments] Filter object:`, JSON.stringify(filter, null, 2));
    console.log(`[ListAppointments] =========================`);
    
    // Include all appointments regardless of completion status
    // Sorting will handle the order: pending -> approved -> completed -> cancelled/rejected
    // Within each status, sorted by date ascending (nearest to furthest)
    console.log(`[ListAppointments] Including all appointments - sorting will handle order by status priority and date`);
    
    // Pagination - fetch all first for proper global sorting, then paginate
    // Parse page and limit from query parameters
    console.log(`[ListAppointments] Before parsing - page:`, page, `(type: ${typeof page}), limit:`, limit, `(type: ${typeof limit})`);
    
    const pageNum = page ? parseInt(String(page), 10) : 1;
    const limitNum = limit ? parseInt(String(limit), 10) : 10;
    
    console.log(`[ListAppointments] After parseInt - pageNum:`, pageNum, `limitNum:`, limitNum);
    console.log(`[ListAppointments] isNaN checks - pageNum isNaN:`, isNaN(pageNum), `limitNum isNaN:`, isNaN(limitNum));
    
    // Ensure valid values
    const finalPageNum = isNaN(pageNum) || pageNum < 1 ? 1 : pageNum;
    const finalLimitNum = isNaN(limitNum) || limitNum < 1 ? 10 : limitNum;
    
    console.log(`[ListAppointments] ===== PAGINATION PARAMS =====`);
    console.log(`[ListAppointments] Raw from query - page:`, page, `limit:`, limit);
    console.log(`[ListAppointments] Parsed values - pageNum:`, pageNum, `limitNum:`, limitNum);
    console.log(`[ListAppointments] Final values - finalPageNum:`, finalPageNum, `finalLimitNum:`, finalLimitNum);
    console.log(`[ListAppointments] ============================`);
    
    // Get total count for pagination info
    const totalCount = await Appointment.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / finalLimitNum);
    
    // Fetch all appointments (without pagination) to ensure proper global sorting
    // Then we'll sort and paginate in memory
    const allItems = await Appointment.find(filter)
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
      .populate('fanId', 'name pseudo profilePic baroniId email contact role agoraKey')
      .populate('availabilityId');

    const parseStartDate = (dateStr, timeStr) => {
      try {
        if (!dateStr || typeof dateStr !== 'string') {
          return new Date(0); // Invalid date
        }
        
        const [year, month, day] = dateStr.split('-').map((v) => parseInt(v, 10));
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
          return new Date(0); // Invalid date
        }
        
        let hours = 0;
        let minutes = 0;
        
        if (typeof timeStr === 'string') {
          // Handle time ranges like "09:30 - 09:50" by taking first part
          const timePart = timeStr.split('-')[0].trim();
          const m = timePart.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
          if (m) {
            hours = parseInt(m[1], 10);
            minutes = parseInt(m[2], 10);
            const ampm = (m[3] || '').toUpperCase();
            if (ampm === 'PM' && hours !== 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
          }
        }
        
        const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
        return isNaN(d.getTime()) ? new Date(0) : d;
      } catch (error) {
        console.error(`[ListAppointments] Error parsing date/time: date=${dateStr}, time=${timeStr}`, error);
        return new Date(0); // Return invalid date on error
      }
    };

    // Pre-fetch all conversations between fan-star pairs for better performance
    // Get unique fan-star pairs from appointments
    const userPairs = new Set();
    allItems.forEach(doc => {
      if (doc.fanId?._id && doc.starId?._id) {
        const fanId = String(doc.fanId._id);
        const starId = String(doc.starId._id);
        const pairKey = [fanId, starId].sort().join(',');
        userPairs.add(pairKey);
      }
    });
    
    // Fetch conversations for all pairs using $all operator
    const conversationPromises = Array.from(userPairs).map(pairKey => {
      const [id1, id2] = pairKey.split(',');
      return Conversation.findOne({
        participants: { $all: [id1, id2] }
      }).lean();
    });
    
    const conversations = await Promise.all(conversationPromises);
    
    // Create a map for quick lookup: sorted participants array -> conversationId
    const conversationMap = new Map();
    conversations.forEach(conv => {
      if (conv) {
        const sortedParticipants = [...conv.participants].sort();
        conversationMap.set(sortedParticipants.join(','), conv._id.toString());
      }
    });

    const withComputed = allItems.map((doc) => {
      const base = sanitize(doc);
      let timeSlotObj = undefined;
      if (doc.availabilityId && doc.availabilityId.timeSlots) {
        const found = doc.availabilityId.timeSlots.find((s) => String(s._id) === String(doc.timeSlotId));
        if (found) timeSlotObj = { id: found._id, slot: found.slot, status: found.status };
      }
      
      // Use UTC start time if available (preferred), otherwise fallback to parsing date/time
      let startAt;
      if (doc.utcStartTime) {
        startAt = new Date(doc.utcStartTime);
      } else {
        // Fallback: parse from date and time (for backward compatibility)
        startAt = parseStartDate(base.date, base.time);
      }
      
      const timeToNowMs = isNaN(startAt.getTime()) ? 0 : startAt.getTime() - Date.now();
      
      // Find conversation between fan and star
      let conversationId = null;
      if (doc.fanId?._id && doc.starId?._id) {
        const participants = [String(doc.fanId._id), String(doc.starId._id)].sort();
        const key = participants.join(',');
        conversationId = conversationMap.get(key) || null;
      }
      
      return { ...base, timeSlot: timeSlotObj, startAt: isNaN(startAt.getTime()) ? undefined : startAt.toISOString(), timeToNowMs, conversationId };
    });

    // Apply proper sorting logic: by status priority, then by date ascending
    // Status priority: (1) pending, (2) approved, (3) completed, (4) cancelled/rejected
    // Within each status group, sort by date ascending (nearest to furthest)
    
    const getStatusPriority = (status) => {
      switch (status) {
        case 'pending': return 1;
        case 'approved': 
        case 'in_progress': return 2;
        case 'completed': return 3;
        case 'cancelled':
        case 'rejected': return 4;
        default: return 5;
      }
    };
    
    // Sort by status priority first, then by date ascending (nearest to furthest)
    // Status priority: (1) pending, (2) approved, (3) completed, (4) cancelled/rejected
    // Within each status group, sort by appointment date/time ascending (nearest to furthest)
    const data = withComputed.sort((a, b) => {
      // First, compare by status priority
      const statusPriorityA = getStatusPriority(a.status);
      const statusPriorityB = getStatusPriority(b.status);
      
      if (statusPriorityA !== statusPriorityB) {
        return statusPriorityA - statusPriorityB;
      }
      
      // If same status, sort by appointment date/time ascending (nearest to furthest)
      // Use startAt if available (already computed), otherwise use utcStartTime or parse from date/time
      let timeA, timeB;
      
      // Get appointment time for A - handle all edge cases
      if (a.startAt && typeof a.startAt === 'string') {
        // Use computed startAt (preferred - already in ISO format)
        const parsed = new Date(a.startAt);
        timeA = isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      } else if (a.utcStartTime) {
        // Fallback to utcStartTime (can be Date object or string)
        const parsed = new Date(a.utcStartTime);
        timeA = isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      } else if (a.date && a.time) {
        // Fallback: parse from date and time (for backward compatibility)
        const parsedA = parseStartDate(a.date, a.time);
        timeA = isNaN(parsedA.getTime()) ? 0 : parsedA.getTime();
      } else {
        // No valid date/time - put at end (use very large number)
        timeA = Number.MAX_SAFE_INTEGER;
      }
      
      // Get appointment time for B - handle all edge cases
      if (b.startAt && typeof b.startAt === 'string') {
        // Use computed startAt (preferred - already in ISO format)
        const parsed = new Date(b.startAt);
        timeB = isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      } else if (b.utcStartTime) {
        // Fallback to utcStartTime (can be Date object or string)
        const parsed = new Date(b.utcStartTime);
        timeB = isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      } else if (b.date && b.time) {
        // Fallback: parse from date and time (for backward compatibility)
        const parsedB = parseStartDate(b.date, b.time);
        timeB = isNaN(parsedB.getTime()) ? 0 : parsedB.getTime();
      } else {
        // No valid date/time - put at end (use very large number)
        timeB = Number.MAX_SAFE_INTEGER;
      }
      
      // Sort ascending: nearest date first (smaller time value = earlier date = comes first)
      // If times are equal, maintain stable sort by using _id as tiebreaker
      if (timeA === timeB) {
        // Stable sort: use _id to maintain consistent order for same-time appointments
        const idA = a._id ? String(a._id) : '';
        const idB = b._id ? String(b._id) : '';
        return idA.localeCompare(idB);
      }
      
      return timeA - timeB;
    });
    
    // Apply pagination after sorting
    const skip = (finalPageNum - 1) * finalLimitNum;
    const paginatedData = data.slice(skip, skip + finalLimitNum);

    // Log sorting verification (first few items to verify order)
    if (data.length > 0) {
      console.log(`[ListAppointments] ===== SORTING VERIFICATION =====`);
      console.log(`[ListAppointments] Total appointments: ${data.length}`);
      console.log(`[ListAppointments] First 10 items (sorted order):`);
      data.slice(0, 10).forEach((item, idx) => {
        const statusPriority = getStatusPriority(item.status);
        let timeValue = 'N/A';
        if (item.startAt) {
          timeValue = new Date(item.startAt).toISOString();
        } else if (item.utcStartTime) {
          timeValue = new Date(item.utcStartTime).toISOString();
        } else if (item.date && item.time) {
          const parsed = parseStartDate(item.date, item.time);
          timeValue = isNaN(parsed.getTime()) ? 'Invalid' : parsed.toISOString();
        }
        console.log(`  [${idx + 1}] Status: ${item.status} (priority: ${statusPriority}), Date: ${item.date}, Time: ${item.time}, StartAt: ${timeValue}`);
      });
      
      // Log status distribution
      const statusCounts = {};
      data.forEach(item => {
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      });
      console.log(`[ListAppointments] Status distribution:`, statusCounts);
      console.log(`[ListAppointments] ================================`);
    }

    console.log(`[ListAppointments] Pagination result:`, {
      totalCount,
      totalPages,
      skip,
      requestedLimit: finalLimitNum,
      returnedItems: paginatedData.length
    });

    const responsePayload = { 
      success: true, 
      message: 'Appointments retrieved successfully',
      data: paginatedData,
      pagination: {
        currentPage: finalPageNum,
        totalPages,
        totalCount,
        limit: finalLimitNum,
        hasNextPage: finalPageNum < totalPages,
        hasPrevPage: finalPageNum > 1
      }
    };
    
    console.log(`[ListAppointments] ===== RESPONSE PAYLOAD =====`);
    console.log(`[ListAppointments] Response pagination.limit:`, responsePayload.pagination.limit);
    console.log(`[ListAppointments] Response pagination:`, JSON.stringify(responsePayload.pagination, null, 2));
    console.log(`[ListAppointments] ============================`);

    return res.json(responsePayload);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const approveAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    const { id } = req.params;
    const appt = await Appointment.findOne({ _id: id, starId: req.user._id });
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appt.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending can be approved' });
    
    // Stars cannot approve appointments where payment is not complete
    if (appt.paymentStatus === 'initiated') {
      return res.status(403).json({ success: false, message: 'Cannot approve - payment not complete' });
    }

    appt.status = 'approved';
    const updated = await appt.save();

    // Mark the slot as unavailable when appointment is approved
    // This ensures the slot is blocked and won't show up for other fans
    try {
      const updateResult = await Availability.updateOne(
        { 
          _id: appt.availabilityId, 
          userId: appt.starId, 
          'timeSlots._id': appt.timeSlotId 
        },
        { 
          $set: { 
            'timeSlots.$.status': 'unavailable'
          } 
        }
      );
      console.log(`[ApproveAppointment] Slot marked as unavailable for appointment ${appt._id}, updateResult:`, updateResult);
    } catch (slotError) {
      console.error(`[ApproveAppointment] Error updating slot status for appointment ${appt._id}:`, slotError);
      // Continue even if slot update fails - appointment is already approved
    }

    // Send notification to fan about appointment approval
    try {
      await NotificationHelper.sendAppointmentNotification('APPOINTMENT_ACCEPTED', updated, { currentUserId: req.user._id });
    } catch (notificationError) {
      console.error('Error sending appointment approval notification:', notificationError);
    }

    // Populate the appointment with related data before returning
    const populatedAppointment = await Appointment.findById(updated._id)
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
      .populate('fanId', 'name pseudo profilePic baroniId email contact role agoraKey')
      .populate('availabilityId', 'date timeSlots');

    return res.json({ 
      success: true, 
      message: 'Appointment approved successfully',
      data: {
        appointment: sanitize(populatedAppointment)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const rejectAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    const { id } = req.params;
    const appt = await Appointment.findOne({ _id: id, starId: req.user._id });
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appt.status !== 'pending') return res.status(400).json({ success: false, message: 'Only pending can be rejected' });
    
    // Stars cannot reject appointments where payment is not complete
    if (appt.paymentStatus === 'initiated') {
      return res.status(403).json({ success: false, message: 'Cannot reject - payment not complete' });
    }
    appt.status = 'rejected';
    
    // Refund escrow if payment was pending (before we set it to refunded)
    if (appt.paymentStatus === 'pending') {
      try {
        await refundEscrow(appt.starId, appt._id, null);
      } catch (escrowError) {
        console.error('Failed to refund escrow for rejected appointment:', escrowError);
      }
    }
    
    appt.paymentStatus = 'refunded';
    
    // Cancel or refund the transaction, if any - check status first
    if (appt.transactionId) {
      try {
        const transaction = await Transaction.findById(appt.transactionId);
        if (transaction) {
          if (transaction.status === 'pending') {
            // Cancel pending transaction
            await cancelTransaction(appt.transactionId);
            console.log(`[RejectAppointment] Successfully cancelled pending transaction ${appt.transactionId}`);
          } else if (transaction.status === 'completed') {
            // Refund completed transaction
            const { refundTransaction } = await import('../services/transactionService.js');
            await refundTransaction(appt.transactionId);
            console.log(`[RejectAppointment] Successfully refunded completed transaction ${appt.transactionId}`);
          } else if (transaction.status === 'cancelled' || transaction.status === 'refunded') {
            // Already cancelled/refunded, nothing to do
            console.log(`[RejectAppointment] Transaction ${appt.transactionId} is already ${transaction.status}, skipping`);
          } else {
            console.log(`[RejectAppointment] Transaction ${appt.transactionId} has status ${transaction.status}, cannot cancel/refund`);
          }
        }
      } catch (transactionError) {
        console.error('Failed to cancel/refund transaction for rejected appointment:', transactionError);
        // Proceed with rejection even if refund fails
      }
    }
    const updated = await appt.save();

    // Free the reserved slot when appointment is rejected
    // This makes the slot available again for other fans to book
    try {
      const updateResult = await Availability.updateOne(
        { 
          _id: appt.availabilityId, 
          userId: appt.starId, 
          'timeSlots._id': appt.timeSlotId 
        },
        { 
          $set: { 
            'timeSlots.$.status': 'available',
            'timeSlots.$.paymentReferenceId': null,
            'timeSlots.$.lockedAt': null
          } 
        }
      );
      console.log(`[RejectAppointment] Slot freed for appointment ${appt._id}, updateResult:`, updateResult);
    } catch (slotError) {
      console.error(`[RejectAppointment] Error freeing slot for appointment ${appt._id}:`, slotError);
      // Continue even if slot update fails - appointment is already rejected
    }

    // Send notification to fan about appointment rejection
    try {
      await NotificationHelper.sendAppointmentNotification('APPOINTMENT_REJECTED', updated, { currentUserId: req.user._id });
    } catch (notificationError) {
      console.error('Error sending appointment rejection notification:', notificationError);
    }

    // Populate the appointment with related data before returning
    const populatedAppointment = await Appointment.findById(updated._id)
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
      .populate('fanId', 'name pseudo profilePic baroniId email contact role agoraKey')
      .populate('availabilityId', 'date timeSlots');

    return res.json({ 
      success: true, 
      message: 'Appointment rejected successfully',
      data: {
        appointment: sanitize(populatedAppointment)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    const { id } = req.params;
    const filter = { _id: id };
    if (req.user.role !== 'admin') filter.fanId = req.user._id;
    const appt = await Appointment.findOne(filter);
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appt.status === 'cancelled') return res.status(400).json({ success: false, message: 'Already cancelled' });

    // Refund escrow if payment was pending
    if (appt.paymentStatus === 'pending') {
      try {
        await refundEscrow(appt.starId, appt._id, null);
      } catch (escrowError) {
        console.error('Failed to refund escrow for cancelled appointment:', escrowError);
      }
    }
    
    // Cancel the transaction and refund coins if it's pending
    if (appt.transactionId && appt.status === 'pending') {
      try {
        await cancelTransaction(appt.transactionId);
      } catch (transactionError) {
        console.error('Failed to cancel transaction:', transactionError);
        // Continue with appointment cancellation even if transaction cancellation fails
      }
    }

    // Free the reserved slot (for approved or pending hybrid-reserved)
    try {
      await Availability.updateOne(
        { _id: appt.availabilityId, userId: appt.starId, 'timeSlots._id': appt.timeSlotId },
        { $set: { 'timeSlots.$.status': 'available' } }
      );
    } catch (_e) {}

    appt.status = 'cancelled';
    appt.paymentStatus = 'refunded';
    const updated = await appt.save();

    // Notify counterpart only if payment was complete
    // If paymentStatus is 'initiated', star never saw the appointment, so don't notify them
    try {
      if (updated.paymentStatus !== 'initiated') {
        await NotificationHelper.sendAppointmentNotification('APPOINTMENT_CANCELLED', updated, { currentUserId: req.user._id });
      } else {
        console.log(`[CancelAppointment] Skipping notification - payment not complete (paymentStatus: ${updated.paymentStatus})`);
      }
    } catch (notificationError) {
      console.error('Error sending appointment cancellation notification:', notificationError);
    }
    return res.json({ 
      success: true, 
      message: 'Appointment cancelled successfully',
      data: {
        appointment: sanitize(updated)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const rescheduleAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    const { id } = req.params;
    const { availabilityId, timeSlotId } = req.body;

    const filter = { _id: id };
    if (req.user.role !== 'admin') filter.fanId = req.user._id;
    const existingAppointment = await Appointment.findOne(filter)
      .populate('starId', 'name pseudo baroniId')
      .populate('fanId', 'name pseudo baroniId');
    
    if (!existingAppointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    
    console.log(`[RescheduleAppointment] Found appointment ${id} with status: ${existingAppointment.status}`);
    
    // Allow rescheduling regardless of current status - no conditions checked

    // Verify new availability belongs to the same star and slot is available
    const newAvailability = await Availability.findOne({ _id: availabilityId, userId: existingAppointment.starId._id });
    if (!newAvailability) return res.status(404).json({ success: false, message: 'Availability not found for this star' });

    // Find the specific time slot
    const newTimeSlot = newAvailability.timeSlots.find(slot => slot._id.toString() === timeSlotId.toString());
    if (!newTimeSlot) return res.status(404).json({ success: false, message: 'Time slot not found' });
    if (newTimeSlot.status !== 'available') return res.status(409).json({ success: false, message: 'Time slot unavailable' });

    // All appointments can be rescheduled - no date/time validation

    // Get fan's country for timezone conversion
    const fan = await (await import('../models/User.js')).default.findById(existingAppointment.fanId._id).select('country');
    const fanCountry = fan?.country || null;

    // Convert local time to UTC based on fan's country
    const utcStartTime = convertLocalToUTC(newAvailability.date, newTimeSlot.slot, fanCountry);

    // Start transaction to ensure data consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update the old appointment status to rescheduled
      await Appointment.findByIdAndUpdate(
        id,
        { status: 'rescheduled' },
        { session }
      );

      // Create new appointment with reschedule flags
      const newAppointment = await Appointment.create([{
        starId: existingAppointment.starId._id,
        fanId: existingAppointment.fanId._id,
        availabilityId: newAvailability._id,
        timeSlotId: timeSlotId,
        date: newAvailability.date,
        time: newTimeSlot.slot,
        utcStartTime,
        price: existingAppointment.price, // Use same price as original
        status: 'pending',
        paymentStatus: 'completed', // No payment needed for reschedule
        transactionId: existingAppointment.transactionId, // Use same transaction
        isRescheduled: true,
        parentAppointment: id
      }], { session });

      // Reserve the new slot
      await Availability.updateOne(
        { _id: availabilityId, userId: existingAppointment.starId._id, 'timeSlots._id': timeSlotId },
        { $set: { 'timeSlots.$.status': 'unavailable' } },
        { session }
      );

      // Release the old slot
      await Availability.updateOne(
        { _id: existingAppointment.availabilityId, userId: existingAppointment.starId._id, 'timeSlots._id': existingAppointment.timeSlotId },
        { $set: { 'timeSlots.$.status': 'available' } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      // Populate the new appointment with related data (after transaction is committed)
      const populatedNewAppointment = await Appointment.findById(newAppointment[0]._id)
        .populate('starId', 'name pseudo baroniId profilePic')
        .populate('fanId', 'name pseudo baroniId profilePic')
        .populate('availabilityId');

      // Send notification to star about reschedule (after transaction is committed)
      try {
        await NotificationHelper.sendAppointmentNotification('APPOINTMENT_RESCHEDULED', populatedNewAppointment, { 
          currentUserId: req.user._id,
          originalAppointmentId: id
        });
      } catch (notificationError) {
        console.error('Error sending reschedule notification:', notificationError);
        // Don't fail the request if notification fails
      }

      return res.status(201).json({
        success: true,
        message: 'Appointment rescheduled successfully',
        data: {
          newAppointment: sanitize(populatedNewAppointment),
          originalAppointmentId: id
        }
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (err) {
    console.error('Reschedule appointment error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const completeAppointment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }
    const { id } = req.params;
    const { callDuration } = req.body; // callDuration is already in seconds
    
    console.log(`[CompleteAppointment] Completing appointment ${id} with call duration ${callDuration} seconds by user ${req.user._id}`);
    
    const appt = await Appointment.findById(id);
    if (!appt) {
      console.log(`[CompleteAppointment] Appointment ${id} not found`);
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    
    console.log(`[CompleteAppointment] Found appointment:`, {
      id: appt._id,
      status: appt.status,
      currentCallDuration: appt.callDuration || 0,
      starId: appt.starId,
      fanId: appt.fanId,
      date: appt.date,
      time: appt.time,
      price: appt.price,
      paymentStatus: appt.paymentStatus,
      transactionId: appt.transactionId
    });
    
    // Allow duration updates for approved, in_progress, and completed appointments
    if (appt.status !== 'approved' && appt.status !== 'in_progress' && appt.status !== 'completed') {
      console.log(`[CompleteAppointment] Appointment ${id} status is ${appt.status}, cannot add duration`);
      return res.status(400).json({ success: false, message: 'Only approved, in-progress, or completed appointments can have duration added' });
    }

    // Validate callDuration is a valid number
    if (typeof callDuration !== 'number' || isNaN(callDuration) || callDuration < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'callDuration must be a valid number (in seconds) and cannot be negative' 
      });
    }
    
    // callDuration is already in seconds, round it to ensure it's an integer
    const durationInSeconds = Math.round(callDuration);
    
    // Get current duration (ensure it's a number, default to 0 if not set)
    const currentDuration = typeof appt.callDuration === 'number' ? appt.callDuration : 0;
    const newTotalDuration = currentDuration + durationInSeconds;
    
    console.log(`[CompleteAppointment] Duration calculation (all in seconds):`, {
      receivedCallDuration: callDuration,
      roundedDurationInSeconds: durationInSeconds,
      currentDurationSeconds: currentDuration,
      newTotalDurationSeconds: newTotalDuration
    });
    
    console.log(`[CompleteAppointment] Duration accumulation:`, {
      currentDurationSeconds: currentDuration,
      addingSeconds: durationInSeconds,
      newTotalDurationSeconds: newTotalDuration,
      newTotalDurationMinutes: (newTotalDuration / 60).toFixed(2)
    });
    
    // Complete the transaction if it's still pending (only once)
    if (appt.transactionId && appt.paymentStatus !== 'completed') {
      try {
        console.log(`[CompleteAppointment] Checking transaction ${appt.transactionId} status`);
        
        const transaction = await Transaction.findById(appt.transactionId);
        if (!transaction) {
          console.log(`[CompleteAppointment] Transaction ${appt.transactionId} not found`);
          return res.status(404).json({
            success: false,
            message: 'Transaction not found'
          });
        }
        
        // Only complete if transaction is pending
        if (transaction.status === TRANSACTION_STATUSES.PENDING) {
          console.log(`[CompleteAppointment] Completing transaction ${appt.transactionId}`);
          await completeTransaction(appt.transactionId);
          console.log(`[CompleteAppointment] Transaction ${appt.transactionId} completed successfully`);
        } else if (transaction.status === TRANSACTION_STATUSES.COMPLETED) {
          console.log(`[CompleteAppointment] Transaction ${appt.transactionId} is already completed`);
        }
      } catch (transactionError) {
        console.error(`[CompleteAppointment] Failed to complete transaction ${appt.transactionId}:`, transactionError);
        // Continue with duration update even if transaction completion fails
      }
    }
    
    // Use MongoDB's atomic $inc operator to increment duration atomically
    // This prevents race conditions when multiple requests come in simultaneously
    // MongoDB's $inc treats null/undefined as 0, so it's safe to always use $inc
    const updateQuery = {
      $inc: { callDuration: durationInSeconds }
    };
    
    // Also update status if needed (only if currently approved)
    if (appt.status === 'approved') {
      updateQuery.$set = { status: 'in_progress' };
    }
    
    // Perform atomic update and return the updated document
    const updated = await Appointment.findByIdAndUpdate(
      id,
      updateQuery,
      { new: true, runValidators: true }
    );
    
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    
    // Get the final duration after atomic update
    const finalDuration = typeof updated.callDuration === 'number' ? updated.callDuration : 0;
    
    console.log(`[CompleteAppointment] Atomic update completed:`, {
      durationAdded: durationInSeconds,
      finalDurationSeconds: finalDuration,
      finalDurationMinutes: (finalDuration / 60).toFixed(2)
    });
    
    console.log(`[CompleteAppointment] Appointment ${id} updated:`, {
      id: updated._id,
      status: updated.status,
      callDuration: updated.callDuration,
      totalDurationSeconds: updated.callDuration,
      totalDurationMinutes: updated.callDuration / 60
    });
    
    // Note: Completion status will be set by cron job when duration >= 300 seconds
    // Do not send completion notification here - cron will handle it
    
    // Get final duration in seconds (after atomic update)
    const finalDurationSeconds = typeof updated.callDuration === 'number' ? updated.callDuration : 0;
    
    return res.json({ 
      success: true, 
      message: 'Call duration added successfully',
      data: {
        appointment: sanitize(updated), // Both callDuration and duration will be in seconds with same value
        // Additional duration info in seconds
        totalDurationSeconds: finalDurationSeconds,
        callDuration: finalDurationSeconds, // Duration in seconds
        duration: finalDurationSeconds, // Duration in seconds (same as callDuration)
        isFullyCompleted: finalDurationSeconds >= 300
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};