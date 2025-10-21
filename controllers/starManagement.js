import User from '../models/User.js';
import Service from '../models/Service.js';
import DedicationSample from '../models/DedicationSample.js';
import Review from '../models/Review.js';
import Transaction from '../models/Transaction.js';
import Appointment from '../models/Appointment.js';
import DedicationRequest from '../models/DedicationRequest.js';
import LiveShow from '../models/LiveShow.js';
import mongoose from 'mongoose';

// Get star profile details with comprehensive information
export const getStarProfile = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    const star = await User.findById(starId)
      .populate('profession', 'name')
      .lean();

    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    // Get star's services
    const services = await Service.find({ userId: star._id }).lean();

    // Get star's dedication samples
    const dedicationSamples = await DedicationSample.find({ userId: star._id }).lean();

    // Get star's reviews and rating
    const reviews = await Review.find({ starId: star._id }).lean();
    const averageRating = reviews.length > 0 
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
      : 0;

    // Get star's revenue and activity stats (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Revenue insights
    const revenueStats = await Transaction.aggregate([
      {
        $match: {
          receiverId: star._id,
          status: 'completed',
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          escrowAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    const revenue = revenueStats[0] || { totalRevenue: 0, escrowAmount: 0 };

    // Activity overview (last 30 days)
    const [videoCalls, dedications, liveShows, engagedUsers] = await Promise.all([
      Appointment.countDocuments({
        starId: star._id,
        createdAt: { $gte: thirtyDaysAgo }
      }),
      DedicationRequest.countDocuments({
        starId: star._id,
        createdAt: { $gte: thirtyDaysAgo }
      }),
      LiveShow.countDocuments({
        starId: star._id,
        createdAt: { $gte: thirtyDaysAgo }
      }),
      Transaction.distinct('payerId', {
        receiverId: star._id,
        createdAt: { $gte: thirtyDaysAgo }
      }).then(users => users.length)
    ]);

    // Cancelled activities (last 30 days)
    const [cancelledVideoCalls, cancelledDedications, cancelledLiveShows] = await Promise.all([
      Appointment.countDocuments({
        starId: star._id,
        status: 'cancelled',
        createdAt: { $gte: thirtyDaysAgo }
      }),
      DedicationRequest.countDocuments({
        starId: star._id,
        status: 'cancelled',
        createdAt: { $gte: thirtyDaysAgo }
      }),
      LiveShow.countDocuments({
        starId: star._id,
        status: 'cancelled',
        createdAt: { $gte: thirtyDaysAgo }
      })
    ]);

    return res.json({
      success: true,
      message: 'Star profile retrieved successfully',
      data: {
        star: {
          id: star._id,
          baroniId: star.baroniId,
          name: star.name,
          pseudo: star.pseudo,
          email: star.email,
          contact: star.contact,
          profilePic: star.profilePic,
          role: star.role,
          country: star.country,
          profession: star.profession,
          about: star.about,
          location: star.location,
          availableForBookings: star.availableForBookings,
          hidden: star.hidden,
          appNotification: star.appNotification,
          coinBalance: star.coinBalance,
          deviceType: star.deviceType,
          createdAt: star.createdAt,
          lastLoginAt: star.lastLoginAt
        },
        rating: {
          average: Math.round(averageRating * 10) / 10,
          totalReviews: reviews.length
        },
        services: services.map(service => ({
          id: service._id,
          type: service.type,
          price: service.price,
          createdAt: service.createdAt
        })),
        dedicationSamples: dedicationSamples.map(sample => ({
          id: sample._id,
          type: sample.type,
          video: sample.video,
          description: sample.description,
          createdAt: sample.createdAt
        })),
        overview: {
          videoCalls,
          dedications,
          liveShows,
          engagedUsers
        },
        cancelled: {
          videoCalls: cancelledVideoCalls,
          dedications: cancelledDedications,
          liveShows: cancelledLiveShows
        },
        revenue: {
          total: revenue.totalRevenue,
          escrow: revenue.escrowAmount
        }
      }
    });

  } catch (err) {
    console.error('Get star profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get star profile'
    });
  }
};

// Update star profile
export const updateStarProfile = async (req, res) => {
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
      name,
      pseudo,
      email,
      contact,
      profilePic,
      country,
      profession,
      about,
      location,
      availableForBookings,
      hidden,
      appNotification
    } = req.body;

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

    // Update fields
    if (name !== undefined) star.name = name;
    if (pseudo !== undefined) star.pseudo = pseudo;
    if (email !== undefined) star.email = email;
    if (contact !== undefined) star.contact = contact;
    if (profilePic !== undefined) star.profilePic = profilePic;
    if (country !== undefined) star.country = country;
    if (profession !== undefined) star.profession = profession;
    if (about !== undefined) star.about = about;
    if (location !== undefined) star.location = location;
    if (availableForBookings !== undefined) star.availableForBookings = availableForBookings;
    if (hidden !== undefined) star.hidden = hidden;
    if (appNotification !== undefined) star.appNotification = appNotification;

    await star.save();

    return res.json({
      success: true,
      message: 'Star profile updated successfully',
      data: {
        star: {
          id: star._id,
          name: star.name,
          pseudo: star.pseudo,
          email: star.email,
          contact: star.contact,
          profilePic: star.profilePic,
          country: star.country,
          profession: star.profession,
          about: star.about,
          location: star.location,
          availableForBookings: star.availableBookings,
          hidden: star.hidden,
          appNotification: star.appNotification
        }
      }
    });

  } catch (err) {
    console.error('Update star profile error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update star profile'
    });
  }
};

