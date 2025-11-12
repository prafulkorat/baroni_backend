import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Get call logs statistics
export const getCallLogsStatistics = async (req, res) => {
  try {
    const { period = 'current_month' } = req.query;
    
    // Calculate date range based on period
    const { startDate, endDate } = getDateRange(period);
    
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    const [
      totalCalls,
      completedCalls,
      missedCalls,
      averageDuration
    ] = await Promise.all([
      Appointment.countDocuments(filter),
      Appointment.countDocuments({ ...filter, status: 'completed' }),
      Appointment.countDocuments({ ...filter, status: 'cancelled' }),
      Appointment.aggregate([
        { $match: { ...filter, status: 'completed', callDuration: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgDuration: { $avg: '$callDuration' } } }
      ])
    ]);

    // Format average duration (convert from seconds to minutes)
    const avgDurationSeconds = averageDuration[0]?.avgDuration || 0;
    const avgDurationMinutes = avgDurationSeconds / 60;
    const avgDurationFormatted = formatDuration(avgDurationMinutes);

    res.json({
      success: true,
      data: {
        totalCalls,
        completedCalls,
        missedCalls,
        averageDuration: avgDurationFormatted,
        period
      }
    });

  } catch (error) {
    console.error('Error getting call logs statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get call logs statistics',
      error: error.message
    });
  }
};

// Get call logs with filters
export const getCallLogsWithFilters = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'all', // all, completed, missed
      startDate = '',
      endDate = '',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build base filter
    let filter = {};

    // Status filtering
    if (status === 'completed') {
      filter.status = 'completed';
    } else if (status === 'missed') {
      filter.status = { $in: ['cancelled', 'rejected'] };
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
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const totalCount = await Appointment.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Format response data
    const formattedCallLogs = appointments.map(appointment => {
      const star = appointment.starId;
      const user = appointment.fanId;
      
      return {
        id: appointment._id,
        star: {
          id: star._id,
          name: star.name,
          baroniId: star.baroniId,
          profilePic: star.profilePic,
          isVerified: star.isVerified,
          role: star.profession || 'Singer'
        },
        user: {
          id: user._id,
          name: user.name,
          baroniId: user.baroniId,
          profilePic: user.profilePic
        },
        callType: '15 min Video Call', // Default or from service
        status: appointment.status,
        scheduledDuration: 15, // Default or from service
        actualDuration: appointment.callDuration ? (appointment.callDuration / 60) : 0, // Convert seconds to minutes
        actualDurationFormatted: formatDuration(appointment.callDuration ? (appointment.callDuration / 60) : 0),
        price: appointment.status === 'completed' ? appointment.price : 0,
        timestamp: appointment.createdAt,
        scheduledDateTime: new Date(`${appointment.date}T${appointment.time}`)
      };
    });

    res.json({
      success: true,
      data: {
        callLogs: formattedCallLogs,
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
    console.error('Error getting call logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get call logs',
      error: error.message
    });
  }
};

// Get completed call logs
export const getCompletedCallLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      startDate = '',
      endDate = '',
      search = ''
    } = req.query;

    let filter = { status: 'completed' };

    // Date range filtering
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Search filtering
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

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const appointments = await Appointment.find(filter)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId email contact role isVerified profession'
      })
      .populate({
        path: 'fanId',
        select: 'name pseudo profilePic baroniId email contact role'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalCount = await Appointment.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    const formattedCallLogs = appointments.map(appointment => {
      const star = appointment.starId;
      const user = appointment.fanId;
      
      return {
        id: appointment._id,
        star: {
          id: star._id,
          name: star.name,
          baroniId: star.baroniId,
          profilePic: star.profilePic,
          isVerified: star.isVerified,
          role: star.profession || 'Singer'
        },
        user: {
          id: user._id,
          name: user.name,
          baroniId: user.baroniId,
          profilePic: user.profilePic
        },
        callType: '15 min Video Call',
        status: 'completed',
        scheduledDuration: 15,
        actualDuration: appointment.callDuration ? (appointment.callDuration / 60) : 0, // Convert seconds to minutes
        actualDurationFormatted: formatDuration(appointment.callDuration ? (appointment.callDuration / 60) : 0),
        price: appointment.price,
        timestamp: appointment.createdAt,
        scheduledDateTime: new Date(`${appointment.date}T${appointment.time}`)
      };
    });

    res.json({
      success: true,
      data: {
        callLogs: formattedCallLogs,
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
    console.error('Error getting completed call logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get completed call logs',
      error: error.message
    });
  }
};

// Get missed call logs
export const getMissedCallLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      startDate = '',
      endDate = '',
      search = ''
    } = req.query;

    let filter = { status: { $in: ['cancelled', 'rejected'] } };

    // Date range filtering
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Search filtering
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

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const appointments = await Appointment.find(filter)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId email contact role isVerified profession'
      })
      .populate({
        path: 'fanId',
        select: 'name pseudo profilePic baroniId email contact role'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalCount = await Appointment.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    const formattedCallLogs = appointments.map(appointment => {
      const star = appointment.starId;
      const user = appointment.fanId;
      
      return {
        id: appointment._id,
        star: {
          id: star._id,
          name: star.name,
          baroniId: star.baroniId,
          profilePic: star.profilePic,
          isVerified: star.isVerified,
          role: star.profession || 'Singer'
        },
        user: {
          id: user._id,
          name: user.name,
          baroniId: user.baroniId,
          profilePic: user.profilePic
        },
        callType: '15 min Video Call',
        status: 'missed',
        scheduledDuration: 15,
        actualDuration: 0,
        actualDurationFormatted: '00 min 00 sec',
        price: 0,
        timestamp: appointment.createdAt,
        scheduledDateTime: new Date(`${appointment.date}T${appointment.time}`)
      };
    });

    res.json({
      success: true,
      data: {
        callLogs: formattedCallLogs,
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
    console.error('Error getting missed call logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get missed call logs',
      error: error.message
    });
  }
};

// Get call log details
export const getCallLogDetails = async (req, res) => {
  try {
    const { callLogId } = req.params;

    const appointment = await Appointment.findById(callLogId)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId email contact role isVerified profession'
      })
      .populate({
        path: 'fanId',
        select: 'name pseudo profilePic baroniId email contact role'
      })
      .populate('transactionId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Call log not found'
      });
    }

    const star = appointment.starId;
    const user = appointment.fanId;

    res.json({
      success: true,
      data: {
        callLog: {
          id: appointment._id,
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
          callType: '15 min Video Call',
          status: appointment.status,
          scheduledDuration: 15,
          actualDuration: appointment.callDuration || 0,
          actualDurationFormatted: formatDuration(appointment.callDuration || 0),
          price: appointment.status === 'completed' ? appointment.price : 0,
          timestamp: appointment.createdAt,
          scheduledDateTime: new Date(`${appointment.date}T${appointment.time}`),
          completedAt: appointment.completedAt,
          transaction: appointment.transactionId,
          adminNotes: appointment.adminNotes
        }
      }
    });

  } catch (error) {
    console.error('Error getting call log details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get call log details',
      error: error.message
    });
  }
};

