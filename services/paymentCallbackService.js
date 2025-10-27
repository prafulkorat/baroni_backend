import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import LiveShowAttendance from '../models/LiveShowAttendance.js';
import mongoose from 'mongoose';
import orangeMoneyService from './orangeMoneyService.js';
import { TRANSACTION_STATUSES } from '../utils/transactionConstants.js';
import NotificationHelper from '../utils/notificationHelper.js';
import { createDefaultRating } from '../utils/defaultRatingHelper.js';

/**
 * Process payment callback from Orange Money
 * @param {Object} callbackData - Callback data from Orange Money
 * @returns {Promise<Object>} Processing result
 */
export const processPaymentCallback = async (callbackData) => {
  const session = await mongoose.startSession();

  try {
    console.log('=== PAYMENT CALLBACK PROCESSING ===');
    console.log('Raw callback data:', JSON.stringify(callbackData, null, 2));
    
    // CRITICAL FIX: Add processing lock to prevent duplicate processing
    const processingKey = `callback_${callbackData.transactionId}_${Date.now()}`;
    console.log(`Processing with key: ${processingKey}`);
    
    // CRITICAL FIX: Remove session.withTransaction to avoid rollback issues
    console.log('Starting callback processing without MongoDB transaction...');
    
    // Declare variables in outer scope
    let status = null;
    let transaction = null;
    
    try {
      // Validate callback data
      console.log('Validating callback data...');
      const validatedData = orangeMoneyService.validateCallbackData(callbackData);
      console.log('Validated data:', JSON.stringify(validatedData, null, 2));
      
      const { transactionId, status: callbackStatus, motif, amount } = validatedData;
      status = callbackStatus;

      // Find transaction by external payment ID
      console.log(`Looking for transaction with externalPaymentId: ${transactionId}`);
      transaction = await Transaction.findOne({ 
        externalPaymentId: transactionId 
      });

      if (transaction) {
        console.log('Found transaction:', {
          id: transaction._id,
          type: transaction.type,
          status: transaction.status,
          amount: transaction.amount,
          payerId: transaction.payerId,
          receiverId: transaction.receiverId,
          paymentMode: transaction.paymentMode,
          coinAmount: transaction.coinAmount,
          externalAmount: transaction.externalAmount,
          externalPaymentId: transaction.externalPaymentId,
          refundTimer: transaction.refundTimer,
          createdAt: transaction.createdAt
        });
      } else {
        console.log('No transaction found');
      }

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // CRITICAL FIX: Check if transaction is already completed to prevent infinite loop
      if (transaction.status === TRANSACTION_STATUSES.COMPLETED) {
        console.log(`Transaction ${transaction._id} is already completed - skipping to prevent infinite loop`);
        return { success: true, message: 'Transaction already completed' };
      }

      if (![TRANSACTION_STATUSES.INITIATED, TRANSACTION_STATUSES.PENDING].includes(transaction.status)) {
        console.log(`Transaction status ${transaction.status} is not processable - skipping`);
        return { success: true, message: 'Transaction already processed' };
      }

      console.log(`Processing payment with status: ${status}`);

      if (status === 'completed') {
        // Payment successful - move transaction to completed and clear refund timer
        console.log(`[PaymentCallback] Updating transaction status to completed`);
        
        // CRITICAL FIX: Use findByIdAndUpdate to ensure atomic update
        console.log(`[PaymentCallback] Before update - Transaction status: ${transaction.status}`);
        
        const updatedTransaction = await Transaction.findByIdAndUpdate(
          transaction._id,
          { 
            $set: { 
              status: TRANSACTION_STATUSES.COMPLETED,
              refundTimer: null
            }
          },
          { new: true }
        );
        
        console.log(`[PaymentCallback] Transaction status updated successfully:`, {
          id: updatedTransaction._id,
          oldStatus: transaction.status,
          newStatus: updatedTransaction.status,
          updatedAt: updatedTransaction.updatedAt
        });
        
        // Verify the update by querying again
        const verifyTransaction = await Transaction.findById(transaction._id);
        console.log(`[PaymentCallback] Verification - Transaction status: ${verifyTransaction.status}, updatedAt: ${verifyTransaction.updatedAt}`);

        // Reflect domain paymentStatus transitions to 'pending' once external payment succeeds
        await Appointment.updateMany(
          { transactionId: transaction._id },
          { $set: { paymentStatus: 'pending' } }
        );
        await DedicationRequest.updateMany(
          { transactionId: transaction._id },
          { $set: { paymentStatus: 'pending' } }
        );
        await LiveShow.updateMany(
          { transactionId: transaction._id },
          { $set: { paymentStatus: 'pending' } }
        );
        await LiveShowAttendance.updateMany(
          { transactionId: transaction._id },
          { $set: { paymentStatus: 'pending' } }
        );

        // Handle star promotion payment status updates
        if (transaction.type === 'become_star_payment') {
          console.log(`[PaymentCallback] Processing star promotion for transaction ${transaction._id}, user ${transaction.payerId}`);
          
          // First, check the current user status
          const currentUser = await User.findById(transaction.payerId);
          console.log(`[PaymentCallback] Current user status:`, {
            id: currentUser._id,
            role: currentUser.role,
            paymentStatus: currentUser.paymentStatus,
            baroniId: currentUser.baroniId
          });
          
          // CRITICAL FIX: Update user without paymentStatus condition to ensure update happens
          console.log(`[PaymentCallback] Updating user ${transaction.payerId} to star role`);
          
          const updateResult = await User.findByIdAndUpdate(
            transaction.payerId,
            { 
              $set: { 
                paymentStatus: 'completed',
                role: 'star',
                about: "Coucou, c'est ta star 🌟 ! Je suis là pour te partager de la bonne humeur, de l'énergie et des dédicaces pleines d'amour."
              } 
            },
            { new: true }
          );
          
          console.log(`[PaymentCallback] User update result:`, {
            matchedCount: updateResult ? 1 : 0,
            modifiedCount: updateResult ? 1 : 0,
            updatedUser: updateResult ? {
              id: updateResult._id,
              role: updateResult.role,
              paymentStatus: updateResult.paymentStatus,
              baroniId: updateResult.baroniId
            } : null
          });

          // Create default 5 rating for the new star
          await createDefaultRating(transaction.payerId);
          
          console.log(`[PaymentCallback] Star promotion completed for user ${transaction.payerId}`);
        }
      } else {
        // Payment failed - refund coins and mark as failed
        await refundHybridTransaction(transaction, null);
        await cancelLinkedEntitiesForTransaction(transaction, null);
      }
      
    } catch (processingError) {
      console.error(`[PaymentCallback] Error in processing:`, processingError);
      throw processingError;
    }

    console.log(`[PaymentCallback] Processing completed successfully`);

    // Send notifications AFTER processing is completed
    try {
      if (status === 'completed' && transaction) {
        console.log(`[PaymentCallback] Sending notifications...`);
        
        // Only send star promotion notification for become_star_payment type
        if (transaction.type === 'become_star_payment') {
          await sendStarPromotionNotification(transaction, null);
        }
        
        // Send appointment notification to star after payment success
        await sendAppointmentNotificationAfterPayment(transaction, null);
        
        // Send dedication request notification to star after payment success
        await sendDedicationRequestNotificationAfterPayment(transaction, null);
        
        console.log(`[PaymentCallback] Notifications sent successfully`);
      }
    } catch (notificationError) {
      console.error('Error sending notifications (non-critical):', notificationError);
      // Don't throw error to avoid breaking the payment callback
    }

    console.log(`[PaymentCallback] Payment callback processing completed successfully`);
    return { success: true, message: 'Payment callback processed successfully' };

  } catch (error) {
    console.error('Error processing payment callback:', error);
    throw error;
  } finally {
    // Session cleanup
    if (session) {
      await session.endSession();
    }
  }
};

