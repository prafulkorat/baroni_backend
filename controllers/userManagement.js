import User from '../models/User.js';
import Review from '../models/Review.js';
import Service from '../models/Service.js';
import DedicationSample from '../models/DedicationSample.js';
import ReportUser from '../models/ReportUser.js';
import Transaction from '../models/Transaction.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import mongoose from 'mongoose';

// Get all users with filtering, searching, and pagination
export const getAllUsers = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      country = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build filter object
    const filter = {
      isDeleted: { $ne: true }
    };

    // Add search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { pseudo: { $regex: search, $options: 'i' } },
        { baroniId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Add role filter
    if (role && role !== 'all') {
      filter.role = role;
    }

    // Add country filter
    if (country && country !== 'all') {
      filter.country = country;
    }

    // Add status filter (based on availableForBookings and hidden)
    if (status && status !== 'all') {
      if (status === 'active') {
        filter.availableForBookings = true;
        filter.hidden = false;
      } else if (status === 'blocked') {
        filter.$or = [
          { availableForBookings: false },
          { hidden: true }
        ];
      }
    }

    // Get users with pagination
    const users = await User.find(filter)
      .populate('profession', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalUsers = await User.countDocuments(filter);

    // Get unique countries for filter options
    const countries = await User.distinct('country', {
      country: { $exists: true, $ne: null },
      isDeleted: { $ne: true }
    });

    // Get role counts
    const roleCounts = await User.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const roleStats = roleCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Get status counts
    const activeCount = await User.countDocuments({
      availableForBookings: true,
      hidden: false,
      isDeleted: { $ne: true }
    });

    const blockedCount = await User.countDocuments({
      $or: [
        { availableForBookings: false },
        { hidden: true }
      ],
      isDeleted: { $ne: true }
    });

    return res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users: users.map(user => ({
          id: user._id,
          baroniId: user.baroniId,
          name: user.name,
          pseudo: user.pseudo,
          email: user.email,
          profilePic: user.profilePic,
          role: user.role,
          country: user.country,
          profession: user.profession,
          availableForBookings: user.availableForBookings,
          hidden: user.hidden,
          status: user.availableForBookings && !user.hidden ? 'active' : 'blocked',
          coinBalance: user.coinBalance,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalUsers,
          pages: Math.ceil(totalUsers / parseInt(limit))
        },
        filters: {
          countries: countries.sort(),
          roles: ['star', 'fan'],
          statuses: ['active', 'blocked']
        },
        stats: {
          roles: roleStats,
          status: {
            active: activeCount,
            blocked: blockedCount
          }
        }
      }
    });

  } catch (err) {
    console.error('Get all users error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get users'
    });
  }
};

// Get user details by ID
export const getUserDetails = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(userId)
      .populate('profession', 'name')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's services
    const services = await Service.find({ userId: user._id }).lean();

    // Get user's dedication samples
    const dedicationSamples = await DedicationSample.find({ userId: user._id }).lean();

    // Get user's reviews (if star)
    let reviews = [];
    if (user.role === 'star') {
      reviews = await Review.find({ starId: user._id })
        .populate('reviewerId', 'name pseudo profilePic')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    // Get user's reports (both as reporter and reported)
    const reportsAsReporter = await ReportUser.find({ reporterId: user._id })
      .populate('reportedUserId', 'name pseudo role')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const reportsAsReported = await ReportUser.find({ reportedUserId: user._id })
      .populate('reporterId', 'name pseudo role')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Get user's transaction stats
    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          $or: [
            { payerId: user._id },
            { receiverId: user._id }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ['$payerId', user._id] }, '$amount', 0]
            }
          },
          totalEarned: {
            $sum: {
              $cond: [{ $eq: ['$receiverId', user._id] }, '$amount', 0]
            }
          },
          transactionCount: { $sum: 1 }
        }
      }
    ]);

    const stats = transactionStats[0] || {
      totalSpent: 0,
      totalEarned: 0,
      transactionCount: 0
    };

    return res.json({
      success: true,
      message: 'User details retrieved successfully',
      data: {
        user: {
          id: user._id,
          baroniId: user.baroniId,
          name: user.name,
          pseudo: user.pseudo,
          email: user.email,
          contact: user.contact,
          profilePic: user.profilePic,
          role: user.role,
          country: user.country,
          profession: user.profession,
          about: user.about,
          location: user.location,
          availableForBookings: user.availableForBookings,
          hidden: user.hidden,
          appNotification: user.appNotification,
          coinBalance: user.coinBalance,
          deviceType: user.deviceType,
          isDev: user.isDev,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        },
        services,
        dedicationSamples,
        reviews: reviews.map(review => ({
          id: review._id,
          rating: review.rating,
          comment: review.comment,
          reviewer: {
            id: review.reviewerId._id,
            name: review.reviewerId.name,
            pseudo: review.reviewerId.pseudo,
            profilePic: review.reviewerId.profilePic
          },
          reviewType: review.reviewType,
          createdAt: review.createdAt
        })),
        reports: {
          asReporter: reportsAsReporter.map(report => ({
            id: report._id,
            reportedUser: {
              id: report.reportedUserId._id,
              name: report.reportedUserId.name,
              pseudo: report.reportedUserId.pseudo,
              role: report.reportedUserId.role
            },
            reason: report.reason,
            description: report.description,
            status: report.status,
            createdAt: report.createdAt
          })),
          asReported: reportsAsReported.map(report => ({
            id: report._id,
            reporter: {
              id: report.reporterId._id,
              name: report.reporterId.name,
              pseudo: report.reporterId.pseudo,
              role: report.reporterId.role
            },
            reason: report.reason,
            description: report.description,
            status: report.status,
            createdAt: report.createdAt
          }))
        },
        stats
      }
    });

  } catch (err) {
    console.error('Get user details error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user details'
    });
  }
};