// Manage star services
export const getStarServices = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;

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

    const services = await Service.find({ userId: star._id }).lean();

    return res.json({
      success: true,
      message: 'Star services retrieved successfully',
      data: {
        services: services.map(service => ({
          id: service._id,
          type: service.type,
          price: service.price,
          createdAt: service.createdAt,
          updatedAt: service.updatedAt
        }))
      }
    });

  } catch (err) {
    console.error('Get star services error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get star services'
    });
  }
};

// Add star service
export const addStarService = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { type, price } = req.body;

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

    if (!type || !price) {
      return res.status(400).json({
        success: false,
        message: 'Service type and price are required'
      });
    }

    // Check if service already exists
    const existingService = await Service.findOne({ userId: star._id, type });
    if (existingService) {
      return res.status(409).json({
        success: false,
        message: 'Service type already exists for this star'
      });
    }

    const service = new Service({
      type,
      price: parseFloat(price),
      userId: star._id
    });

    await service.save();

    return res.status(201).json({
      success: true,
      message: 'Service added successfully',
      data: {
        service: {
          id: service._id,
          type: service.type,
          price: service.price,
          createdAt: service.createdAt
        }
      }
    });

  } catch (err) {
    console.error('Add star service error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to add service'
    });
  }
};

// Update star service
export const updateStarService = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId, serviceId } = req.params;
    const { type, price } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId) || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID or service ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const service = await Service.findOne({ _id: serviceId, userId: star._id });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    if (type) service.type = type;
    if (price !== undefined) service.price = parseFloat(price);

    await service.save();

    return res.json({
      success: true,
      message: 'Service updated successfully',
      data: {
        service: {
          id: service._id,
          type: service.type,
          price: service.price,
          updatedAt: service.updatedAt
        }
      }
    });

  } catch (err) {
    console.error('Update star service error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update service'
    });
  }
};

// Delete star service
export const deleteStarService = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId, serviceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(starId) || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID or service ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const service = await Service.findOne({ _id: serviceId, userId: star._id });
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    await Service.deleteOne({ _id: serviceId });

    return res.json({
      success: true,
      message: 'Service deleted successfully'
    });

  } catch (err) {
    console.error('Delete star service error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete service'
    });
  }
};

// Manage star dedication samples
export const getStarDedicationSamples = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;

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

    const samples = await DedicationSample.find({ userId: star._id }).lean();

    return res.json({
      success: true,
      message: 'Star dedication samples retrieved successfully',
      data: {
        samples: samples.map(sample => ({
          id: sample._id,
          type: sample.type,
          video: sample.video,
          description: sample.description,
          createdAt: sample.createdAt,
          updatedAt: sample.updatedAt
        }))
      }
    });

  } catch (err) {
    console.error('Get star dedication samples error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get dedication samples'
    });
  }
};

// Add star dedication sample
export const addStarDedicationSample = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { type, video, description } = req.body;

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

    if (!type || !video) {
      return res.status(400).json({
        success: false,
        message: 'Sample type and video are required'
      });
    }

    const sample = new DedicationSample({
      type,
      video,
      description: description || '',
      userId: star._id
    });

    await sample.save();

    return res.status(201).json({
      success: true,
      message: 'Dedication sample added successfully',
      data: {
        sample: {
          id: sample._id,
          type: sample.type,
          video: sample.video,
          description: sample.description,
          createdAt: sample.createdAt
        }
      }
    });

  } catch (err) {
    console.error('Add star dedication sample error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to add dedication sample'
    });
  }
};

// Update star dedication sample
export const updateStarDedicationSample = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId, sampleId } = req.params;
    const { type, video, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId) || !mongoose.Types.ObjectId.isValid(sampleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID or sample ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const sample = await DedicationSample.findOne({ _id: sampleId, userId: star._id });
    if (!sample) {
      return res.status(404).json({
        success: false,
        message: 'Dedication sample not found'
      });
    }

    if (type) sample.type = type;
    if (video) sample.video = video;
    if (description !== undefined) sample.description = description;

    await sample.save();

    return res.json({
      success: true,
      message: 'Dedication sample updated successfully',
      data: {
        sample: {
          id: sample._id,
          type: sample.type,
          video: sample.video,
          description: sample.description,
          updatedAt: sample.updatedAt
        }
      }
    });

  } catch (err) {
    console.error('Update star dedication sample error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update dedication sample'
    });
  }
};

