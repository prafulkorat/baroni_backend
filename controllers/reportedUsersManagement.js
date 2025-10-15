import ReportUser from '../models/ReportUser.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Get all reported users with filtering, searching, and pagination
export const getAllReportedUsers = async (req, res) => {
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
      status = '',
      reportedUserRole = '',
      country = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build filter object
    const filter = {};

    // Add search filter (search in reporter name, reported user name, or reason)
    if (search) {
      const reporterIds = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { pseudo: { $regex: search, $options: 'i' } },
          { baroniId: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      const reportedUserIds = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { pseudo: { $regex: search, $options: 'i' } },
          { baroniId: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      filter.$or = [
        { reporterId: { $in: reporterIds } },
        { reportedUserId: { $in: reportedUserIds } },
        { reason: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Add reported user role filter
    if (reportedUserRole && reportedUserRole !== 'all') {
      filter.reportedUserRole = reportedUserRole;
    }

    // Get reported users with pagination
    const reports = await ReportUser.find(filter)
      .populate('reporterId', 'name pseudo profilePic role country')
      .populate('reportedUserId', 'name pseudo profilePic role country')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalReports = await ReportUser.countDocuments(filter);

    // Get unique countries for filter options
    const countries = await User.distinct('country', {
      country: { $exists: true, $ne: null },
      isDeleted: { $ne: true }
    });

    // Get status counts
    const statusCounts = await ReportUser.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusStats = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Get role counts
    const roleCounts = await ReportUser.aggregate([
      {
        $group: {
          _id: '$reportedUserRole',
          count: { $sum: 1 }
        }
      }
    ]);

    const roleStats = roleCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Get most reported users
    const mostReportedUsers = await ReportUser.aggregate([
      {
        $group: {
          _id: '$reportedUserId',
          reportCount: { $sum: 1 }
        }
      },
      { $sort: { reportCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userId: '$_id',
          userName: '$user.name',
          userPseudo: '$user.pseudo',
          userProfilePic: '$user.profilePic',
          userRole: '$user.role',
          userCountry: '$user.country',
          reportCount: 1
        }
      }
    ]);

    return res.json({
      success: true,
      message: 'Reported users retrieved successfully',
      data: {
        reports: reports.map(report => ({
          id: report._id,
          reporter: {
            id: report.reporterId._id,
            name: report.reporterId.name,
            pseudo: report.reporterId.pseudo,
            profilePic: report.reporterId.profilePic,
            role: report.reporterId.role,
            country: report.reporterId.country
          },
          reportedUser: {
            id: report.reportedUserId._id,
            name: report.reportedUserId.name,
            pseudo: report.reportedUserId.pseudo,
            profilePic: report.reportedUserId.profilePic,
            role: report.reportedUserId.role,
            country: report.reportedUserId.country
          },
          reason: report.reason,
          description: report.description,
          status: report.status,
          reportedUserRole: report.reportedUserRole,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalReports,
          pages: Math.ceil(totalReports / parseInt(limit))
        },
        filters: {
          countries: countries.sort(),
          statuses: ['pending', 'reviewed', 'resolved', 'dismissed'],
          roles: ['star', 'fan']
        },
        stats: {
          status: statusStats,
          roles: roleStats
        },
        mostReportedUsers: mostReportedUsers.map(user => ({
          userId: user.userId,
          userName: user.userName,
          userPseudo: user.userPseudo,
          userProfilePic: user.userProfilePic,
          userRole: user.userRole,
          userCountry: user.userCountry,
          reportCount: user.reportCount
        }))
      }
    });

  } catch (err) {
    console.error('Get all reported users error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get reported users'
    });
  }
};

// Get reported user details by ID
export const getReportedUserDetails = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { reportId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }

    const report = await ReportUser.findById(reportId)
      .populate('reporterId', 'name pseudo profilePic role email contact country')
      .populate('reportedUserId', 'name pseudo profilePic role email contact country')
      .lean();

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Get all reports for the reported user
    const allReportsForUser = await ReportUser.find({ reportedUserId: report.reportedUserId._id })
      .populate('reporterId', 'name pseudo profilePic role')
      .sort({ createdAt: -1 })
      .lean();

    // Get reported user's profile details
    const reportedUser = await User.findById(report.reportedUserId._id)
      .populate('profession', 'name')
      .lean();

    return res.json({
      success: true,
      message: 'Reported user details retrieved successfully',
      data: {
        report: {
          id: report._id,
          reporter: {
            id: report.reporterId._id,
            name: report.reporterId.name,
            pseudo: report.reporterId.pseudo,
            profilePic: report.reporterId.profilePic,
            role: report.reporterId.role,
            email: report.reporterId.email,
            contact: report.reporterId.contact,
            country: report.reporterId.country
          },
          reportedUser: {
            id: report.reportedUserId._id,
            name: report.reportedUserId.name,
            pseudo: report.reportedUserId.pseudo,
            profilePic: report.reportedUserId.profilePic,
            role: report.reportedUserId.role,
            email: report.reportedUserId.email,
            contact: report.reportedUserId.contact,
            country: report.reportedUserId.country
          },
          reason: report.reason,
          description: report.description,
          status: report.status,
          reportedUserRole: report.reportedUserRole,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt
        },
        reportedUserProfile: {
          id: reportedUser._id,
          baroniId: reportedUser.baroniId,
          name: reportedUser.name,
          pseudo: reportedUser.pseudo,
          email: reportedUser.email,
          contact: reportedUser.contact,
          profilePic: reportedUser.profilePic,
          role: reportedUser.role,
          country: reportedUser.country,
          profession: reportedUser.profession,
          about: reportedUser.about,
          location: reportedUser.location,
          availableForBookings: reportedUser.availableForBookings,
          hidden: reportedUser.hidden,
          coinBalance: reportedUser.coinBalance,
          createdAt: reportedUser.createdAt,
          lastLoginAt: reportedUser.lastLoginAt
        },
        allReportsForUser: allReportsForUser.map(r => ({
          id: r._id,
          reporter: {
            id: r.reporterId._id,
            name: r.reporterId.name,
            pseudo: r.reporterId.pseudo,
            profilePic: r.reporterId.profilePic,
            role: r.reporterId.role
          },
          reason: r.reason,
          description: r.description,
          status: r.status,
          createdAt: r.createdAt
        })),
        reportCount: allReportsForUser.length
      }
    });

  } catch (err) {
    console.error('Get reported user details error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get reported user details'
    });
  }
};

// Update report status
export const updateReportStatus = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { reportId } = req.params;
    const { status, adminNotes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }

    if (!['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Use: pending, reviewed, resolved, or dismissed'
      });
    }

    const report = await ReportUser.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    report.status = status;
    if (adminNotes) {
      report.adminNotes = adminNotes;
    }
    report.reviewedBy = admin._id;
    report.reviewedAt = new Date();

    await report.save();

    return res.json({
      success: true,
      message: 'Report status updated successfully',
      data: {
        report: {
          id: report._id,
          status: report.status,
          adminNotes: report.adminNotes,
          reviewedBy: report.reviewedBy,
          reviewedAt: report.reviewedAt,
          updatedAt: report.updatedAt
        }
      }
    });

  } catch (err) {
    console.error('Update report status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update report status'
    });
  }
};

