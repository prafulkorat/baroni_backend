import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import { refundTransaction } from '../services/transactionService.js';
import { getEffectiveCommission, applyCommission } from '../utils/commissionHelper.js';
import mongoose from 'mongoose';

const parseRange = (from, to) => {
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return Object.keys(range).length ? range : undefined;
};

export const getRefundMetrics = async (req, res) => {
  try {
    const { from, to, service } = req.query;
    const match = {};
    const createdAt = parseRange(from, to);
    if (createdAt) match.createdAt = createdAt;
    if (service) match.type = service;

    const totalRefundedAgg = await Transaction.aggregate([
      { $match: { ...match, status: 'refunded' } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const failedAgg = await Transaction.aggregate([
      { $match: { ...match, status: 'failed' } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const pendingAgg = await Transaction.aggregate([
      { $match: { ...match, status: { $in: ['pending', 'initiated'] } } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    return res.json({
      success: true,
      data: {
        totalRefunded: { count: totalRefundedAgg[0]?.count || 0, amount: totalRefundedAgg[0]?.amount || 0 },
        pendingRefunds: { count: pendingAgg[0]?.count || 0, amount: pendingAgg[0]?.amount || 0 },
        failedRefunds: { count: failedAgg[0]?.count || 0, amount: failedAgg[0]?.amount || 0 },
        avgCommissionTimeSec: 0
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Helper function to format date
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day} ${month} ${year} • ${hours}:${minutes} ${ampm}`;
};

// Helper function to get service duration from time range
const getDurationFromTimeRange = (timeRange) => {
  if (!timeRange || typeof timeRange !== 'string') return null;
  const match = timeRange.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
  if (!match) return null;
  const startHour = parseInt(match[1], 10);
  const startMin = parseInt(match[2], 10);
  const endHour = parseInt(match[3], 10);
  const endMin = parseInt(match[4], 10);
  const startTotal = startHour * 60 + startMin;
  const endTotal = endHour * 60 + endMin;
  const duration = endTotal - startTotal;
  return duration > 0 ? `${duration} min` : null;
};

// Helper function to map transaction status to refund status
const getRefundStatus = (transaction) => {
  if (transaction.status === 'refunded') return 'refunded';
  if (transaction.status === 'failed') return 'failed';
  if (transaction.status === 'pending' || transaction.status === 'initiated') return 'pending';
  // For completed transactions, check if they can be refunded
  return 'pending'; // Default for refundable completed transactions
};

export const listRefundables = async (req, res) => {
  try {
    const { q, status, service, from, to, type } = req.query;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const match = {};
    
    // Map UI status to transaction status
    if (status) {
      if (status === 'refunded') {
        match.status = 'refunded';
      } else if (status === 'failed') {
        match.status = 'failed';
      } else if (status === 'pending') {
        match.status = { $in: ['pending', 'initiated'] };
      }
    }
    
    // Map service type filter
    if (service) {
      if (service === 'video_call' || service === 'appointment') {
        match.type = 'appointment_payment';
      } else if (service === 'dedication') {
        match.type = 'dedication_request_payment';
      } else if (service === 'live_show') {
        match.type = 'live_show_payment';
      } else {
        match.type = service;
      }
    }
    
    // Filter by type (manual/auto) - this would need a field in Transaction model
    // For now, we'll skip this filter as it's not in the model
    
    const createdAt = parseRange(from, to);
    if (createdAt) match.createdAt = createdAt;

    // Search by payer/receiver name or pseudo or baroniId
    let userIds = [];
    if (q) {
      const regex = new RegExp(q, 'i');
      const users = await User.find({ $or: [{ name: regex }, { pseudo: regex }, { baroniId: regex }] }, { _id: 1 });
      userIds = users.map((u) => u._id);
      match.$or = [{ payerId: { $in: userIds } }, { receiverId: { $in: userIds } }];
    }

    const total = await Transaction.countDocuments(match);
    const transactions = await Transaction.find(match)
      .populate('payerId', 'name pseudo profilePic baroniId role isVerified profession country')
      .populate('receiverId', 'name pseudo profilePic baroniId role isVerified profession country')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Enrich transactions with service details, commission, and formatted data
    const enrichedItems = await Promise.all(transactions.map(async (txn) => {
      const payer = txn.payerId;
      const receiver = txn.receiverId;
      
      // Determine service type
      let serviceType = 'Unknown';
      let serviceDuration = null;
      let serviceId = null;
      let serviceDetails = null;
      
      if (txn.type === 'appointment_payment') {
        serviceType = 'Video Call';
        // Get appointment details
        const appointment = await Appointment.findOne({ transactionId: txn._id })
          .populate('availabilityId')
          .lean();
        if (appointment) {
          serviceId = `SRV-${appointment._id.toString().slice(-8).toUpperCase()}`;
          serviceDetails = appointment;
          // Get duration from time range
          if (txn.metadata?.time) {
            serviceDuration = getDurationFromTimeRange(txn.metadata.time);
          } else if (appointment.availabilityId?.timeSlots) {
            const slot = appointment.availabilityId.timeSlots.find(s => String(s._id) === String(appointment.timeSlotId));
            if (slot?.slot) {
              serviceDuration = getDurationFromTimeRange(slot.slot);
            }
          }
          // Default to 15 min if not found
          if (!serviceDuration) serviceDuration = '15 min';
        }
      } else if (txn.type === 'dedication_request_payment') {
        serviceType = 'Dedication';
        const dedication = await DedicationRequest.findOne({ transactionId: txn._id }).lean();
        if (dedication) {
          serviceId = `SRV-${dedication._id.toString().slice(-8).toUpperCase()}`;
          serviceDetails = dedication;
        }
      } else if (txn.type === 'live_show_payment') {
        serviceType = 'Live Show';
        const liveShow = await LiveShow.findOne({ transactionId: txn._id }).lean();
        if (liveShow) {
          serviceId = `SRV-${liveShow._id.toString().slice(-8).toUpperCase()}`;
          serviceDetails = liveShow;
        }
      }
      
      // Calculate commission and net amount
      let commissionAmount = 0;
      let netAmount = txn.amount;
      
      if (txn.type === 'appointment_payment' || txn.type === 'dedication_request_payment' || txn.type === 'live_show_payment') {
        try {
          const serviceTypeKey = txn.type === 'appointment_payment' ? 'videoCall' : 
                                 txn.type === 'dedication_request_payment' ? 'dedication' : 'liveShow';
          const countryCode = receiver?.country || payer?.country;
          const commissionRate = await getEffectiveCommission({ 
            serviceType: serviceTypeKey, 
            countryCode 
          });
          const { commission, netAmount: net } = applyCommission(txn.amount, commissionRate);
          commissionAmount = commission;
          netAmount = net;
        } catch (err) {
          console.error('Error calculating commission:', err);
        }
      }
      
      // Format payment ID
      const paymentId = txn.externalPaymentId ? `PAY-${txn.externalPaymentId}` : `PAY-${txn._id.toString().slice(-8).toUpperCase()}`;
      
      // Get refund status
      const refundStatus = getRefundStatus(txn);
      
      // Format scheduled date & time from service details
      let scheduledDateTime = null;
      if (serviceDetails) {
        if (txn.type === 'appointment_payment' && serviceDetails.date && serviceDetails.time) {
          // Format appointment date/time: "25 July 2025 • 10:30 AM"
          const [year, month, day] = serviceDetails.date.split('-').map(v => parseInt(v, 10));
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const timeStr = serviceDetails.time || txn.metadata?.time || '';
          // Extract time from range like "10:30 - 10:50" or "10:30 AM"
          let timePart = timeStr.split(' - ')[0].trim();
          if (!timePart.includes('AM') && !timePart.includes('PM')) {
            // Convert 24h to 12h format if needed
            const [hours, minutes] = timePart.split(':').map(v => parseInt(v, 10));
            if (!isNaN(hours) && !isNaN(minutes)) {
              const ampm = hours >= 12 ? 'PM' : 'AM';
              const hours12 = hours % 12 || 12;
              timePart = `${hours12}:${String(minutes).padStart(2, '0')} ${ampm}`;
            }
          }
          scheduledDateTime = `${day} ${months[month - 1]} ${year} • ${timePart}`;
        } else if (txn.type === 'dedication_request_payment' && serviceDetails.eventDate) {
          // Format dedication event date
          scheduledDateTime = formatDate(serviceDetails.eventDate);
        } else if (txn.type === 'live_show_payment' && serviceDetails.date) {
          // Format live show date
          scheduledDateTime = formatDate(serviceDetails.date);
        }
      }
      
      return {
        id: txn._id,
        transactionId: txn._id,
        type: txn.type,
        status: txn.status,
        refundStatus: refundStatus,
        amount: txn.amount,
        grossAmount: txn.amount,
        commissionAmount: commissionAmount,
        netAmount: netAmount,
        paymentMode: txn.paymentMode,
        externalPaymentId: txn.externalPaymentId,
        coinAmount: txn.coinAmount,
        externalAmount: txn.externalAmount,
        paymentId: paymentId,
        serviceId: serviceId,
        serviceType: serviceType,
        serviceDuration: serviceDuration,
        scheduledDateTime: scheduledDateTime,
        description: txn.description,
        createdAt: txn.createdAt,
        updatedAt: txn.updatedAt,
        formattedDate: formatDate(txn.createdAt),
        payer: payer ? {
          id: payer._id,
          name: payer.name,
          pseudo: payer.pseudo,
          baroniId: payer.baroniId,
          profilePic: payer.profilePic,
          role: payer.role,
          isVerified: payer.isVerified,
          profession: payer.profession
        } : null,
        receiver: receiver ? {
          id: receiver._id,
          name: receiver.name,
          pseudo: receiver.pseudo,
          baroniId: receiver.baroniId,
          profilePic: receiver.profilePic,
          role: receiver.role,
          isVerified: receiver.isVerified,
          profession: receiver.profession
        } : null,
        metadata: txn.metadata,
        serviceDetails: serviceDetails
      };
    }));

    return res.json({ success: true, data: { items: enrichedItems, page, limit, total } });
  } catch (err) {
    console.error('Error listing refundables:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const triggerRefund = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const result = await refundTransaction(transactionId);
    return res.json({ success: true, message: result.message });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};


