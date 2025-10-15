import Review from '../models/Review.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Get all reviews with filtering, searching, and pagination
export const getAllReviews = async (req, res) => {
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
      starId = '',
      reviewerId = '',
      rating = '',
      reviewType = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build filter object
    const filter = {};

    // Add search filter (search in reviewer name, star name, or comment)
    if (search) {
      const reviewerIds = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { pseudo: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      const starIds = await User.find({
        role: 'star',
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { pseudo: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      filter.$or = [
        { reviewerId: { $in: reviewerIds } },
        { starId: { $in: starIds } },
        { comment: { $regex: search, $options: 'i' } }
      ];
    }

    // Add star filter
    if (starId && mongoose.Types.ObjectId.isValid(starId)) {
      filter.starId = starId;
    }

    // Add reviewer filter
    if (reviewerId && mongoose.Types.ObjectId.isValid(reviewerId)) {
      filter.reviewerId = reviewerId;
    }

    // Add rating filter
    if (rating && !isNaN(rating)) {
      filter.rating = parseInt(rating);
    }

    // Add review type filter
    if (reviewType && reviewType !== 'all') {
      filter.reviewType = reviewType;
    }

    // Get reviews with pagination
    const reviews = await Review.find(filter)
      .populate('reviewerId', 'name pseudo profilePic')
      .populate('starId', 'name pseudo profilePic role')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalReviews = await Review.countDocuments(filter);

    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // Get review type distribution
    const typeDistribution = await Review.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$reviewType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get average rating
    const avgRatingResult = await Review.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const avgRating = avgRatingResult[0]?.averageRating || 0;

    return res.json({
      success: true,
      message: 'Reviews retrieved successfully',
      data: {
        reviews: reviews.map(review => ({
          id: review._id,
          rating: review.rating,
          comment: review.comment,
          reviewType: review.reviewType,
          reviewer: {
            id: review.reviewerId._id,
            name: review.reviewerId.name,
            pseudo: review.reviewerId.pseudo,
            profilePic: review.reviewerId.profilePic
          },
          star: {
            id: review.starId._id,
            name: review.starId.name,
            pseudo: review.starId.pseudo,
            profilePic: review.starId.profilePic,
            role: review.starId.role
          },
          appointmentId: review.appointmentId,
          dedicationRequestId: review.dedicationRequestId,
          liveShowId: review.liveShowId,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalReviews,
          pages: Math.ceil(totalReviews / parseInt(limit))
        },
        stats: {
          averageRating: Math.round(avgRating * 10) / 10,
          totalReviews,
          ratingDistribution: ratingDistribution.map(r => ({
            rating: r._id,
            count: r.count
          })),
          typeDistribution: typeDistribution.map(t => ({
            type: t._id,
            count: t.count
          }))
        },
        filters: {
          reviewTypes: ['appointment', 'dedication', 'live_show'],
          ratings: [1, 2, 3, 4, 5]
        }
      }
    });

  } catch (err) {
    console.error('Get all reviews error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get reviews'
    });
  }
};

// Get review details by ID
export const getReviewDetails = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID'
      });
    }

    const review = await Review.findById(reviewId)
      .populate('reviewerId', 'name pseudo profilePic email contact')
      .populate('starId', 'name pseudo profilePic role email contact')
      .lean();

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    return res.json({
      success: true,
      message: 'Review details retrieved successfully',
      data: {
        review: {
          id: review._id,
          rating: review.rating,
          comment: review.comment,
          reviewType: review.reviewType,
          reviewer: {
            id: review.reviewerId._id,
            name: review.reviewerId.name,
            pseudo: review.reviewerId.pseudo,
            profilePic: review.reviewerId.profilePic,
            email: review.reviewerId.email,
            contact: review.reviewerId.contact
          },
          star: {
            id: review.starId._id,
            name: review.starId.name,
            pseudo: review.starId.pseudo,
            profilePic: review.starId.profilePic,
            role: review.starId.role,
            email: review.starId.email,
            contact: review.starId.contact
          },
          appointmentId: review.appointmentId,
          dedicationRequestId: review.dedicationRequestId,
          liveShowId: review.liveShowId,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt
        }
      }
    });

  } catch (err) {
    console.error('Get review details error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get review details'
    });
  }
};

