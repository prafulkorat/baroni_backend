import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import ContactSupport from '../models/ContactSupport.js';
import User from '../models/User.js';
import { uploadFile } from '../utils/uploadFile.js';
import mongoose from 'mongoose';

// Create a new support ticket
export const createSupportTicket = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { issueType, title, description, priority, category } = req.body;
    const userId = req.user.id;

    // Map 'Autre' to 'other' for consistency
    let mappedIssueType = issueType;
    if (issueType === 'Autre') {
      mappedIssueType = 'other';
    }

    let imageUrl = null;

    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => file.fieldname === 'image');
      if (imageFile) {
        try {
          imageUrl = await uploadFile(imageFile.buffer);
        } catch (uploadError) {
          return res.status(400).json({
            success: false,
            message: 'Error uploading image: ' + uploadError.message
          });
        }
      }
    }

    // Auto-generate title from description if not provided
    let finalTitle = title;
    if (!finalTitle && description) {
      finalTitle = description.substring(0, 50).trim();
      if (description.length > 50) {
        finalTitle += '...';
      }
    }

    const supportTicket = await ContactSupport.create({
      issueType: mappedIssueType,
      title: finalTitle,
      description,
      image: imageUrl,
      userId,
      priority: priority || 'medium',
      category: category || 'general'
    });

    // Populate user details
    await supportTicket.populate('userId', 'name email baroniId profilePic');

    return res.status(201).json({
      success: true,
      message: 'Support ticket created successfully',
      data: supportTicket
    });
  } catch (err) {
    console.error('Error creating support ticket:', err);
    return res.status(500).json({
      success: false,
      message: 'Error creating support ticket',
      error: err.message
    });
  }
};

// Get all support tickets for a user
export const getUserSupportTickets = async (req, res) => {
  try {
    const userId = req.user.id;

    const tickets = await ContactSupport.find({ userId, isDeleted: false })
      .populate('userId', 'name email baroniId profilePic')
      .populate('assignedTo', 'name email baroniId')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Support tickets retrieved successfully',
      data: tickets
    });
  } catch (err) {
    console.error('Error fetching user support tickets:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching support tickets',
      error: err.message
    });
  }
};

// Get a specific support ticket by ID
export const getSupportTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID'
      });
    }

    const ticket = await ContactSupport.findById(id)
      .populate('userId', 'name email baroniId profilePic')
      .populate('assignedTo', 'name email baroniId')
      .populate('resolvedBy', 'name email baroniId')
      .populate('messages.sender', 'name email baroniId profilePic');

    if (!ticket || ticket.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    // Check if user owns the ticket or is admin
    if (ticket.userId._id.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Support ticket retrieved successfully',
      data: ticket
    });
  } catch (err) {
    console.error('Error fetching support ticket:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching support ticket',
      error: err.message
    });
  }
};

// Update a support ticket
export const updateSupportTicket = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { id } = req.params;
    const userId = req.user.id;
    const { issueType, title, description, priority, category } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID'
      });
    }

    const ticket = await ContactSupport.findById(id);
    if (!ticket || ticket.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    // Check if user owns the ticket or is admin
    if (ticket.userId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    let imageUrl = ticket.image;

    // Handle image upload if new image is provided
    if (req.files && req.files.length > 0) {
      const imageFile = req.files.find(file => file.fieldname === 'image');
      if (imageFile) {
        try {
          imageUrl = await uploadFile(imageFile.buffer);
        } catch (uploadError) {
          return res.status(400).json({
            success: false,
            message: 'Error uploading image: ' + uploadError.message
          });
        }
      }
    }

    const updateData = {};
    if (issueType !== undefined) updateData.issueType = issueType;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (category !== undefined) updateData.category = category;
    if (imageUrl !== ticket.image) updateData.image = imageUrl;

    const updatedTicket = await ContactSupport.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'name email baroniId profilePic')
     .populate('assignedTo', 'name email baroniId');

    return res.status(200).json({
      success: true,
      message: 'Support ticket updated successfully',
      data: updatedTicket
    });
  } catch (err) {
    console.error('Error updating support ticket:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating support ticket',
      error: err.message
    });
  }
};