// Get call logs by star
export const getCallLogsByStar = async (req, res) => {
  try {
    const { starId } = req.params;
    const {
      page = 1,
      limit = 20,
      status = 'all',
      startDate = '',
      endDate = ''
    } = req.query;

    let filter = { starId: new mongoose.Types.ObjectId(starId) };

    if (status === 'completed') {
      filter.status = 'completed';
    } else if (status === 'missed') {
      filter.status = { $in: ['cancelled', 'rejected'] };
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const appointments = await Appointment.find(filter)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId email contact role isVerified profession'
      })
      .populate({
        path: 'fanId',
        select: 'name pseudo profilePic baroniId email contact role'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalCount = await Appointment.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    const formattedCallLogs = appointments.map(appointment => {
      const star = appointment.starId;
      const user = appointment.fanId;
      
      return {
        id: appointment._id,
        star: {
          id: star._id,
          name: star.name,
          baroniId: star.baroniId,
          profilePic: star.profilePic,
          isVerified: star.isVerified,
          role: star.profession || 'Singer'
        },
        user: {
          id: user._id,
          name: user.name,
          baroniId: user.baroniId,
          profilePic: user.profilePic
        },
        callType: '15 min Video Call',
        status: appointment.status,
        scheduledDuration: 15,
        actualDuration: appointment.callDuration ? (appointment.callDuration / 60) : 0, // Convert seconds to minutes
        actualDurationFormatted: formatDuration(appointment.callDuration ? (appointment.callDuration / 60) : 0),
        price: appointment.status === 'completed' ? appointment.price : 0,
        timestamp: appointment.createdAt,
        scheduledDateTime: new Date(`${appointment.date}T${appointment.time}`)
      };
    });

    res.json({
      success: true,
      data: {
        callLogs: formattedCallLogs,
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
    console.error('Error getting call logs by star:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get call logs by star',
      error: error.message
    });
  }
};

// Get call logs by user
export const getCallLogsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      page = 1,
      limit = 20,
      status = 'all',
      startDate = '',
      endDate = ''
    } = req.query;

    let filter = { fanId: new mongoose.Types.ObjectId(userId) };

    if (status === 'completed') {
      filter.status = 'completed';
    } else if (status === 'missed') {
      filter.status = { $in: ['cancelled', 'rejected'] };
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const appointments = await Appointment.find(filter)
      .populate({
        path: 'starId',
        select: 'name pseudo profilePic baroniId email contact role isVerified profession'
      })
      .populate({
        path: 'fanId',
        select: 'name pseudo profilePic baroniId email contact role'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const totalCount = await Appointment.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limitNum);

    const formattedCallLogs = appointments.map(appointment => {
      const star = appointment.starId;
      const user = appointment.fanId;
      
      return {
        id: appointment._id,
        star: {
          id: star._id,
          name: star.name,
          baroniId: star.baroniId,
          profilePic: star.profilePic,
          isVerified: star.isVerified,
          role: star.profession || 'Singer'
        },
        user: {
          id: user._id,
          name: user.name,
          baroniId: user.baroniId,
          profilePic: user.profilePic
        },
        callType: '15 min Video Call',
        status: appointment.status,
        scheduledDuration: 15,
        actualDuration: appointment.callDuration ? (appointment.callDuration / 60) : 0, // Convert seconds to minutes
        actualDurationFormatted: formatDuration(appointment.callDuration ? (appointment.callDuration / 60) : 0),
        price: appointment.status === 'completed' ? appointment.price : 0,
        timestamp: appointment.createdAt,
        scheduledDateTime: new Date(`${appointment.date}T${appointment.time}`)
      };
    });

    res.json({
      success: true,
      data: {
        callLogs: formattedCallLogs,
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
    console.error('Error getting call logs by user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get call logs by user',
      error: error.message
    });
  }
};

// Update call log status
export const updateCallLogStatus = async (req, res) => {
  try {
    const { callLogId } = req.params;
    const { status, actualDuration, adminNotes = '' } = req.body;

    const appointment = await Appointment.findById(callLogId)
      .populate('starId', 'name baroniId')
      .populate('fanId', 'name baroniId');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Call log not found'
      });
    }

    // Update appointment based on status
    if (status === 'completed') {
      appointment.status = 'completed';
      // Convert minutes to seconds for storage
      appointment.callDuration = actualDuration * 60;
      appointment.completedAt = new Date();
    } else if (status === 'missed') {
      appointment.status = 'cancelled';
    }

    appointment.adminNotes = adminNotes;
    appointment.updatedBy = req.user._id;

    await appointment.save();

    res.json({
      success: true,
      message: 'Call log status updated successfully',
      data: {
        callLog: {
          id: appointment._id,
          status: appointment.status,
          star: appointment.starId,
          user: appointment.fanId,
          actualDuration: appointment.callDuration ? (appointment.callDuration / 60) : 0, // Convert seconds to minutes
          adminNotes: appointment.adminNotes
        }
      }
    });

  } catch (error) {
    console.error('Error updating call log status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update call log status',
      error: error.message
    });
  }
};

