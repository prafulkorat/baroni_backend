import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import Ad from '../models/Ad.js';
import { uploadFile } from '../utils/uploadFile.js';
import mongoose from 'mongoose';

/**
 * Create a new ad
 * POST /api/ads
 */
export const createAd = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage || 'Validation failed' 
      });
    }

    const { title, link, budget, targetAudience, targetCountry, priority, startDate, endDate } = req.body;
    const createdBy = req.user.id;

    let imageUrl = null;

    // Handle image upload
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

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image is required'
      });
    }

    const adData = {
      title,
      link: link || undefined,
      image: imageUrl,
      createdBy,
      budget: budget ? parseFloat(budget) : undefined,
      targetAudience: targetAudience || 'all',
      targetCountry: targetCountry || undefined,
      priority: priority || 'medium',
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : undefined
    };

    const ad = await Ad.create(adData);

    // Populate creator details
    await ad.populate('createdBy', 'name email baroniId');

    return res.status(201).json({
      success: true,
      message: 'Ad created successfully',
      data: ad
    });
  } catch (err) {
    console.error('Error creating ad:', err);
    return res.status(500).json({
      success: false,
      message: 'Error creating ad',
      error: err.message
    });
  }
};

/**
 * Get all ads for the authenticated user
 * GET /api/ads
 */
export const getUserAds = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage || 'Validation failed' 
      });
    }

    const { page = 1, limit = 10, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const userId = req.user.id;

    const query = { 
      createdBy: userId, 
      isDeleted: false 
    };

    // Filter by status if provided
    if (status && ['active', 'paused', 'draft', 'expired'].includes(status)) {
      query.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const ads = await Ad.find(query)
      .populate('createdBy', 'name email baroniId')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Ad.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: 'Ads retrieved successfully',
      data: {
        ads,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalAds: total,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (err) {
    console.error('Error getting user ads:', err);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving ads',
      error: err.message
    });
  }
};

/**
 * Get a specific ad by ID
 * GET /api/ads/:id
 */
export const getAd = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage || 'Validation failed' 
      });
    }

    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ad ID'
      });
    }

    const ad = await Ad.findOne({ 
      _id: id, 
      createdBy: userId, 
      isDeleted: false 
    }).populate('createdBy', 'name email baroniId');

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ad retrieved successfully',
      data: ad
    });
  } catch (err) {
    console.error('Error getting ad:', err);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving ad',
      error: err.message
    });
  }
};

/**
 * Update an ad
 * PUT /api/ads/:id
 */
export const updateAd = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage || 'Validation failed' 
      });
    }

    const { id } = req.params;
    const userId = req.user.id;
    const { title, link, budget, targetAudience, targetCountry, priority, startDate, endDate, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ad ID'
      });
    }

    const ad = await Ad.findOne({ 
      _id: id, 
      createdBy: userId, 
      isDeleted: false 
    });

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    let imageUrl = ad.image;

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

    // Update ad fields
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (link !== undefined) updateData.link = link;
    if (imageUrl !== ad.image) updateData.image = imageUrl;
    if (budget !== undefined) updateData.budget = budget ? parseFloat(budget) : undefined;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
    if (targetCountry !== undefined) updateData.targetCountry = targetCountry;
    if (priority !== undefined) updateData.priority = priority;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : undefined;
    if (status !== undefined) updateData.status = status;

    const updatedAd = await Ad.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email baroniId');

    return res.status(200).json({
      success: true,
      message: 'Ad updated successfully',
      data: updatedAd
    });
  } catch (err) {
    console.error('Error updating ad:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating ad',
      error: err.message
    });
  }
};

/**
 * Delete an ad (soft delete)
 * DELETE /api/ads/:id
 */
export const deleteAd = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage || 'Validation failed' 
      });
    }

    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ad ID'
      });
    }

    const ad = await Ad.findOne({ 
      _id: id, 
      createdBy: userId, 
      isDeleted: false 
    });

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Soft delete the ad
    await ad.softDelete();

    return res.status(200).json({
      success: true,
      message: 'Ad deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting ad:', err);
    return res.status(500).json({
      success: false,
      message: 'Error deleting ad',
      error: err.message
    });
  }
};

/**
 * Get active ads for display (public endpoint)
 * GET /api/ads/public/active
 */
export const getActiveAds = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage || 'Validation failed' 
      });
    }

    const { limit = 10, country, audience } = req.query;
    const now = new Date();

    const query = {
      status: 'active',
      isDeleted: false,
      startDate: { $lte: now },
      $or: [
        { endDate: { $exists: false } },
        { endDate: { $gte: now } }
      ]
    };

    // Filter by target audience
    if (audience && ['all', 'fans', 'stars'].includes(audience)) {
      query.$or = [
        { targetAudience: 'all' },
        { targetAudience: audience }
      ];
    }

    // Filter by country if provided
    if (country) {
      query.$or = [
        { targetCountry: { $exists: false } },
        { targetCountry: country }
      ];
    }

    const ads = await Ad.find(query)
      .populate('createdBy', 'name baroniId')
      .sort({ priority: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Increment impressions for each ad
    const impressionPromises = ads.map(ad => 
      Ad.findByIdAndUpdate(ad._id, { $inc: { 'metrics.impressions': 1 } })
    );
    await Promise.all(impressionPromises);

    return res.status(200).json({
      success: true,
      message: 'Active ads retrieved successfully',
      data: ads
    });
  } catch (err) {
    console.error('Error getting active ads:', err);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving active ads',
      error: err.message
    });
  }
};

/**
 * Track ad click
 * POST /api/ads/:id/click
 */
export const trackAdClick = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ad ID'
      });
    }

    const ad = await Ad.findById(id);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Increment click count
    await ad.incrementClicks();

    return res.status(200).json({
      success: true,
      message: 'Click tracked successfully'
    });
  } catch (err) {
    console.error('Error tracking ad click:', err);
    return res.status(500).json({
      success: false,
      message: 'Error tracking click',
      error: err.message
    });
  }
};

/**
 * Get ad analytics
 * GET /api/ads/:id/analytics
 */
export const getAdAnalytics = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ 
        success: false, 
        message: errorMessage || 'Validation failed' 
      });
    }

    const { id } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ad ID'
      });
    }

    const ad = await Ad.findOne({ 
      _id: id, 
      createdBy: userId, 
      isDeleted: false 
    });

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    const analytics = {
      impressions: ad.metrics.impressions,
      clicks: ad.metrics.clicks,
      views: ad.metrics.views,
      clickThroughRate: ad.metrics.impressions > 0 ? 
        ((ad.metrics.clicks / ad.metrics.impressions) * 100).toFixed(2) : 0,
      budget: ad.budget,
      spentAmount: ad.spentAmount,
      remainingBudget: ad.budget ? ad.budget - ad.spentAmount : null,
      status: ad.status,
      createdAt: ad.createdAt,
      startDate: ad.startDate,
      endDate: ad.endDate
    };

    return res.status(200).json({
      success: true,
      message: 'Ad analytics retrieved successfully',
      data: analytics
    });
  } catch (err) {
    console.error('Error getting ad analytics:', err);
    return res.status(500).json({
      success: false,
      message: 'Error retrieving ad analytics',
      error: err.message
    });
  }
};
