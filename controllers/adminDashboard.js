import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import LiveShowAttendance from '../models/LiveShowAttendance.js';
import ReportUser from '../models/ReportUser.js';
import mongoose from 'mongoose';

// Helper function to get date range based on period
const getDateRange = (period) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    switch (period) {
      case 'current_month':
        return { startDate: startOfMonth, endDate: endOfMonth };
      case 'last_month':
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { startDate: startOfLastMonth, endDate: endOfLastMonth };
      case 'last_7_days':
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { startDate: sevenDaysAgo, endDate: now };
      case 'last_30_days':
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { startDate: thirtyDaysAgo, endDate: now };
      default:
        return { startDate: startOfMonth, endDate: endOfMonth };
    }
  } catch (error) {
    console.error('Error in getDateRange:', error);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { startDate: startOfMonth, endDate: endOfMonth };
  }
};

// Dashboard Summary - Key Metrics
export const getDashboardSummary = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Get new users count
    const newUsers = await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
      isDeleted: { $ne: true }
    });

    // Get engaged fans (users who made transactions)
    const engagedFans = await User.countDocuments({
      _id: { $in: await Transaction.distinct('payerId', {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed'
      })},
      isDeleted: { $ne: true }
    });

    // Get total active users (users who logged in or made transactions)
    const activeUsers = await User.countDocuments({
      $or: [
        { lastLoginAt: { $gte: startDate, $lte: endDate } },
        { _id: { $in: await Transaction.distinct('payerId', {
          createdAt: { $gte: startDate, $lte: endDate }
        })}}
      ],
      isDeleted: { $ne: true }
    });

    // Device repartition
    const androidUsers = await User.countDocuments({
      deviceType: 'android',
      isDeleted: { $ne: true }
    });

    const iosUsers = await User.countDocuments({
      deviceType: 'ios',
      isDeleted: { $ne: true }
    });

    // Reported users count
    const reportedStars = await ReportUser.countDocuments({
      reportedUserRole: 'star'
    });

    const reportedFans = await ReportUser.countDocuments({
      reportedUserRole: 'fan'
    });

    return res.json({
      success: true,
      message: 'Dashboard summary retrieved successfully',
      data: {
        newUsers,
        engagedFans,
        totalActiveUsers: activeUsers,
        deviceRepartition: {
          androidUsers: { count: androidUsers, change: 0 }, // You can calculate change
          iosUsers: { count: iosUsers, change: 0 }
        },
        reportedUsers: {
          stars: reportedStars,
          fans: reportedFans
        }
      }
    });

  } catch (err) {
    console.error('Dashboard summary error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get dashboard summary'
    });
  }
};

// Revenue Insights
export const getRevenueInsights = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Total revenue from completed transactions
    const totalRevenueResult = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' }
        }
      }
    ]);

    const totalRevenue = totalRevenueResult[0]?.totalRevenue || 0;

    // Escrow amount (pending transactions)
    const escrowResult = await Transaction.aggregate([
      {
        $match: {
          status: 'pending',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          escrowAmount: { $sum: '$amount' }
        }
      }
    ]);

    const escrowAmount = escrowResult[0]?.escrowAmount || 0;

    // Service-wise revenue breakdown
    const serviceRevenue = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$type',
          amount: { $sum: '$amount' }
        }
      }
    ]);

    const serviceBreakdown = serviceRevenue.map(service => ({
      service: service._id,
      amount: service.amount
    }));

    return res.json({
      success: true,
      message: 'Revenue insights retrieved successfully',
      data: {
        totalRevenue,
        escrowAmount,
        serviceRevenue: serviceBreakdown
      }
    });

  } catch (err) {
    console.error('Revenue insights error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get revenue insights'
    });
  }
};

