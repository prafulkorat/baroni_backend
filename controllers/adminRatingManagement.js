import { validationResult } from 'express-validator';
import { getFirstValidationError } from '../utils/validationHelper.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { sanitizeUserData } from '../utils/userDataHelper.js';

// Helper function to recalculate star's average rating after visibility changes
const recalculateStarRating = async (starId) => {
  try {
    // Calculate average using ALL reviews (both visible and hidden)
    const reviews = await Review.find({ 
      starId
    });
    
    console.log(`Recalculating rating for star ${starId}, found ${reviews.length} reviews`);
    
    if (reviews.length === 0) {
      await User.findByIdAndUpdate(starId, {
        averageRating: 0,
        totalReviews: 0
      });
      console.log(`Recalculated star ${starId} with 0 rating and 0 reviews`);
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    
    const updatedUser = await User.findByIdAndUpdate(starId, {
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
      totalReviews: reviews.length
    }, { new: true });
    
    console.log(`Recalculated star ${starId} with average rating: ${Math.round(averageRating * 10) / 10} and total reviews: ${reviews.length}`);
    console.log(`Updated user data:`, { averageRating: updatedUser?.averageRating, totalReviews: updatedUser?.totalReviews });
  } catch (error) {
    console.error('Error recalculating star rating:', error);
  }
};

// Admin: Get all reviews with visibility management
export const getAllReviews = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { 
      page = 1, 
      limit = 10, 
      starId, 
      reviewType, 
      isVisible, 
      isDefaultRating,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};

    // Filter by star ID
    if (starId && mongoose.Types.ObjectId.isValid(starId)) {
      query.starId = starId;
    }

    // Filter by review type
    if (reviewType && ['appointment', 'dedication', 'live_show', 'system'].includes(reviewType)) {
      query.reviewType = reviewType;
    }

    // Filter by visibility
    if (isVisible !== undefined) {
      query.isVisible = isVisible === 'true';
    }

    // Filter by default rating
    if (isDefaultRating !== undefined) {
      query.isDefaultRating = isDefaultRating === 'true';
    }

    // Search functionality
    if (search) {
      query.$or = [
        { comment: { $regex: search, $options: 'i' } },
        { 'reviewerId.name': { $regex: search, $options: 'i' } },
        { 'starId.name': { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const reviews = await Review.find(query)
      .populate('reviewerId', 'name pseudo profilePic baroniId')
      .populate('starId', 'name pseudo profilePic baroniId')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Review.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: 'Reviews retrieved successfully',
      data: {
        reviews: reviews.map(review => ({
          id: review._id,
          rating: review.rating,
          comment: review.comment,
          reviewer: review.reviewerId ? sanitizeUserData(review.reviewerId) : null,
          star: review.starId ? sanitizeUserData(review.starId) : null,
          reviewType: review.reviewType,
          isVisible: review.isVisible,
          isDefaultRating: review.isDefaultRating,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalReviews: total,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (err) {
    console.error('Error fetching all reviews:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: err.message
    });
  }
};

// Admin: Update review visibility
export const updateReviewVisibility = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { reviewId } = req.params;
    const { isVisible } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Update visibility
    review.isVisible = isVisible;
    await review.save();

    // Recalculate star's average rating
    await recalculateStarRating(review.starId);

    // Populate updated review
    await review.populate([
      { path: 'reviewerId', select: 'name pseudo profilePic baroniId' },
      { path: 'starId', select: 'name pseudo profilePic baroniId' }
    ]);

    return res.status(200).json({
      success: true,
      message: `Review visibility updated to ${isVisible ? 'visible' : 'hidden'}`,
      data: {
        review: {
          id: review._id,
          rating: review.rating,
          comment: review.comment,
          reviewer: review.reviewerId ? sanitizeUserData(review.reviewerId) : null,
          star: review.starId ? sanitizeUserData(review.starId) : null,
          reviewType: review.reviewType,
          isVisible: review.isVisible,
          isDefaultRating: review.isDefaultRating,
          updatedAt: review.updatedAt
        }
      }
    });
  } catch (err) {
    console.error('Error updating review visibility:', err);
    return res.status(500).json({
      success: false,
      message: 'Error updating review visibility',
      error: err.message
    });
  }
};

// Admin: Bulk update review visibility
export const bulkUpdateReviewVisibility = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { reviewIds, isVisible } = req.body;

    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review IDs array is required'
      });
    }

    // Validate all review IDs
    const validReviewIds = reviewIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validReviewIds.length !== reviewIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some review IDs are invalid'
      });
    }

    // Update visibility for all reviews
    const updateResult = await Review.updateMany(
      { _id: { $in: validReviewIds } },
      { isVisible: isVisible }
    );

    // Get all affected stars and recalculate their ratings
    const affectedReviews = await Review.find({ _id: { $in: validReviewIds } }).select('starId');
    const uniqueStarIds = [...new Set(affectedReviews.map(review => review.starId.toString()))];
    
    // Recalculate ratings for all affected stars
    await Promise.all(uniqueStarIds.map(starId => recalculateStarRating(starId)));

    return res.status(200).json({
      success: true,
      message: `Visibility updated for ${updateResult.modifiedCount} reviews`,
      data: {
        modifiedCount: updateResult.modifiedCount,
        affectedStars: uniqueStarIds.length
      }
    });
  } catch (err) {
    console.error('Error bulk updating review visibility:', err);
    return res.status(500).json({
      success: false,
      message: 'Error bulk updating review visibility',
      error: err.message
    });
  }
};

