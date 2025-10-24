import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import ReportUser from '../models/ReportUser.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { sanitizeUserData } from '../utils/userDataHelper.js';

const sanitize = (doc) => ({
  id: doc._id,
  reporter: doc.reporterId ? sanitizeUserData(doc.reporterId) : doc.reporterId,
  reportedUser: doc.reportedUserId ? sanitizeUserData(doc.reportedUserId) : doc.reportedUserId,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
});

export const createReport = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { reportedUserId, reason, description } = req.body;

    // Check if the reported user exists and get their role
    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'Reported user not found' 
      });
    }

    // Check if user is trying to report themselves
    if (reportedUserId.toString() === req.user._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot report yourself' 
      });
    }

    // Check if user has already reported this user
    const existingReport = await ReportUser.findOne({
      reporterId: req.user._id,
      reportedUserId: reportedUserId
    });

    if (existingReport) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already reported this user' 
      });
    }

    const created = await ReportUser.create({
      reporterId: req.user._id,
      reportedUserId,
      reportedUserRole: reportedUser.role,
      reason: reason?.trim(),
      description: description?.trim()
    });

    const populated = await ReportUser.findById(created._id)
      .populate('reporterId', 'name pseudo profilePic baroniId role')
      .populate('reportedUserId', 'name pseudo profilePic baroniId role');

    return res.status(201).json({ 
      success: true, 
      message: 'User reported successfully',
      data: sanitize(populated) 
    });
  } catch (err) {
    console.error('Create report error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const listReports = async (req, res) => {
  try {
    const { reporterId, reportedUserId } = req.query;
    const filter = {};
    if (reporterId && mongoose.Types.ObjectId.isValid(reporterId)) filter.reporterId = reporterId;
    if (reportedUserId && mongoose.Types.ObjectId.isValid(reportedUserId)) filter.reportedUserId = reportedUserId;

    const items = await ReportUser.find(filter)
      .sort({ createdAt: -1 })
      .populate('reporterId', '-password -passwordResetToken -passwordResetExpires')
      .populate('reportedUserId', '-password -passwordResetToken -passwordResetExpires');

    return res.json({ 
      success: true, 
      message: 'User reports retrieved successfully',
      data: items.map(sanitize)
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid report ID' });

    const item = await ReportUser.findById(id)
      .populate('reporterId', '-password -passwordResetToken -passwordResetExpires')
      .populate('reportedUserId', '-password -passwordResetToken -passwordResetExpires');
    if (!item) return res.status(404).json({ success: false, message: 'Report not found' });

    return res.json({ 
      success: true, 
      message: 'User report retrieved successfully',
      data: {
        report: sanitize(item)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateReport = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid report ID' });

    const item = await ReportUser.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'Report not found' });

    const payload = {};
    if (req.user.role === 'admin') {
      if (req.body.reportedUserId && mongoose.Types.ObjectId.isValid(req.body.reportedUserId)) payload.reportedUserId = req.body.reportedUserId;
      if (req.body.reporterId && mongoose.Types.ObjectId.isValid(req.body.reporterId)) payload.reporterId = req.body.reporterId;
    }

    const updated = await ReportUser.findByIdAndUpdate(id, payload, { new: true })
      .populate('reporterId', '-password -passwordResetToken -passwordResetExpires')
      .populate('reportedUserId', '-password -passwordResetToken -passwordResetExpires');

    return res.json({ 
      success: true, 
      message: 'User report updated successfully',
      data: {
        report: sanitize(updated)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid report ID' });

    const item = await ReportUser.findById(id);
    if (!item) return res.status(404).json({ success: false, message: 'Report not found' });

    if (req.user.role !== 'admin' && item.reporterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this report' });
    }

    await ReportUser.findByIdAndDelete(id);
    return res.json({ 
      success: true, 
      message: 'Report deleted successfully'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
