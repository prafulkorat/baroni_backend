import bcrypt from 'bcryptjs';
import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import User from '../models/User.js';
import { createAccessToken, createRefreshToken } from '../utils/token.js';
import { createSanitizedUserResponse } from '../utils/userDataHelper.js';
import jwt from 'jsonwebtoken';
import Otp from '../models/otp.js';
import crypto from 'crypto';
import axios from 'axios';
import qs from 'qs';
import { normalizeContact, removePlusPrefix } from '../utils/normalizeContact.js';

const sanitizeUser = (user) => createSanitizedUserResponse(user);

function generate6DigitOtp() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

// Admin Sign In Controller
export const adminSignIn = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // Find admin user by email
    const admin = await User.findOne({ 
      email: email.toLowerCase(), 
      role: 'admin',
      isDeleted: { $ne: true }
    });

    if (!admin) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid admin credentials' 
      });
    }

    // Check if admin has password
    if (!admin.password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Admin account not properly configured' 
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid admin credentials' 
      });
    }

    // Increment session version to invalidate old tokens
    admin.sessionVersion = (typeof admin.sessionVersion === 'number' ? admin.sessionVersion : 0) + 1;
    await admin.save();

    // Generate tokens
    const accessToken = createAccessToken({ 
      userId: admin._id, 
      sessionVersion: admin.sessionVersion 
    });
    const refreshToken = createRefreshToken({ 
      userId: admin._id, 
      sessionVersion: admin.sessionVersion 
    });

    return res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        admin: sanitizeUser(admin),
        tokens: { accessToken, refreshToken }
      }
    });

  } catch (err) {
    console.error('Admin sign in error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

// Admin Forgot Password - Send OTP
export const adminForgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find admin user by email
    const admin = await User.findOne({ 
      email: email.toLowerCase(), 
      role: 'admin',
      isDeleted: { $ne: true }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found'
      });
    }

    // Generate OTP
    const otp = generate6DigitOtp();
    const token = jwt.sign({ email: email.toLowerCase(), otp }, "this is you", { expiresIn: "5m" });

    // Store OTP in database
    await Otp.create({
      contact: email.toLowerCase(), // Using email as contact for admin
      otp,
      token,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    // For admin, we'll send OTP via email (you can implement email service)
    // For now, we'll return the OTP in development mode
    const isDev = process.env.NODE_ENV === 'development';

    return res.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        token,
        ...(isDev && { otp }) // Only show OTP in development
      }
    });

  } catch (err) {
    console.error('Admin forgot password error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP'
    });
  }
};

// Admin Reset Password with OTP
export const adminResetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { email, otp, token, newPassword } = req.body;

    if (!email || !otp || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, token, and new password are required'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, "this is you");
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Check if email matches
    if (decoded.email !== email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Email mismatch'
      });
    }

    // Find OTP record
    const otpRecord = await Otp.findOne({ contact: email.toLowerCase() }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(404).json({
        success: false,
        message: 'OTP not found or expired'
      });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP'
      });
    }

    // Find admin user
    const admin = await User.findOne({ 
      email: email.toLowerCase(), 
      role: 'admin',
      isDeleted: { $ne: true }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update admin password
    admin.password = hashedPassword;
    admin.passwordResetToken = undefined;
    admin.passwordResetExpires = undefined;
    await admin.save();

    // Delete used OTP
    await Otp.deleteOne({ _id: otpRecord._id });

    return res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (err) {
    console.error('Admin reset password error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
};

// Admin Change Password (for logged-in admin)
export const adminChangePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Get fresh admin data
    const adminData = await User.findById(admin._id);
    if (!adminData) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Verify current password
    if (!adminData.password) {
      return res.status(400).json({
        success: false,
        message: 'Admin account not properly configured'
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, adminData.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    adminData.password = hashedPassword;
    await adminData.save();

    return res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (err) {
    console.error('Admin change password error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

// Create Admin User (for initial setup)
export const createAdmin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and name are required'
      });
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      email: email.toLowerCase(), 
      role: 'admin' 
    });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin user
    const admin = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: 'admin',
      isDev: false
    });

    return res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: {
        admin: sanitizeUser(admin)
      }
    });

  } catch (err) {
    console.error('Create admin error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create admin'
    });
  }
};

// Get Admin Profile
export const getAdminProfile = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Get fresh admin data
    const adminData = await User.findById(admin._id);
    if (!adminData) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    return res.json({
      success: true,
      message: 'Admin profile retrieved successfully',
      data: {
        admin: sanitizeUser(adminData)
      }
    });

  } catch (err) {
    console.error('Get admin profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get admin profile'
    });
  }
};

// Update Admin Profile
export const updateAdminProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { name, email } = req.body;

    // Get fresh admin data
    const adminData = await User.findById(admin._id);
    if (!adminData) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Update fields
    if (name) adminData.name = name;
    if (email) {
      // Check if email is already in use by another user
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: admin._id } 
      });
      
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use'
        });
      }
      
      adminData.email = email.toLowerCase();
    }

    await adminData.save();

    return res.json({
      success: true,
      message: 'Admin profile updated successfully',
      data: {
        admin: sanitizeUser(adminData)
      }
    });

  } catch (err) {
    console.error('Update admin profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update admin profile'
    });
  }
};

// Database Cleanup - Delete all data except Category and Config
export const databaseCleanup = async (req, res) => {
  try {
    const { password } = req.body;

    // Check password
    if (!password || password !== 'Heric@1211') {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Import all models
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;

    // Collections to delete (all except categories and configs)
    const collectionsToDelete = [
      'appointments',
      'availabilities', 
      'contactsupports',
      'conversations',
      'dedications',
      'dedicationrequests',
      'dedicationsamples',
      'liveshows',
      'liveshowattendances',
      'messages',
      'notifications',
      'otps',
      'reportusers',
      'reviews',
      'services',
      'transactions',
      'users'
    ];

    const deletedCollections = [];
    const errors = [];

    // Delete each collection
    for (const collectionName of collectionsToDelete) {
      try {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({});
        deletedCollections.push({
          collection: collectionName,
          deletedCount: result.deletedCount
        });
        console.log(`Deleted ${result.deletedCount} documents from ${collectionName}`);
      } catch (error) {
        console.error(`Error deleting collection ${collectionName}:`, error);
        errors.push({
          collection: collectionName,
          error: error.message
        });
      }
    }

    return res.json({
      success: true,
      message: 'Database cleanup completed',
      data: {
        deletedCollections,
        errors: errors.length > 0 ? errors : undefined,
        preservedCollections: ['categories', 'configs']
      }
    });

  } catch (err) {
    console.error('Database cleanup error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to cleanup database',
      error: err.message
    });
  }
};