/**
 * Complete a hybrid transaction after successful external payment
 * @param {Object} transaction - Transaction object
 * @param {Object} session - MongoDB session
 */
const completeHybridTransaction = async (transaction, session) => {
  // Add external amount as coins to receiver
  if (transaction.externalAmount > 0) {
    await User.findByIdAndUpdate(
      transaction.receiverId,
      { $inc: { coinBalance: transaction.externalAmount } },
      { session, new: true }
    );
  }

  // Update transaction status
  transaction.status = TRANSACTION_STATUSES.COMPLETED;
  transaction.refundTimer = null; // Clear refund timer
  await transaction.save({ session });
};

/**
 * Refund a hybrid transaction after failed external payment
 * @param {Object} transaction - Transaction object
 * @param {Object} session - MongoDB session
 */
const refundHybridTransaction = async (transaction, session) => {
  // Refund coin amount to payer
  if (transaction.coinAmount > 0) {
    await User.findByIdAndUpdate(
      transaction.payerId,
      { $inc: { coinBalance: transaction.coinAmount } },
      { session, new: true }
    );
  }

  // Update transaction status
  transaction.status = TRANSACTION_STATUSES.FAILED;
  transaction.refundTimer = null; // Clear refund timer
  await transaction.save({ session });

  // Handle star promotion refund - revert user back to fan
  if (transaction.type === 'become_star_payment') {
    console.log(`[PaymentCallback] Refunding star promotion for transaction ${transaction._id}, user ${transaction.payerId}`);
    
    // Use $unset to remove baroniId instead of setting to null to avoid duplicate key error
    await User.updateMany(
      { 
        _id: transaction.payerId,
        paymentStatus: { $in: ['initiated', 'pending'] }
      },
      { 
        $set: { 
          paymentStatus: 'refunded',
          role: 'fan'
        },
        $unset: { 
          baroniId: 1
        }
      },
      { session }
    );
    
    console.log(`[PaymentCallback] Star promotion refunded for user ${transaction.payerId}`);
  }
};

