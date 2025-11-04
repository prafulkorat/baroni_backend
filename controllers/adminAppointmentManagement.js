import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Availability from '../models/Availability.js';
import Transaction from '../models/Transaction.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import mongoose from 'mongoose';

// Get appointments with comprehensive admin filters
export const getAppointmentsWithFilters = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = 'all', // video_calls, dedications, live_shows, all
      status = 'all', // pending, approved, rejected, completed, cancelled, all
      startDate = '',
      endDate = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build base filter
    let filter = {};
    
    // Category filtering
    if (category === 'video_calls') {
      filter = { status: { $exists: true } }; // All appointments are video calls
    } else if (category === 'dedications') {
      // This would need to be handled differently if you have a separate dedication model
      filter = { type: 'dedication' };
    } else if (category === 'live_shows') {
      filter = { type: 'live_show' };
    }

    // Status filtering
    if (status !== 'all') {
      filter.status = status;
    }

    // Date range filtering
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Search filtering (by star name, user name, or Baroni ID)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const starIds = await User.find({
        $or: [
          { name: searchRegex },
          { baroniId: searchRegex },
          { pseudo: searchRegex }
        ],
        role: 'star'
      }).select('_id');

      const userIds = await User.find({
        $or: [
          { name: searchRegex },
          { baroniId: searchRegex },
          { pseudo: searchRegex }
        ]
      }).select('_id');

      filter.$or = [
        { starId: { $in: starIds.map(s => s._id) } },
        { fanId: { $in: userIds.map(u => u._id) } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get appointments with populated data
    const appointments = await Appointment.find(filter)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId email contact role isVerified profession'
      })
      .populate({
        path: 'fanId',
        select: 'name pseudo profilePic baroniId email contact role'
      })
      .populate('availabilityId')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const totalCount = await Appointment.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Format response data
    const formattedAppointments = appointments.map(appointment => {
      const star = appointment.starId;
      const user = appointment.fanId;
      
      return {
        id: appointment._id,
        category: 'video_calls', // Default for now
        status: appointment.status,
        star: {
          id: star._id,
          name: star.name,
          baroniId: star.baroniId,
          profilePic: star.profilePic,
          isVerified: star.isVerified,
          role: star.profession || 'Singer',
          email: star.email,
          contact: star.contact
        },
        user: {
          id: user._id,
          name: user.name,
          baroniId: user.baroniId,
          profilePic: user.profilePic,
          email: user.email,
          contact: user.contact
        },
        service: {
          type: 'Video Call',
          duration: '15 min', // Default or from availability
          price: appointment.price
        },
        scheduledDateTime: new Date(`${appointment.date}T${appointment.time}`),
        createdAt: appointment.createdAt,
        updatedAt: appointment.updatedAt,
        callDuration: appointment.callDuration,
        // Duration in seconds: 0 if pending/not completed, actual duration if completed
        duration: appointment.status === 'completed' && typeof appointment.callDuration === 'number' ? appointment.callDuration : 0,
        paymentStatus: appointment.paymentStatus,
        actions: getAvailableActions(appointment.status),
        earnings: calculateEarnings(appointment)
      };
    });

    res.json({
      success: true,
      data: {
        appointments: formattedAppointments,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error('Error getting appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get appointments',
      error: error.message
    });
  }
};

