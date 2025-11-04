import mongoose from 'mongoose';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Dedication from '../models/Dedication.js';
import Service from '../models/Service.js';
import DedicationSample from '../models/DedicationSample.js';
import Appointment from '../models/Appointment.js';
import Availability from '../models/Availability.js';
import LiveShow from '../models/LiveShow.js';
import Transaction from "../models/Transaction.js";
import { getOrCreateStarWallet } from '../services/starWalletService.js';
import StarTransaction from '../models/StarTransaction.js';
import Review from '../models/Review.js';
import { createSanitizedUserResponse, sanitizeUserData } from '../utils/userDataHelper.js';

const sanitizeUser = (user) => createSanitizedUserResponse(user);

export const getDashboard = async (req, res) => {
  try {
    const user = req.user;
    const role = user.role;

    if (role === 'fan') {
      // Fan dashboard: stars with filled details, categories, and upcoming shows
      const { country } = req.query || {};

      // Removed starCriteria - no longer needed

      // Removed stars query - no longer needed

      const categoriesQuery = Category.find().sort({ name: 1 });

      // Build live show filter
      const liveShowFilter = {
        status: 'pending',
        date: { $gt: new Date() }
      };

      let starIdsForCountry = [];
      if (country) {
        const starIdsDocs = await User.find({ role: 'star', country, isDeleted: { $ne: true } }).select('_id');
        starIdsForCountry = starIdsDocs.map(s => s._id);
        // If no stars in that country, ensure no shows are returned quickly
        liveShowFilter.starId = { $in: starIdsForCountry.length ? starIdsForCountry : [null] };
      }

      const liveShowsQuery = LiveShow.find(liveShowFilter)
        .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
        .sort({ date: 1 })
        .limit(10);

      // Removed popularStars query - no longer needed

      // Query for featured stars specifically - more flexible criteria
      const featuredStarsCriteria = {
        role: 'star',
        feature_star: true,
        isDeleted: { $ne: true },
        // Basic requirements - only check for essential fields like getAllStars
        name: { $exists: true, $ne: null, $ne: '' },
        pseudo: { $exists: true, $ne: null, $ne: '' }
      };

      if (country) {
        featuredStarsCriteria.country = country;
      }

      const featuredStarsQuery = User.find(featuredStarsCriteria)
        .populate('profession')
        .select('name pseudo profilePic about profession availableForBookings baroniId feature_star')
        .sort({ profileImpressions: -1, createdAt: -1 })
        .limit(10);

      // Query for available stars from same country
      const availableStarsCriteria = {
        role: 'star',
        isDeleted: { $ne: true },
        availableForBookings: true,
        hidden: { $ne: true },
        // Basic requirements - only check for essential fields
        name: { $exists: true, $ne: null, $ne: '' },
        pseudo: { $exists: true, $ne: null, $ne: '' }
      };

      // Only filter by country if user has a country
      if (country && country.trim()) {
        availableStarsCriteria.country = country;
      }

      const availableStarsQuery = User.find(availableStarsCriteria)
        .populate('profession')
        .select('name pseudo profilePic about profession availableForBookings baroniId feature_star country')
        .sort({ feature_star: -1, profileImpressions: -1, createdAt: -1 })
        .limit(15);

      const [categories, upcomingShows, featuredStars, availableStars] = await Promise.all([
        categoriesQuery,
        liveShowsQuery,
        featuredStarsQuery,
        availableStarsQuery
      ]);

      // Debug: Log counts
      console.log('Featured stars found:', featuredStars.length);
      console.log('Available stars found:', availableStars.length);

      // Calculate ratings for featured and available stars only
      const allStars = [...featuredStars, ...availableStars];
      const starIds = [...new Set(allStars.map(star => star._id.toString()))];
      
      // Get ratings for all stars in one query
      const ratingsAgg = await Review.aggregate([
        { $match: { starId: { $in: starIds.map(id => new mongoose.Types.ObjectId(id)) } } },
        { $group: { _id: '$starId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
      
      // Create ratings map
      const ratingsMap = {};
      ratingsAgg.forEach(rating => {
        ratingsMap[rating._id.toString()] = {
          average: Number((rating.avg || 0).toFixed(1)), // Round to 1 decimal place (e.g., 3.9 instead of 3.99)
          count: rating.count || 0
        };
      });

      // Removed top5PopularStars code - no longer needed

      return res.json({
        success: true,
        data: {
          featuredStars: featuredStars.map(star => {
            const sanitized = sanitizeUser(star);
            const starRating = ratingsMap[star._id.toString()] || { average: 0, count: 0 };
            return {
              ...sanitized,
              averageRating: starRating.average,
              totalReviews: starRating.count
            };
          }),
          availableStars: availableStars.map(star => {
            const sanitized = sanitizeUser(star);
            const starRating = ratingsMap[star._id.toString()] || { average: 0, count: 0 };
            return {
              ...sanitized,
              averageRating: starRating.average,
              totalReviews: starRating.count
            };
          }),
          categories: categories.map(cat => ({
            id: cat._id,
            name: cat.name,
            image: cat.image,
            description: cat.description,
          })),
          upcomingShows: upcomingShows.map(show => ({
            id: show._id,
            sessionTitle: show.sessionTitle,
            date: show.date,
            time: show.time,
            attendanceFee: show.attendanceFee,
            maxCapacity: show.maxCapacity,
            currentAttendees: show.currentAttendees,
            showCode: show.showCode,
            description: show.description,
            thumbnail: show.thumbnail,
            likeCount: Array.isArray(show.likes) ? show.likes.length : 0,
            isLiked: Array.isArray(show.likes) && req.user ? show.likes.some(u => u.toString() === req.user._id.toString()) : false,
            star: show.starId ? sanitizeUserData(show.starId) : null
          }))
        },
      });
    }

    if (role === 'star') {
      // Star dashboard: upcoming bookings, earnings, engaged fans, and live shows
      const [upcomingBookings, engagedFans, upcomingLiveShows, ratingAgg] = await Promise.all([
        // Upcoming approved appointments
        Appointment.find({
          starId: user._id,
          status: 'approved',
          date: { $gte: new Date().toISOString().split('T')[0] } // Today and future dates
        })
        .populate('fanId', 'name pseudo profilePic agoraKey')
        .sort({ date: 1, time: 1 })
        .limit(10),

        // Get unique fans who have booked appointments
        Appointment.distinct('fanId', {
          starId: user._id,
          status: { $in: ['approved', 'pending'] }
        }),

        // Get upcoming live shows
        LiveShow.find({
          starId: user._id,
          status: 'pending',
          date: { $gt: new Date() }
        })
        .sort({ date: 1 })
        .limit(10),
        // Star rating: average rating across all reviews for this star
        Review.aggregate([
          { $match: { starId: user._id } },
          { $group: { _id: '$starId', avg: { $avg: '$rating' }, count: { $sum: 1 } } }
        ])
      ]);

      // Fetch star wallet for accurate escrow and jackpot balances
      const starWallet = await getOrCreateStarWallet(user._id);
      try {
        console.log('[Dashboard][Star] Wallet lookup', {
          starId: String(user._id),
          walletFound: Boolean(starWallet),
          escrow: starWallet?.escrow,
          jackpot: starWallet?.jackpot,
          totalEarned: starWallet?.totalEarned,
          totalWithdrawn: starWallet?.totalWithdrawn
        });
      } catch (_e) {}

      // Get fan details for engaged fans
      const fanDetails = await User.find({
        _id: { $in: engagedFans }
      })
      .select('name pseudo profilePic')
      .limit(20);

      // Compute earnings breakdown from StarTransaction (pending + completed = earned, exclude refunded)
      const txnAgg = await StarTransaction.aggregate([
        { $match: { starId: user._id, status: { $in: ['pending', 'completed'] } } },
        { $group: { _id: '$type', amount: { $sum: '$amount' } } }
      ]);
      const aggMap = txnAgg.reduce((m, r) => { m[r._id] = r.amount; return m; }, {});
      const appointmentEarnings = Number(aggMap['appointment'] || 0);
      const liveShowEarningsTotal = Number(aggMap['live_show'] || aggMap['live_show_hosting'] || 0);
      const totalEarnings = Number(starWallet?.totalEarned || (appointmentEarnings + liveShowEarningsTotal));
      const pendingEscrow = Number(starWallet?.escrow || 0);
      const jackpotFunds = Number(starWallet?.jackpot || 0);

      const starRating = ratingAgg && ratingAgg.length > 0
        ? { average: Number((ratingAgg[0].avg || 0).toFixed(1)), count: ratingAgg[0].count || 0 }
        : { average: 0, count: 0 };

      return res.json({
        success: true,
        data: {
          upcomingBookings: upcomingBookings.map(booking => ({
            id: booking._id,
            fan: booking.fanId ? sanitizeUserData(booking.fanId) : null,
            date: booking.date,
            time: booking.time,
            status: booking.status,
            ...(booking.paymentStatus ? { paymentStatus: booking.paymentStatus } : {})
          })),
          upcomingLiveShows: upcomingLiveShows.map(show => ({
            id: show._id,
            sessionTitle: show.sessionTitle,
            date: show.date,
            time: show.time,
            attendanceFee: show.attendanceFee,
            hostingPrice: show.hostingPrice,
            maxCapacity: show.maxCapacity,
            currentAttendees: show.currentAttendees,
            showCode: show.showCode,
            description: show.description,
            thumbnail: show.thumbnail,
            status: show.status,
            ...(show.paymentStatus ? { paymentStatus: show.paymentStatus } : {}),
            likeCount: Array.isArray(show.likes) ? show.likes.length : 0,
            isLiked: Array.isArray(show.likes) && req.user ? show.likes.some(u => u.toString() === req.user._id.toString()) : false
          })),
          earnings: {
            totalEarnings,
            appointmentEarnings,
            liveShowEarnings: liveShowEarningsTotal,
            currency: 'USD',
            escrowFunds: pendingEscrow,
            jackpotFunds
          },
          engagedFans: fanDetails.map(fan => sanitizeUserData(fan)),
          rating: starRating,
          stats: {
            totalBookings: upcomingBookings.length,
            totalLiveShows: upcomingLiveShows.length,
            totalEngagedFans: fanDetails.length
          }
        },
      });
    }

    if (role === 'admin') {
      // Admin dashboard: system overview
      const [totalUsers, totalStars, totalFans, totalCategories, totalAppointments] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: 'star' }),
        User.countDocuments({ role: 'fan' }),
        Category.countDocuments(),
        Appointment.countDocuments(),
      ]);

      const recentUsers = await User.find()
        .select('name pseudo role createdAt')
        .sort({ createdAt: -1 })
        .limit(10);

      const recentAppointments = await Appointment.find()
        .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
        .populate('fanId', 'name pseudo agoraKey')
        .sort({ createdAt: -1 })
        .limit(10);

      return res.json({
        success: true,
        data: {
          stats: {
            totalUsers,
            totalStars,
            totalFans,
            totalCategories,
            totalAppointments,
          },
          recentUsers: recentUsers.map(u => sanitizeUserData(u)),
          recentAppointments: recentAppointments.map(apt => ({
            id: apt._id,
            star: apt.starId ? sanitizeUserData(apt.starId) : null,
            fan: apt.fanId ? sanitizeUserData(apt.fanId) : null,
            date: apt.date,
            time: apt.time,
            status: apt.status,
            createdAt: apt.createdAt,
          })),
        },
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid user role' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