// Delete a support ticket
export const deleteSupportTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID'
      });
    }

    const ticket = await ContactSupport.findById(id);
    if (!ticket || ticket.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    // Check if user owns the ticket or is admin
    if (ticket.userId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Soft delete the ticket
    await ticket.softDelete();

    return res.status(200).json({
      success: true,
      message: 'Support ticket deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting support ticket:', err);
    return res.status(500).json({
      success: false,
      message: 'Error deleting support ticket',
      error: err.message
    });
  }
};

// Admin: Get all support tickets with filtering and search
export const getAllSupportTickets = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { 
      page = 1, 
      limit = 10, 
      status, 
      priority, 
      issueType, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      assignedTo
    } = req.query;

    const query = { isDeleted: false };

    // Filter by status
    if (status && ['open', 'in_progress', 'resolved', 'closed', 'cancelled'].includes(status)) {
      query.status = status;
    }

    // Filter by priority
    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      query.priority = priority;
    }

    // Filter by issue type
    if (issueType) {
      query.issueType = issueType;
    }

    // Filter by assigned admin
    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
      query.assignedTo = assignedTo;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { ticketId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'userId.name': { $regex: search, $options: 'i' } },
        { 'userId.baroniId': { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const tickets = await ContactSupport.find(query)
      .populate('userId', 'name email baroniId profilePic')
      .populate('assignedTo', 'name email baroniId')
      .populate('resolvedBy', 'name email baroniId')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await ContactSupport.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: 'Support tickets retrieved successfully',
      data: {
        tickets,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalTickets: total,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (err) {
    console.error('Error fetching all support tickets:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching support tickets',
      error: err.message
    });
  }
};

// Admin: Update ticket status
export const updateTicketStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { id } = req.params;
    const { status, message } = req.body;
    const adminId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID'
      });
    }

    const ticket = await ContactSupport.findById(id);
    if (!ticket || ticket.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    // Update ticket status
    await ticket.updateStatus(status, adminId);

    // Add message if provided
    if (message && message.trim()) {
      await ticket.addMessage(adminId, message, false);
    }

    // Populate updated ticket
    await ticket.populate([
      { path: 'userId', select: 'name email baroniId profilePic' },
      { path: 'assignedTo', select: 'name email baroniId' },
      { path: 'resolvedBy', select: 'name email baroniId' },
      { path: 'messages.sender', select: 'name email baroniId profilePic' }
    ]);

    return res.status(200).json({
      success: true,
      message: 'Ticket status updated successfully',
      data: ticket
    });
  } catch (err) {
    console.error('Error updating ticket status:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating ticket status',
      error: err.message
    });
  }
};

// Admin: Assign ticket to admin
export const assignTicket = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { id } = req.params;
    const { assignedTo } = req.body;
    const adminId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assigned admin ID'
      });
    }

    const ticket = await ContactSupport.findById(id);
    if (!ticket || ticket.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    // Verify assigned admin exists and is admin
    const assignedAdmin = await User.findById(assignedTo);
    if (!assignedAdmin || assignedAdmin.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin user'
      });
    }

    // Assign ticket
    await ticket.assignTicket(assignedTo, adminId);

    // Populate updated ticket
    await ticket.populate([
      { path: 'userId', select: 'name email baroniId profilePic' },
      { path: 'assignedTo', select: 'name email baroniId' },
      { path: 'messages.sender', select: 'name email baroniId profilePic' }
    ]);

    return res.status(200).json({
      success: true,
      message: 'Ticket assigned successfully',
      data: ticket
    });
  } catch (err) {
    console.error('Error assigning ticket:', err);
    return res.status(500).json({
      success: false,
      message: 'Error assigning ticket',
      error: err.message
    });
  }
};

// Add message to ticket
export const addMessageToTicket = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { id } = req.params;
    const { message, isInternal = false } = req.body;
    const senderId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket ID'
      });
    }

    const ticket = await ContactSupport.findById(id);
    if (!ticket || ticket.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Support ticket not found'
      });
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isOwner = ticket.userId.toString() === senderId;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Add message
    await ticket.addMessage(senderId, message, isInternal);

    // Populate updated ticket
    await ticket.populate([
      { path: 'userId', select: 'name email baroniId profilePic' },
      { path: 'assignedTo', select: 'name email baroniId' },
      { path: 'messages.sender', select: 'name email baroniId profilePic' }
    ]);

    return res.status(200).json({
      success: true,
      message: 'Message added successfully',
      data: ticket
    });
  } catch (err) {
    console.error('Error adding message to ticket:', err);
    return res.status(500).json({
      success: false,
      message: 'Error adding message',
      error: err.message
    });
  }
};

// Get ticket statistics for admin dashboard
export const getTicketStatistics = async (req, res) => {
  try {
    const stats = await ContactSupport.getTicketStats();

    // Get additional metrics
    const totalTickets = await ContactSupport.countDocuments({ isDeleted: false });
    const avgResolutionTime = await ContactSupport.aggregate([
      { $match: { isDeleted: false, resolutionTime: { $exists: true } } },
      { $group: { _id: null, avgTime: { $avg: '$resolutionTime' } } }
    ]);

    const firstResponseTime = await ContactSupport.aggregate([
      { $match: { isDeleted: false, firstResponseAt: { $exists: true } } },
      {
        $group: {
          _id: null,
          avgFirstResponse: {
            $avg: {
              $divide: [
                { $subtract: ['$firstResponseAt', '$createdAt'] },
                60000 // Convert to minutes
              ]
            }
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      message: 'Ticket statistics retrieved successfully',
      data: {
        ...stats,
        totalTickets,
        avgResolutionTime: avgResolutionTime[0]?.avgTime || 0,
        avgFirstResponseTime: firstResponseTime[0]?.avgFirstResponse || 0
      }
    });
  } catch (err) {
    console.error('Error fetching ticket statistics:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching ticket statistics',
      error: err.message
    });
  }
};

// Get admin users for assignment
export const getAdminUsers = async (req, res) => {
  try {
    const admins = await User.find({ 
      role: 'admin', 
      isDeleted: false 
    }).select('name email baroniId profilePic');

    return res.status(200).json({
      success: true,
      message: 'Admin users retrieved successfully',
      data: admins
    });
  } catch (err) {
    console.error('Error fetching admin users:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching admin users',
      error: err.message
    });
  }
};