// Get appointment statistics
export const getAppointmentStatistics = async (req, res) => {
  try {
    const { period = 'current_month', category = 'all' } = req.query;
    
    // Calculate date range based on period
    const { startDate, endDate } = getDateRange(period);
    
    let filter = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    if (category !== 'all') {
      // Add category filter if needed
    }

    const [
      totalAppointments,
      pendingAppointments,
      approvedAppointments,
      completedAppointments,
      cancelledAppointments,
      rejectedAppointments,
      totalRevenue
    ] = await Promise.all([
      Appointment.countDocuments(filter),
      Appointment.countDocuments({ ...filter, status: 'pending' }),
      Appointment.countDocuments({ ...filter, status: 'approved' }),
      Appointment.countDocuments({ ...filter, status: 'completed' }),
      Appointment.countDocuments({ ...filter, status: 'cancelled' }),
      Appointment.countDocuments({ ...filter, status: 'rejected' }),
      Appointment.aggregate([
        { $match: { ...filter, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$price' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalAppointments,
        pendingAppointments,
        approvedAppointments,
        completedAppointments,
        cancelledAppointments,
        rejectedAppointments,
        totalRevenue: totalRevenue[0]?.total || 0,
        period,
        category
      }
    });

  } catch (error) {
    console.error('Error getting appointment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get appointment statistics',
      error: error.message
    });
  }
};

// Approve appointment
export const approveAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { adminNotes = '' } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('starId', 'name baroniId')
      .populate('fanId', 'name baroniId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending appointments can be approved'
      });
    }

    appointment.status = 'approved';
    appointment.adminNotes = adminNotes;
    appointment.approvedAt = new Date();
    appointment.approvedBy = req.user._id;

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment approved successfully',
      data: {
        appointment: {
          id: appointment._id,
          status: appointment.status,
          star: appointment.starId,
          user: appointment.fanId,
          adminNotes: appointment.adminNotes
        }
      }
    });

  } catch (error) {
    console.error('Error approving appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve appointment',
      error: error.message
    });
  }
};

// Reject appointment
export const rejectAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason = '', adminNotes = '' } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('starId', 'name baroniId')
      .populate('fanId', 'name baroniId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending appointments can be rejected'
      });
    }

    appointment.status = 'rejected';
    appointment.rejectionReason = reason;
    appointment.adminNotes = adminNotes;
    appointment.rejectedAt = new Date();
    appointment.rejectedBy = req.user._id;

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment rejected successfully',
      data: {
        appointment: {
          id: appointment._id,
          status: appointment.status,
          star: appointment.starId,
          user: appointment.fanId,
          rejectionReason: appointment.rejectionReason,
          adminNotes: appointment.adminNotes
        }
      }
    });

  } catch (error) {
    console.error('Error rejecting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject appointment',
      error: error.message
    });
  }
};

// Reschedule appointment
export const rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newDateTime, reason = '', adminNotes = '' } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('starId', 'name baroniId')
      .populate('fanId', 'name baroniId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (!['pending', 'approved'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending or approved appointments can be rescheduled'
      });
    }

    // Update appointment with new date/time
    const newDate = new Date(newDateTime);
    appointment.date = newDate.toISOString().split('T')[0];
    appointment.time = newDate.toTimeString().split(' ')[0].substring(0, 5);
    appointment.rescheduleReason = reason;
    appointment.adminNotes = adminNotes;
    appointment.rescheduledAt = new Date();
    appointment.rescheduledBy = req.user._id;

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: {
        appointment: {
          id: appointment._id,
          status: appointment.status,
          star: appointment.starId,
          user: appointment.fanId,
          newDateTime: newDateTime,
          rescheduleReason: appointment.rescheduleReason,
          adminNotes: appointment.adminNotes
        }
      }
    });

  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reschedule appointment',
      error: error.message
    });
  }
};

// Cancel appointment
export const cancelAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason = '', refundAmount = 0, adminNotes = '' } = req.body;

    const appointment = await Appointment.findById(appointmentId)
      .populate('starId', 'name baroniId')
      .populate('fanId', 'name baroniId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Completed appointments cannot be cancelled'
      });
    }

    appointment.status = 'cancelled';
    appointment.cancellationReason = reason;
    appointment.refundAmount = refundAmount;
    appointment.adminNotes = adminNotes;
    appointment.cancelledAt = new Date();
    appointment.cancelledBy = req.user._id;

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: {
        appointment: {
          id: appointment._id,
          status: appointment.status,
          star: appointment.starId,
          user: appointment.fanId,
          cancellationReason: appointment.cancellationReason,
          refundAmount: appointment.refundAmount,
          adminNotes: appointment.adminNotes
        }
      }
    });

  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment',
      error: error.message
    });
  }
};