// Update review
export const updateReview = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { reviewId } = req.params;
    const { rating, comment } = req.body;

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

    // Update fields
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
      }
      review.rating = rating;
    }

    if (comment !== undefined) {
      review.comment = comment;
    }

    await review.save();

    return res.json({
      success: true,
      message: 'Review updated successfully',
      data: {
        review: {
          id: review._id,
          rating: review.rating,
          comment: review.comment,
          reviewType: review.reviewType,
          updatedAt: review.updatedAt
        }
      }
    });

  } catch (err) {
    console.error('Update review error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update review'
    });
  }
};

// Delete review
export const deleteReview = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { reviewId } = req.params;

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

    await Review.deleteOne({ _id: reviewId });

    return res.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (err) {
    console.error('Delete review error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete review'
    });
  }
};

// Get reviews for a specific star
export const getStarReviews = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const {
      page = 1,
      limit = 20,
      rating = '',
      reviewType = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build filter object
    const filter = { starId };

    // Add rating filter
    if (rating && !isNaN(rating)) {
      filter.rating = parseInt(rating);
    }

    // Add review type filter
    if (reviewType && reviewType !== 'all') {
      filter.reviewType = reviewType;
    }

    // Get reviews with pagination
    const reviews = await Review.find(filter)
      .populate('reviewerId', 'name pseudo profilePic')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalReviews = await Review.countDocuments(filter);

    // Get star's rating statistics
    const ratingStats = await Review.aggregate([
      { $match: { starId: mongoose.Types.ObjectId(starId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    const stats = ratingStats[0] || {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: []
    };

    // Calculate rating distribution
    const distribution = [1, 2, 3, 4, 5].map(rating => ({
      rating,
      count: stats.ratingDistribution.filter(r => r === rating).length
    }));

    return res.json({
      success: true,
      message: 'Star reviews retrieved successfully',
      data: {
        star: {
          id: star._id,
          name: star.name,
          pseudo: star.pseudo,
          profilePic: star.profilePic
        },
        reviews: reviews.map(review => ({
          id: review._id,
          rating: review.rating,
          comment: review.comment,
          reviewType: review.reviewType,
          reviewer: {
            id: review.reviewerId._id,
            name: review.reviewerId.name,
            pseudo: review.reviewerId.pseudo,
            profilePic: review.reviewerId.profilePic
          },
          appointmentId: review.appointmentId,
          dedicationRequestId: review.dedicationRequestId,
          liveShowId: review.liveShowId,
          createdAt: review.createdAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalReviews,
          pages: Math.ceil(totalReviews / parseInt(limit))
        },
        stats: {
          averageRating: Math.round(stats.averageRating * 10) / 10,
          totalReviews: stats.totalReviews,
          ratingDistribution: distribution
        }
      }
    });

  } catch (err) {
    console.error('Get star reviews error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get star reviews'
    });
  }
};

// Get review statistics
export const getReviewStats = async (req, res) => {
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

    // Get review statistics
    const totalReviews = await Review.countDocuments();
    const newReviews = await Review.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Get average rating
    const avgRatingResult = await Review.aggregate([
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' }
        }
      }
    ]);

    const averageRating = avgRatingResult[0]?.averageRating || 0;

    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // Get review type distribution
    const typeDistribution = await Review.aggregate([
      {
        $group: {
          _id: '$reviewType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get top reviewed stars
    const topReviewedStars = await Review.aggregate([
      {
        $group: {
          _id: '$starId',
          reviewCount: { $sum: 1 },
          averageRating: { $avg: '$rating' }
        }
      },
      { $sort: { reviewCount: -1 } },
      { $limit: 10 },
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
        $project: {
          starId: '$_id',
          starName: '$star.name',
          starPseudo: '$star.pseudo',
          starProfilePic: '$star.profilePic',
          reviewCount: 1,
          averageRating: { $round: ['$averageRating', 1] }
        }
      }
    ]);

    return res.json({
      success: true,
      message: 'Review statistics retrieved successfully',
      data: {
        overview: {
          totalReviews,
          newReviews,
          averageRating: Math.round(averageRating * 10) / 10
        },
        ratingDistribution: ratingDistribution.map(r => ({
          rating: r._id,
          count: r.count
        })),
        typeDistribution: typeDistribution.map(t => ({
          type: t._id,
          count: t.count
        })),
        topReviewedStars: topReviewedStars.map(star => ({
          starId: star.starId,
          starName: star.starName,
          starPseudo: star.starPseudo,
          starProfilePic: star.starProfilePic,
          reviewCount: star.reviewCount,
          averageRating: star.averageRating
        })),
        period: {
          startDate,
          endDate,
          type: period
        }
      }
    });

  } catch (err) {
    console.error('Get review stats error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get review statistics'
    });
  }
};