// Active Users by Country
export const getActiveUsersByCountry = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month', limit = 10 } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Get active users by country
    const countryStats = await User.aggregate([
      {
        $match: {
          country: { $exists: true, $ne: null },
          isDeleted: { $ne: true },
          $or: [
            { lastLoginAt: { $gte: startDate, $lte: endDate } },
            { _id: { $in: await Transaction.distinct('payerId', {
              createdAt: { $gte: startDate, $lte: endDate }
            })}}
          ]
        }
      },
      {
        $group: {
          _id: '$country',
          stars: {
            $sum: { $cond: [{ $eq: ['$role', 'star'] }, 1, 0] }
          },
          fans: {
            $sum: { $cond: [{ $eq: ['$role', 'fan'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { stars: -1, fans: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    const countries = countryStats.map(country => ({
      name: country._id,
      stars: country.stars,
      fans: country.fans
    }));

    return res.json({
      success: true,
      message: 'Active users by country retrieved successfully',
      data: {
        countries
      }
    });

  } catch (err) {
    console.error('Active users by country error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get active users by country'
    });
  }
};

// Cost Evaluation (Service Usage Minutes)
export const getCostEvaluation = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Video calls minutes (from appointments)
    const videoCallsResult = await Appointment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: '$callDuration' } // Using callDuration field from Appointment model
        }
      }
    ]);

    const videoCallsMinutes = videoCallsResult[0]?.totalMinutes || 0;

    // Live show minutes (from live shows) - estimate based on attendance
    const liveShowResult = await LiveShow.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: { $multiply: ['$currentAttendees', 30] } } // Estimate 30 minutes per attendee
        }
      }
    ]);

    const liveShowMinutes = liveShowResult[0]?.totalMinutes || 0;

    // Dedication minutes (estimated based on requests)
    const dedicationResult = await DedicationRequest.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: 5 } // Assuming 5 minutes per dedication
        }
      }
    ]);

    const dedicationMinutes = dedicationResult[0]?.totalMinutes || 0;

    return res.json({
      success: true,
      message: 'Cost evaluation retrieved successfully',
      data: {
        videoCalls: { minutes: videoCallsMinutes, change: 0 },
        liveShow: { minutes: liveShowMinutes, change: 0 },
        dedication: { minutes: dedicationMinutes, change: 0 }
      }
    });

  } catch (err) {
    console.error('Cost evaluation error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get cost evaluation'
    });
  }
};

// Service Insights (Detailed metrics for each service)
export const getServiceInsights = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { serviceType, period = 'current_month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    let insights = {};

    switch (serviceType) {
      case 'video-call':
        insights = await getVideoCallInsights(startDate, endDate);
        break;
      case 'live-show':
        insights = await getLiveShowInsights(startDate, endDate);
        break;
      case 'dedication':
        insights = await getDedicationInsights(startDate, endDate);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid service type'
        });
    }

    return res.json({
      success: true,
      message: 'Service insights retrieved successfully',
      data: insights
    });

  } catch (err) {
    console.error('Service insights error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get service insights'
    });
  }
};

// Helper function for video call insights
const getVideoCallInsights = async (startDate, endDate) => {
  const appointments = await Appointment.find({
    createdAt: { $gte: startDate, $lte: endDate }
  });

  const completed = appointments.filter(apt => apt.status === 'completed').length;
  const approved = appointments.filter(apt => apt.status === 'approved').length;
  const cancelled = appointments.filter(apt => apt.status === 'cancelled').length;
  const pending = appointments.filter(apt => apt.status === 'pending').length;

  const uniqueUsers = new Set([
    ...appointments.map(apt => apt.fanId?.toString()),
    ...appointments.map(apt => apt.starId?.toString())
  ]).size;

  const netRevenue = await Transaction.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'appointments',
        localField: '_id',
        foreignField: 'transactionId',
        as: 'appointment'
      }
    },
    {
      $match: {
        'appointment.0': { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' }
      }
    }
  ]);

  return {
    completed,
    approved,
    cancelled,
    pending,
    uniqueFansAndStars: uniqueUsers,
    netRevenue: netRevenue[0]?.totalRevenue || 0
  };
};