// Update user status (block/unblock)
export const updateUserStatus = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { userId } = req.params;
    const { action, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!['block', 'unblock'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "block" or "unblock"'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user status
    if (action === 'block') {
      user.availableForBookings = false;
      user.hidden = true;
    } else {
      user.availableForBookings = true;
      user.hidden = false;
    }

    await user.save();

    return res.json({
      success: true,
      message: `User ${action}ed successfully`,
      data: {
        user: {
          id: user._id,
          name: user.name,
          pseudo: user.pseudo,
          status: user.availableForBookings && !user.hidden ? 'active' : 'blocked',
          availableForBookings: user.availableForBookings,
          hidden: user.hidden
        }
      }
    });

  } catch (err) {
    console.error('Update user status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { userId } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (!['fan', 'star'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Use "fan" or "star"'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = role;
    await user.save();

    return res.json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          pseudo: user.pseudo,
          role: user.role
        }
      }
    });

  } catch (err) {
    console.error('Update user role error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user role'
    });
  }
};

// Delete user (soft delete)
export const deleteUser = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { userId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Soft delete user
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.availableForBookings = false;
    user.hidden = true;
    await user.save();

    return res.json({
      success: true,
      message: 'User deleted successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          pseudo: user.pseudo,
          deletedAt: user.deletedAt
        }
      }
    });

  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete user'
    });
  }
};

// Get user statistics
export const getUserStats = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { period = 'current_month' } = req.query;

    // Get date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    let startDate, endDate;
    switch (period) {
      case 'current_month':
        startDate = startOfMonth;
        endDate = endOfMonth;
        break;
      case 'last_month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
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
        startDate = startOfMonth;
        endDate = endOfMonth;
    }

    // Get user statistics
    const totalUsers = await User.countDocuments({ isDeleted: { $ne: true } });
    const newUsers = await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
      isDeleted: { $ne: true }
    });

    const activeUsers = await User.countDocuments({
      availableForBookings: true,
      hidden: false,
      isDeleted: { $ne: true }
    });

    const blockedUsers = await User.countDocuments({
      $or: [
        { availableForBookings: false },
        { hidden: true }
      ],
      isDeleted: { $ne: true }
    });

    const starsCount = await User.countDocuments({
      role: 'star',
      isDeleted: { $ne: true }
    });

    const fansCount = await User.countDocuments({
      role: 'fan',
      isDeleted: { $ne: true }
    });

    // Get users by country
    const usersByCountry = await User.aggregate([
      {
        $match: {
          country: { $exists: true, $ne: null },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$country',
          count: { $sum: 1 },
          stars: {
            $sum: { $cond: [{ $eq: ['$role', 'star'] }, 1, 0] }
          },
          fans: {
            $sum: { $cond: [{ $eq: ['$role', 'fan'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get device statistics
    const deviceStats = await User.aggregate([
      {
        $match: {
          deviceType: { $exists: true, $ne: null },
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$deviceType',
          count: { $sum: 1 }
        }
      }
    ]);

    return res.json({
      success: true,
      message: 'User statistics retrieved successfully',
      data: {
        overview: {
          totalUsers,
          newUsers,
          activeUsers,
          blockedUsers,
          starsCount,
          fansCount
        },
        usersByCountry: usersByCountry.map(country => ({
          country: country._id,
          total: country.count,
          stars: country.stars,
          fans: country.fans
        })),
        deviceStats: deviceStats.map(device => ({
          device: device._id,
          count: device.count
        })),
        period: {
          startDate,
          endDate,
          type: period
        }
      }
    });

  } catch (err) {
    console.error('Get user stats error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user statistics'
    });
  }
};