// Cancel domain entities linked to a refunded/failed transaction
const cancelLinkedEntitiesForTransaction = async (transaction, session) => {
  // Cancel appointment linked to this transaction and free reserved slot
  const affectedAppointments = await Appointment.find({ transactionId: transaction._id, status: { $in: ['pending', 'approved'] } }).session(session);
  for (const appt of affectedAppointments) {
    appt.status = 'cancelled';
    appt.paymentStatus = 'refunded';
    await appt.save({ session });
    try {
      const Availability = (await import('../models/Availability.js')).default;
      await Availability.updateOne(
        { _id: appt.availabilityId, userId: appt.starId, 'timeSlots._id': appt.timeSlotId },
        { $set: { 'timeSlots.$.status': 'available' } }
      ).session(session);
    } catch (_e) {}
  }

  // Cancel dedication requests linked to this transaction
  await DedicationRequest.updateMany(
    { transactionId: transaction._id, status: { $in: ['pending', 'approved'] } },
    { $set: { status: 'cancelled', paymentStatus: 'refunded', cancelledAt: new Date() } },
    { session }
  );

  // Cancel live show created with a hosting payment that failed
  const hostingShow = await LiveShow.findOne({ transactionId: transaction._id }).session(session);
  if (hostingShow && hostingShow.status === 'pending') {
    hostingShow.status = 'cancelled';
    hostingShow.paymentStatus = 'refunded';
    await hostingShow.save({ session });
  }

  // Cancel live show attendance linked to this transaction and reverse attendee count
  const attendance = await LiveShowAttendance.findOne({ transactionId: transaction._id }).session(session);
  if (attendance && attendance.status === 'pending') {
    attendance.status = 'cancelled';
    attendance.cancelledAt = new Date();
    attendance.paymentStatus = 'refunded';
    await attendance.save({ session });

    await LiveShow.findByIdAndUpdate(
      attendance.liveShowId,
      {
        $pull: { attendees: attendance.fanId },
        $inc: { currentAttendees: -1 }
      },
      { session }
    );
  }
};

/**
 * Handle payment timeouts and refund coins
 * This function should be called by a cron job every few minutes
 * @returns {Promise<Object>} Processing result
 */