// Helper function for live show insights
const getLiveShowInsights = async (startDate, endDate) => {
  const liveShows = await LiveShow.find({
    createdAt: { $gte: startDate, $lte: endDate }
  });

  const completed = liveShows.filter(show => show.status === 'completed').length;
  const approved = liveShows.filter(show => show.status === 'approved').length;
  const cancelled = liveShows.filter(show => show.status === 'cancelled').length;
  const pending = liveShows.filter(show => show.status === 'pending').length;

  const uniqueUsers = new Set([
    ...liveShows.map(show => show.starId?.toString()),
    ...(await LiveShowAttendance.distinct('fanId', {
      liveShowId: { $in: liveShows.map(show => show._id) }
    })).map(id => id.toString())
  ]).size;

  const netRevenue = await Transaction.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'liveshows',
        localField: '_id',
        foreignField: 'transactionId',
        as: 'liveShow'
      }
    },
    {
      $match: {
        'liveShow.0': { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' }
      }
    }
  ]);

  return {
    completed,
    approved,
    cancelled,
    pending,
    uniqueFansAndStars: uniqueUsers,
    netRevenue: netRevenue[0]?.totalRevenue || 0
  };
};

// Helper function for dedication insights
const getDedicationInsights = async (startDate, endDate) => {
  const dedicationRequests = await DedicationRequest.find({
    createdAt: { $gte: startDate, $lte: endDate }
  });

  const completed = dedicationRequests.filter(req => req.status === 'completed').length;
  const approved = dedicationRequests.filter(req => req.status === 'approved').length;
  const cancelled = dedicationRequests.filter(req => req.status === 'cancelled').length;
  const pending = dedicationRequests.filter(req => req.status === 'pending').length;

  const uniqueUsers = new Set([
    ...dedicationRequests.map(req => req.fanId?.toString()),
    ...dedicationRequests.map(req => req.starId?.toString())
  ]).size;

  const netRevenue = await Transaction.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'dedicationrequests',
        localField: '_id',
        foreignField: 'transactionId',
        as: 'dedicationRequest'
      }
    },
    {
      $match: {
        'dedicationRequest.0': { $exists: true }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' }
      }
    }
  ]);

  return {
    completed,
    approved,
    cancelled,
    pending,
    uniqueFansAndStars: uniqueUsers,
    netRevenue: netRevenue[0]?.totalRevenue || 0
  };
};

// Top Stars API
export const getTopStars = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month', limit = 50, sortBy = 'revenue' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Get top stars by revenue
    const topStars = await Transaction.aggregate([
      {
        $match: {
          receiverId: { $exists: true },
          status: 'completed',
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$receiverId',
          totalRevenue: { $sum: '$amount' },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'star'
        }
      },
      {
        $unwind: '$star'
      },
      {
        $match: {
          'star.role': 'star',
          'star.isDeleted': { $ne: true }
        }
      },
      {
        $project: {
          id: '$_id',
          name: '$star.name',
          pseudo: '$star.pseudo',
          profilePic: '$star.profilePic',
          revenue: '$totalRevenue',
          transactionCount: '$transactionCount',
          engagementScore: { $divide: ['$totalRevenue', '$transactionCount'] }
        }
      },
      {
        $sort: sortBy === 'revenue' ? { revenue: -1 } : { engagementScore: -1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    return res.json({
      success: true,
      message: 'Top stars retrieved successfully',
      data: {
        stars: topStars
      }
    });

  } catch (err) {
    console.error('Top stars error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get top stars'
    });
  }
};

// Complete Dashboard Data (All in one)
export const getCompleteDashboard = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;

    // Get all dashboard data in parallel
    const [
      summaryData,
      revenueData,
      countryData,
      costData,
      videoCallInsights,
      liveShowInsights,
      dedicationInsights,
      topStarsData
    ] = await Promise.all([
      getDashboardSummaryData(period),
      getRevenueInsightsData(period),
      getActiveUsersByCountryData(period),
      getCostEvaluationData(period),
      getVideoCallInsightsData(period),
      getLiveShowInsightsData(period),
      getDedicationInsightsData(period),
      getTopStarsData(period)
    ]);

    return res.json({
      success: true,
      message: 'Complete dashboard data retrieved successfully',
      data: {
        summary: summaryData,
        revenue: revenueData,
        countries: countryData,
        costEvaluation: costData,
        serviceInsights: {
          videoCall: videoCallInsights,
          liveShow: liveShowInsights,
          dedication: dedicationInsights
        },
        topStars: topStarsData
      }
    });

  } catch (err) {
    console.error('Complete dashboard error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get complete dashboard data'
    });
  }
};