// Admin: Get review statistics
export const getReviewStatistics = async (req, res) => {
  try {
    const stats = await Review.aggregate([
      {
        $group: {
          _id: {
            isVisible: '$isVisible',
            isDefaultRating: '$isDefaultRating',
            reviewType: '$reviewType'
          },
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    const totalReviews = await Review.countDocuments();
    const visibleReviews = await Review.countDocuments({ isVisible: true });
    const hiddenReviews = await Review.countDocuments({ isVisible: false });
    const defaultRatings = await Review.countDocuments({ isDefaultRating: true });

    const statistics = {
      total: totalReviews,
      visible: visibleReviews,
      hidden: hiddenReviews,
      defaultRatings: defaultRatings,
      breakdown: stats.map(stat => ({
        isVisible: stat._id.isVisible,
        isDefaultRating: stat._id.isDefaultRating,
        reviewType: stat._id.reviewType,
        count: stat.count,
        avgRating: Math.round(stat.avgRating * 10) / 10
      }))
    };

    return res.status(200).json({
      success: true,
      message: 'Review statistics retrieved successfully',
      data: statistics
    });
  } catch (err) {
    console.error('Error fetching review statistics:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching review statistics',
      error: err.message
    });
  }
};

// Admin: Get stars with default ratings
export const getStarsWithDefaultRatings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessage = getFirstValidationError(errors);
      return res.status(400).json({ success: false, message: errorMessage || 'Validation failed' });
    }

    const { page = 1, limit = 10 } = req.query;

    const starsWithDefaultRatings = await Review.aggregate([
      { $match: { isDefaultRating: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'starId',
          foreignField: '_id',
          as: 'star'
        }
      },
      { $unwind: '$star' },
      {
        $group: {
          _id: '$starId',
          star: { $first: '$star' },
          defaultRating: { $first: '$rating' },
          defaultComment: { $first: '$comment' },
          createdAt: { $first: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'starId',
          as: 'allReviews'
        }
      },
      {
        $addFields: {
          visibleReviews: {
            $size: {
              $filter: {
                input: '$allReviews',
                cond: { $eq: ['$$this.isVisible', true] }
              }
            }
          },
          totalReviews: { $size: '$allReviews' }
        }
      },
      {
        $project: {
          _id: 1,
          star: {
            _id: '$star._id',
            name: '$star.name',
            pseudo: '$star.pseudo',
            baroniId: '$star.baroniId',
            profilePic: '$star.profilePic',
            averageRating: '$star.averageRating'
          },
          defaultRating: 1,
          defaultComment: 1,
          visibleReviews: 1,
          totalReviews: 1,
          createdAt: 1
        }
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) }
    ]);

    const totalStars = await Review.distinct('starId', { isDefaultRating: true });

    return res.status(200).json({
      success: true,
      message: 'Stars with default ratings retrieved successfully',
      data: {
        stars: starsWithDefaultRatings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalStars.length / limit),
          totalStars: totalStars.length,
          hasNextPage: page * limit < totalStars.length,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (err) {
    console.error('Error fetching stars with default ratings:', err);
    return res.status(500).json({
      success: false,
      message: 'Error fetching stars with default ratings',
      error: err.message
    });
  }
};