// Delete star dedication sample
export const deleteStarDedicationSample = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId, sampleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(starId) || !mongoose.Types.ObjectId.isValid(sampleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID or sample ID'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    const sample = await DedicationSample.findOne({ _id: sampleId, userId: star._id });
    if (!sample) {
      return res.status(404).json({
        success: false,
        message: 'Dedication sample not found'
      });
    }

    await DedicationSample.deleteOne({ _id: sampleId });

    return res.json({
      success: true,
      message: 'Dedication sample deleted successfully'
    });

  } catch (err) {
    console.error('Delete star dedication sample error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete dedication sample'
    });
  }
};

// Get all stars with filtering and search
export const getAllStars = async (req, res) => {
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
      role: 'star',
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

    // Add country filter
    if (country && country !== 'all') {
      filter.country = country;
    }

    // Add status filter
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

    // Get stars with pagination
    const stars = await User.find(filter)
      .populate('profession', 'name')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const totalStars = await User.countDocuments(filter);

    // Get unique countries for filter options
    const countries = await User.distinct('country', {
      role: 'star',
      country: { $exists: true, $ne: null },
      isDeleted: { $ne: true }
    });

    // Get status counts
    const activeCount = await User.countDocuments({
      role: 'star',
      availableForBookings: true,
      hidden: false,
      isDeleted: { $ne: true }
    });

    const blockedCount = await User.countDocuments({
      role: 'star',
      $or: [
        { availableForBookings: false },
        { hidden: true }
      ],
      isDeleted: { $ne: true }
    });

    return res.json({
      success: true,
      message: 'Stars retrieved successfully',
      data: {
        stars: stars.map(star => ({
          id: star._id,
          baroniId: star.baroniId,
          name: star.name,
          pseudo: star.pseudo,
          email: star.email,
          profilePic: star.profilePic,
          country: star.country,
          profession: star.profession,
          availableForBookings: star.availableForBookings,
          hidden: star.hidden,
          status: star.availableForBookings && !star.hidden ? 'active' : 'blocked',
          coinBalance: star.coinBalance,
          createdAt: star.createdAt,
          lastLoginAt: star.lastLoginAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalStars,
          pages: Math.ceil(totalStars / parseInt(limit))
        },
        filters: {
          countries: countries.sort(),
          statuses: ['active', 'blocked']
        },
        stats: {
          status: {
            active: activeCount,
            blocked: blockedCount
          }
        }
      }
    });

  } catch (err) {
    console.error('Get all stars error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get stars'
    });
  }
};

// ==================== FEATURED STAR MANAGEMENT ====================

// Toggle featured star status
export const toggleFeaturedStar = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starId } = req.params;
    const { feature_star } = req.body;

    if (!mongoose.Types.ObjectId.isValid(starId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid star ID'
      });
    }

    if (typeof feature_star !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'feature_star must be a boolean value (true/false)'
      });
    }

    const star = await User.findById(starId);
    if (!star || star.role !== 'star') {
      return res.status(404).json({
        success: false,
        message: 'Star not found'
      });
    }

    // Update featured star status
    star.feature_star = feature_star;
    await star.save();

    return res.json({
      success: true,
      message: `Star ${feature_star ? 'featured' : 'unfeatured'} successfully`,
      data: {
        star: {
          id: star._id,
          name: star.name,
          pseudo: star.pseudo,
          baroniId: star.baroniId,
          feature_star: star.feature_star
        }
      }
    });

  } catch (err) {
    console.error('Toggle featured star error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle featured star status'
    });
  }
};

// Get all featured stars
export const getFeaturedStars = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const featuredStars = await User.find({
      role: 'star',
      feature_star: true,
      isDeleted: { $ne: true }
    })
      .populate('profession', 'name')
      .select('name pseudo baroniId profilePic country profession feature_star createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalFeaturedStars = await User.countDocuments({
      role: 'star',
      feature_star: true,
      isDeleted: { $ne: true }
    });

    return res.json({
      success: true,
      message: 'Featured stars retrieved successfully',
      data: {
        featuredStars: featuredStars.map(star => ({
          id: star._id,
          name: star.name,
          pseudo: star.pseudo,
          baroniId: star.baroniId,
          profilePic: star.profilePic,
          country: star.country,
          profession: star.profession,
          feature_star: star.feature_star,
          createdAt: star.createdAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalFeaturedStars,
          pages: Math.ceil(totalFeaturedStars / parseInt(limit))
        }
      }
    });

  } catch (err) {
    console.error('Get featured stars error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to get featured stars'
    });
  }
};

// Bulk update featured stars
export const bulkUpdateFeaturedStars = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { starIds, feature_star } = req.body;

    if (!Array.isArray(starIds) || starIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'starIds must be a non-empty array'
      });
    }

    if (typeof feature_star !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'feature_star must be a boolean value (true/false)'
      });
    }

    // Validate all star IDs
    const invalidIds = starIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid star IDs: ${invalidIds.join(', ')}`
      });
    }

    // Update all stars
    const result = await User.updateMany(
      { 
        _id: { $in: starIds },
        role: 'star',
        isDeleted: { $ne: true }
      },
      { feature_star }
    );

    return res.json({
      success: true,
      message: `${result.modifiedCount} stars ${feature_star ? 'featured' : 'unfeatured'} successfully`,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      }
    });

  } catch (err) {
    console.error('Bulk update featured stars error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk update featured stars'
    });
  }
};