// Helper functions for complete dashboard
const getDashboardSummaryData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  
  const newUsers = await User.countDocuments({
    createdAt: { $gte: startDate, $lte: endDate },
    isDeleted: { $ne: true }
  });

  const engagedFans = await User.countDocuments({
    _id: { $in: await Transaction.distinct('payerId', {
      createdAt: { $gte: startDate, $lte: endDate },
      status: 'completed'
    })},
    isDeleted: { $ne: true }
  });

  const totalActiveUsers = await User.countDocuments({
    $or: [
      { lastLoginAt: { $gte: startDate, $lte: endDate } },
      { _id: { $in: await Transaction.distinct('payerId', {
        createdAt: { $gte: startDate, $lte: endDate }
      })}}
    ],
    isDeleted: { $ne: true }
  });

  const androidUsers = await User.countDocuments({
    deviceType: 'android',
    isDeleted: { $ne: true }
  });

  const iosUsers = await User.countDocuments({
    deviceType: 'ios',
    isDeleted: { $ne: true }
  });

  return {
    newUsers,
    engagedFans,
    totalActiveUsers,
    deviceRepartition: {
      androidUsers: { count: androidUsers, change: 0 },
      iosUsers: { count: iosUsers, change: 0 }
    }
  };
};

const getRevenueInsightsData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  
  const totalRevenueResult = await Transaction.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$amount' }
      }
    }
  ]);

  const escrowResult = await Transaction.aggregate([
    {
      $match: {
        status: 'pending',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        escrowAmount: { $sum: '$amount' }
      }
    }
  ]);

  return {
    totalRevenue: totalRevenueResult[0]?.totalRevenue || 0,
    escrowAmount: escrowResult[0]?.escrowAmount || 0
  };
};

const getActiveUsersByCountryData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  
  const countryStats = await User.aggregate([
    {
      $match: {
        country: { $exists: true, $ne: null },
        isDeleted: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$country',
        stars: {
          $sum: { $cond: [{ $eq: ['$role', 'star'] }, 1, 0] }
        },
        fans: {
          $sum: { $cond: [{ $eq: ['$role', 'fan'] }, 1, 0] }
        }
      }
    },
    {
      $sort: { stars: -1, fans: -1 }
    },
    {
      $limit: 10
    }
  ]);

  return countryStats.map(country => ({
    name: country._id,
    stars: country.stars,
    fans: country.fans
  }));
};

const getCostEvaluationData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  
  const videoCallsResult = await Appointment.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalMinutes: { $sum: '$callDuration' }
      }
    }
  ]);

  const liveShowResult = await LiveShow.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalMinutes: { $sum: { $multiply: ['$currentAttendees', 30] } }
      }
    }
  ]);

  const dedicationResult = await DedicationRequest.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalMinutes: { $sum: 5 }
      }
    }
  ]);

  return {
    videoCalls: { minutes: videoCallsResult[0]?.totalMinutes || 0, change: 0 },
    liveShow: { minutes: liveShowResult[0]?.totalMinutes || 0, change: 0 },
    dedication: { minutes: dedicationResult[0]?.totalMinutes || 0, change: 0 }
  };
};

const getVideoCallInsightsData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  return await getVideoCallInsights(startDate, endDate);
};

const getLiveShowInsightsData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  return await getLiveShowInsights(startDate, endDate);
};

const getDedicationInsightsData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  return await getDedicationInsights(startDate, endDate);
};

const getTopStarsData = async (period) => {
  const { startDate, endDate } = getDateRange(period);
  
  const topStars = await Transaction.aggregate([
    {
      $match: {
        receiverId: { $exists: true },
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$receiverId',
        totalRevenue: { $sum: '$amount' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'star'
      }
    },
    {
      $unwind: '$star'
    },
    {
      $match: {
        'star.role': 'star',
        'star.isDeleted': { $ne: true }
      }
    },
    {
      $project: {
        id: '$_id',
        name: '$star.name',
        revenue: '$totalRevenue'
      }
    },
    {
      $sort: { revenue: -1 }
    },
    {
      $limit: 50
    }
  ]);

  return topStars;
};