// Get appointment details
export const getAppointmentDetails = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId email contact role isVerified profession'
      })
      .populate({
        path: 'fanId',
        select: 'name pseudo profilePic baroniId email contact role'
      })
      .populate('availabilityId')
      .populate('transactionId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const star = appointment.starId;
    const user = appointment.fanId;

    res.json({
      success: true,
      data: {
        appointment: {
          id: appointment._id,
          category: 'video_calls',
          status: appointment.status,
          star: {
            id: star._id,
            name: star.name,
            baroniId: star.baroniId,
            profilePic: star.profilePic,
            isVerified: star.isVerified,
            role: star.profession || 'Singer',
            email: star.email,
            contact: star.contact
          },
          user: {
            id: user._id,
            name: user.name,
            baroniId: user.baroniId,
            profilePic: user.profilePic,
            email: user.email,
            contact: user.contact
          },
          service: {
            type: 'Video Call',
            duration: '15 min',
            price: appointment.price
          },
          scheduledDateTime: new Date(`${appointment.date}T${appointment.time}`),
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt,
          callDuration: appointment.callDuration,
          // Duration in seconds: 0 if pending/not completed, actual duration if completed
          duration: appointment.status === 'completed' && typeof appointment.callDuration === 'number' ? appointment.callDuration : 0,
          paymentStatus: appointment.paymentStatus,
          transaction: appointment.transactionId,
          adminNotes: appointment.adminNotes,
          actions: getAvailableActions(appointment.status),
          earnings: calculateEarnings(appointment)
        }
      }
    });

  } catch (error) {
    console.error('Error getting appointment details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get appointment details',
      error: error.message
    });
  }
};

// Get live show appointments
export const getLiveShowAppointments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'all',
      startDate = '',
      endDate = ''
    } = req.query;

    // For now, we'll use LiveShow model if it exists
    // This is a placeholder implementation
    let filter = {};

    if (status !== 'all') {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Placeholder data - replace with actual LiveShow queries
    const liveShows = await LiveShow.find(filter)
      .populate('starId', 'name baroniId profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalCount = await LiveShow.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      data: {
        liveShows: liveShows.map(show => ({
          id: show._id,
          title: show.title,
          description: show.description,
          star: show.starId,
          scheduledDateTime: show.scheduledDateTime,
          status: show.status,
          attendees: show.attendees || 0,
          maxAttendees: show.maxAttendees || 10000,
          earnings: show.earnings || 0,
          ticketPrice: show.ticketPrice || 2000
        })),
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error('Error getting live show appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get live show appointments',
      error: error.message
    });
  }
};

// Get dedication appointments
export const getDedicationAppointments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'all',
      startDate = '',
      endDate = ''
    } = req.query;

    let filter = {};

    if (status !== 'all') {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const dedications = await DedicationRequest.find(filter)
      .populate('starId', 'name baroniId profilePic')
      .populate('fanId', 'name baroniId profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalCount = await DedicationRequest.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      data: {
        dedications: dedications.map(dedication => ({
          id: dedication._id,
          type: dedication.type,
          message: dedication.message,
          star: dedication.starId,
          user: dedication.fanId,
          scheduledDateTime: dedication.scheduledDateTime,
          status: dedication.status,
          price: dedication.price,
          videoUrl: dedication.videoUrl
        })),
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        }
      }
    });

  } catch (error) {
    console.error('Error getting dedication appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dedication appointments',
      error: error.message
    });
  }
};

// Helper functions
const getAvailableActions = (status) => {
  switch (status) {
    case 'pending':
      return ['approve', 'reject'];
    case 'approved':
      return ['reschedule', 'cancel'];
    case 'completed':
      return ['view'];
    case 'cancelled':
    case 'rejected':
      return ['view'];
    default:
      return [];
  }
};

const calculateEarnings = (appointment) => {
  if (appointment.status === 'completed') {
    return appointment.price * 0.9; // Assuming 10% platform fee
  }
  return 0;
};

const getDateRange = (period) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'current_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'current_year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    case 'last_7_days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    case 'last_30_days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      endDate = now;
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  return { startDate, endDate };
};