// Get call log analytics
export const getCallLogAnalytics = async (req, res) => {
  try {
    const { period = 'current_month', groupBy = 'day' } = req.query;
    
    const { startDate, endDate } = getDateRange(period);
    
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    let groupFormat;
    switch (groupBy) {
      case 'day':
        groupFormat = '%Y-%m-%d';
        break;
      case 'week':
        groupFormat = '%Y-%U';
        break;
      case 'month':
        groupFormat = '%Y-%m';
        break;
      default:
        groupFormat = '%Y-%m-%d';
    }

    const analytics = await Appointment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: '$createdAt'
            }
          },
          totalCalls: { $sum: 1 },
          completedCalls: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          missedCalls: {
            $sum: { $cond: [{ $in: ['$status', ['cancelled', 'rejected']] }, 1, 0] }
          },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$price', 0] }
          },
          averageDuration: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'completed'] },
                '$callDuration',
                null
              ]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        analytics,
        period,
        groupBy,
        summary: {
          totalCalls: analytics.reduce((sum, item) => sum + item.totalCalls, 0),
          completedCalls: analytics.reduce((sum, item) => sum + item.completedCalls, 0),
          missedCalls: analytics.reduce((sum, item) => sum + item.missedCalls, 0),
          totalRevenue: analytics.reduce((sum, item) => sum + item.totalRevenue, 0),
          averageDuration: analytics.reduce((sum, item) => sum + (item.averageDuration || 0), 0) / analytics.length
        }
      }
    });

  } catch (error) {
    console.error('Error getting call log analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get call log analytics',
      error: error.message
    });
  }
};

// Helper functions
const formatDuration = (minutes) => {
  if (!minutes || minutes === 0) return '00 min 00 sec';
  
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  
  return `${mins} min ${secs} sec`;
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