export const handlePaymentTimeout = async () => {
  const session = await mongoose.startSession();
  const timeoutMinutes = 15;
  const timeoutDate = new Date(Date.now() - (timeoutMinutes * 60 * 1000));
  let timeoutTransactions = [];

  try {
    await session.withTransaction(async () => {
      // Find transactions that are initiated and past timeout (external not confirmed in time)
      timeoutTransactions = await Transaction.find({
        status: TRANSACTION_STATUSES.INITIATED,
        refundTimer: { $lte: timeoutDate }
      }).session(session);

      for (const transaction of timeoutTransactions) {
        await refundHybridTransaction(transaction, session);
        await cancelLinkedEntitiesForTransaction(transaction, session);
        console.log(`Refunded transaction ${transaction._id} due to timeout`);
      }
    });

    return { 
      success: true, 
      message: `Processed ${timeoutTransactions.length} timeout transactions` 
    };

  } catch (error) {
    console.error('Error handling payment timeout:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};

/**
 * Send appointment notification to star after payment success
 * @param {Object} transaction - Transaction object
 * @param {Object} session - MongoDB session
 */
const sendAppointmentNotificationAfterPayment = async (transaction, session) => {
  try {
    // Only send notification for appointment payments
    if (transaction.type === 'appointment_payment') {
      // Find the appointment
      const appointment = await Appointment.findOne({ 
        transactionId: transaction._id 
      }).session(session);
      
      if (appointment) {
        // Check if this is a hybrid payment (external payment completed)
        // Coin-only payments are handled immediately in appointment creation
        const isHybridPayment = transaction.externalAmount && transaction.externalAmount > 0;
        
        if (isHybridPayment) {
          console.log(`[PaymentCallback] Sending appointment notification for hybrid payment - transaction ${transaction._id}, appointment ${appointment._id}`);
          // Send appointment notification to star for hybrid payments
          await NotificationHelper.sendAppointmentNotification('APPOINTMENT_CREATED', appointment, { 
            currentUserId: appointment.fanId 
          });
        } else {
          console.log(`[PaymentCallback] Skipping notification for coin-only payment - transaction ${transaction._id}, appointment ${appointment._id}`);
        }
      } else {
        console.log(`[PaymentCallback] No appointment found for transaction ${transaction._id}`);
      }
    }
  } catch (error) {
    console.error('Error sending appointment notification after payment:', error);
    // Don't throw error to avoid breaking the payment callback
  }
};

/**
 * Send dedication request notification to star after payment success
 * @param {Object} transaction - Transaction object
 * @param {Object} session - MongoDB session
 */
const sendDedicationRequestNotificationAfterPayment = async (transaction, session) => {
  try {
    // Only send notification for dedication request payments
    if (transaction.type === 'dedication_request_payment') {
      // Find the dedication request
      const dedicationRequest = await DedicationRequest.findOne({ 
        transactionId: transaction._id 
      }).session(session);
      
      if (dedicationRequest) {
        // Check if this is a hybrid payment (external payment completed)
        // Coin-only payments are handled immediately in dedication request creation
        const isHybridPayment = transaction.externalAmount && transaction.externalAmount > 0;
        
        if (isHybridPayment) {
          console.log(`[PaymentCallback] Sending dedication request notification for hybrid payment - transaction ${transaction._id}, dedicationRequest ${dedicationRequest._id}`);
          // Send dedication request notification to star for hybrid payments
          await NotificationHelper.sendDedicationNotification('DEDICATION_REQUEST_CREATED', dedicationRequest, { 
            currentUserId: dedicationRequest.fanId 
          });
        } else {
          console.log(`[PaymentCallback] Skipping notification for coin-only payment - transaction ${transaction._id}, dedicationRequest ${dedicationRequest._id}`);
        }
      } else {
        console.log(`[PaymentCallback] No dedication request found for transaction ${transaction._id}`);
      }
    }
  } catch (error) {
    console.error('Error sending dedication request notification after payment:', error);
    // Don't throw error to avoid breaking the payment callback
  }
};

/**
 * Send star promotion notification to the new star
 * @param {Object} transaction - Transaction object
 * @param {Object} session - MongoDB session
 */
const sendStarPromotionNotification = async (transaction, session) => {
  try {
    // Import notification service
    const notificationService = (await import('./notificationService.js')).default;
    
    // Get user details
    const user = await User.findById(transaction.payerId).session(session);
    if (!user) {
      console.error('User not found for star promotion notification');
      return;
    }

    const userName = user.name || user.pseudo || 'Star';
    
    // Prepare notification data
    const notificationData = {
      title: 'Congratulations! You are now a Baroni Star 🌟',
      body: `Welcome to the stars, ${userName}! You can now receive bookings and create content for your fans.`,
      type: 'star_promotion'
    };

    const data = {
      type: 'star_promotion',
      userId: user._id.toString(),
      userName,
      navigateTo: 'profile',
      eventType: 'STAR_PROMOTION_COMPLETED',
      isMessage: false
    };

    // Don't set relatedEntity for star promotion notifications
    // as it's user-specific and not related to other entities
    const options = {};

    // Send notification to the new star
    await notificationService.sendToUser(user._id.toString(), notificationData, data, options);
    
    console.log(`Star promotion notification sent to user ${user._id}`);
  } catch (error) {
    console.error('Error sending star promotion notification:', error);
    // Don't throw error to avoid breaking the payment callback
  }
};