// Block reported user
export const blockReportedUser = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { reportId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }

    const report = await ReportUser.findById(reportId)
      .populate('reportedUserId');
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const reportedUser = report.reportedUserId;
    
    // Block the user
    reportedUser.availableForBookings = false;
    reportedUser.hidden = true;
    await reportedUser.save();

    // Update report status
    report.status = 'resolved';
    report.adminNotes = `User blocked by admin. Reason: ${reason || 'Multiple reports'}`;
    report.reviewedBy = admin._id;
    report.reviewedAt = new Date();
    await report.save();

    return res.json({
      success: true,
      message: 'User blocked successfully',
      data: {
        user: {
          id: reportedUser._id,
          name: reportedUser.name,
          pseudo: reportedUser.pseudo,
          status: 'blocked',
          availableForBookings: reportedUser.availableForBookings,
          hidden: reportedUser.hidden
        },
        report: {
          id: report._id,
          status: report.status,
          adminNotes: report.adminNotes,
          reviewedAt: report.reviewedAt
        }
      }
    });

  } catch (err) {
    console.error('Block reported user error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to block user'
    });
  }
};

// Unblock reported user
export const unblockReportedUser = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { reportId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }

    const report = await ReportUser.findById(reportId)
      .populate('reportedUserId');
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    const reportedUser = report.reportedUserId;
    
    // Unblock the user
    reportedUser.availableForBookings = true;
    reportedUser.hidden = false;
    await reportedUser.save();

    // Update report status
    report.status = 'resolved';
    report.adminNotes = `User unblocked by admin. Reason: ${reason || 'Investigation completed'}`;
    report.reviewedBy = admin._id;
    report.reviewedAt = new Date();
    await report.save();

    return res.json({
      success: true,
      message: 'User unblocked successfully',
      data: {
        user: {
          id: reportedUser._id,
          name: reportedUser.name,
          pseudo: reportedUser.pseudo,
          status: 'active',
          availableForBookings: reportedUser.availableForBookings,
          hidden: reportedUser.hidden
        },
        report: {
          id: report._id,
          status: report.status,
          adminNotes: report.adminNotes,
          reviewedAt: report.reviewedAt
        }
      }
    });

  } catch (err) {
    console.error('Unblock reported user error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to unblock user'
    });
  }
};

// Delete report
export const deleteReport = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { reportId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid report ID'
      });
    }

    const report = await ReportUser.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    await ReportUser.deleteOne({ _id: reportId });

    return res.json({
      success: true,
      message: 'Report deleted successfully'
    });

  } catch (err) {
    console.error('Delete report error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete report'
    });
  }
};

// Get reported users statistics
export const getReportedUsersStats = async (req, res) => {
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

    // Get report statistics
    const totalReports = await ReportUser.countDocuments();
    const newReports = await ReportUser.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Get status distribution
    const statusDistribution = await ReportUser.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get role distribution
    const roleDistribution = await ReportUser.aggregate([
      {
        $group: {
          _id: '$reportedUserRole',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get reports by country
    const reportsByCountry = await ReportUser.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'reportedUserId',
          foreignField: '_id',
          as: 'reportedUser'
        }
      },
      {
        $unwind: '$reportedUser'
      },
      {
        $match: {
          'reportedUser.country': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$reportedUser.country',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get most common reasons
    const commonReasons = await ReportUser.aggregate([
      {
        $match: {
          reason: { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return res.json({
      success: true,
      message: 'Reported users statistics retrieved successfully',
      data: {
        overview: {
          totalReports,
          newReports
        },
        statusDistribution: statusDistribution.map(s => ({
          status: s._id,
          count: s.count
        })),
        roleDistribution: roleDistribution.map(r => ({
          role: r._id,
          count: r.count
        })),
        reportsByCountry: reportsByCountry.map(c => ({
          country: c._id,
          count: c.count
        })),
        commonReasons: commonReasons.map(r => ({
          reason: r._id,
          count: r.count
        })),
        period: {
          startDate,
          endDate,
          type: period
        }
      }
    });

  } catch (err) {
    console.error('Get reported users stats error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get reported users statistics'
    });
  }
};
