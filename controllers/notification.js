import Notification from '../models/Notification.js';
import LiveShowAttendance from '../models/LiveShowAttendance.js';
import LiveShow from '../models/LiveShow.js';
import notificationService from '../services/notificationService.js';

/**
 * Debug user notification settings
 */
export const debugUserNotificationSettings = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Import NotificationHelper
    const NotificationHelper = (await import('../utils/notificationHelper.js')).default;
    
    // Validate user notification settings
    const validation = await NotificationHelper.validateUserNotificationSettings(userId);
    
    // Get user details
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId).select('name pseudo deviceType fcmToken apnsToken voipToken appNotification isDev role');
    
    // Get recent notifications for this user
    const Notification = (await import('../models/Notification.js')).default;
    const recentNotifications = await Notification.find({ user: userId })
      .sort({ sentAt: -1 })
      .limit(5)
      .select('title body type deliveryStatus failureReason sentAt');

    res.json({
      success: true,
      message: 'User notification settings debug info',
      data: {
        userId,
        validation,
        userDetails: user ? {
          name: user.name,
          pseudo: user.pseudo,
          role: user.role,
          deviceType: user.deviceType,
          isDev: user.isDev,
          appNotification: user.appNotification,
          hasFcmToken: !!user.fcmToken,
          hasApnsToken: !!user.apnsToken,
          hasVoipToken: !!user.voipToken,
          fcmTokenLength: user.fcmToken ? user.fcmToken.length : 0,
          fcmTokenPreview: user.fcmToken ? user.fcmToken.substring(0, 20) + '...' : null
        } : null,
        recentNotifications
      }
    });
  } catch (error) {
    console.error('Error debugging user notification settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error debugging notification settings',
      error: error.message
    });
  }
};

/**
 * Get notifications for the authenticated user
 */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type = null, page = 1, limit = 10 } = req.query;

    // Validate pagination parameters
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    
    // Ensure limit is within reasonable bounds
    const maxLimit = 100;
    const finalLimit = Math.min(limitNum, maxLimit);
    
    // Validate type filter
    const allowedTypes = ['appointment', 'payment', 'rating', 'live_show', 'dedication', 'message', 'general', 'star_promotion', 'voip', 'push'];
    const typeFilter = type && allowedTypes.includes(type) ? type : null;

    const query = { user: userId, type: { $ne: 'voip' } }; // Exclude VoIP notifications
    if (typeFilter) {
      query.type = typeFilter;
    }

    // Calculate skip for pagination
    const skip = (pageNum - 1) * finalLimit;

    // Get total count for pagination info
    const totalCount = await Notification.countDocuments(query);
    const totalPages = Math.ceil(totalCount / finalLimit);

    // Get notifications with pagination, sorted by sentAt (latest first)
    const notifications = await Notification.find(query)
      .sort({ sentAt: -1 })
      .populate('user', 'name pseudo profilePic agoraKey')
      .skip(skip)
      .limit(finalLimit)
      .lean();

    // Add timeAgo to each notification
    const notificationsWithTimeAgo = notifications.map(notification => ({
      ...notification,
      timeAgo: getTimeAgo(notification.sentAt)
    }));

    res.json({
      success: true,
      message: 'Notifications retrieved successfully',
      data: {
        notifications: notificationsWithTimeAgo,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalNotifications: totalCount,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          limit: finalLimit
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications'
    });
  }
};

/**
 * Delete a specific notification
 */
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification'
    });
  }
};

/**
 * Get notification statistics for the authenticated user
 */
export const getNotificationStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Notification.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byType: {
            $push: {
              type: '$type'
            }
          }
        }
      },
      {
        $project: {
          total: 1,
          byType: {
            $reduce: {
              input: '$byType',
              initialValue: {},
              in: {
                $mergeObjects: [
                  '$$value',
                  {
                    $let: {
                      vars: {
                        type: '$$this.type'
                      },
                      in: {
                        $mergeObjects: [
                          { $arrayToObject: [[{ k: '$$type', v: 0 }]] },
                          {
                            $arrayToObject: [[
                              {
                                k: '$$type',
                                v: {
                                  $add: [
                                    { $ifNull: [{ $getField: { field: '$$type', input: '$$value' } }, 0] },
                                    1
                                  ]
                                }
                              }
                            ]]
                          }
                        ]
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      byType: {}
    };

    res.json({
      success: true,
      message: 'Notification statistics retrieved successfully',
      data: {
        ...result
      }
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification statistics'
    });
  }
};

/**
 * Send a test notification to the authenticated user
 */
export const sendTestNotification = async (req, res) => {
  try {
    const userId = req.user._id;
    const { title, body, data = {}, customPayload, type } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Title and body are required'
      });
    }

    // Only allow VOIP notifications from frontend users, not from backend
    const normalizedType = typeof type === 'string' ? type.toLowerCase() : type;
    const enrichedData = { ...data };
    
    // Check if this is a frontend request (client-side) by checking if the sender is the current user
    const isFromFrontend = req.user && String(req.user._id) === String(userId);
    
    if (normalizedType === 'voip' && isFromFrontend) {
      enrichedData.pushType = 'VoIP';
    } else if (normalizedType === 'voip' && !isFromFrontend) {
      // If VOIP is requested from backend, convert to normal notification
      normalizedType = 'normal';
    }

    const result = await notificationService.sendToUser(
      userId,
      { title, body, type: normalizedType },
      enrichedData,
      { customPayload }
    );

    if (result.success) {
      return res.json({
        success: true,
        message: 'Test notification sent successfully',
        data: {
          notificationId: result.notificationId, 
          messageId: result.messageId
        }
      });
    }

    return res.status(400).json({
      success: false,
      message: result.message || result.error || 'Failed to send test notification'
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send a notification to a single user
 */
export const sendNotificationToUser = async (req, res) => {
  try {
    const { userId, title, body, type, data = {}, customPayload, expiresAt, relatedEntity } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ success: false, message: 'userId, title, and body are required' });
    }

    // Normalize VoIP type to pushType for APNs
    const normalizedType = typeof type === 'string' ? type.toLowerCase() : type;
    const enrichedData = { ...data };
    if (normalizedType === 'VoIP') {
      enrichedData.pushType = 'VoIP';
    }

    const result = await notificationService.sendToUser(
      userId,
      { title, body, type: normalizedType },
      enrichedData,
      { customPayload, expiresAt, relatedEntity }
    );

    if (result.success) {
      return res.json({ 
        success: true, 
        message: 'Notification sent successfully',
        data: { 
          notificationId: result.notificationId, 
          messageId: result.messageId 
        } 
      });
    }

    return res.status(400).json({ success: false, message: result.message || result.error || 'Failed to send notification' });
  } catch (error) {
    console.error('Error sending notification to user:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send a notification to multiple users
 */
export const sendNotificationToMultipleUsers = async (req, res) => {
  try {
    const { userIds, title, body, type, data = {}, customPayload, expiresAt, relatedEntity } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
      return res.status(400).json({ success: false, message: 'userIds (non-empty array), title, and body are required' });
    }

    const result = await notificationService.sendToMultipleUsers(
      userIds,
      { title, body, type },
      data,
      { customPayload, expiresAt, relatedEntity }
    );

    if (result.success) {
      return res.json({ 
        success: true, 
        message: 'Notifications sent successfully',
        data: { 
          successCount: result.successCount, 
          failureCount: result.failureCount 
        } 
      });
    }

    return res.status(400).json({ success: false, message: result.message || result.error || 'Failed to send notifications' });
  } catch (error) {
    console.error('Error sending notifications to multiple users:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send notification to all users who have joined a specific live show
 */
export const sendNotificationToLiveShowAttendees = async (req, res) => {
  try {
    const { liveShowId, type = 'live_show', data = {}, customPayload, expiresAt } = req.body;

    if (!liveShowId) {
      return res.status(400).json({ 
        success: false, 
        message: 'liveShowId is required' 
      });
    }

    // First, verify that the live show exists and get its details
    const liveShow = await LiveShow.findById(liveShowId)
      .populate({ path: 'starId', select: '-password -passwordResetToken -passwordResetExpires' })
      .lean();

    if (!liveShow) {
      return res.status(404).json({
        success: false,
        message: 'Live show not found'
      });
    }

    // Get all users who have joined this live show (pending attendance before completion)
    const attendances = await LiveShowAttendance.find({
      liveShowId: liveShowId,
      status: 'pending'
    }).select('fanId').lean();

    if (attendances.length === 0) {
      return res.json({
        success: true,
        message: 'No attendees found for this live show',
        data: {
          successCount: 0, 
          failureCount: 0, 
          totalAttendees: 0
        }
      });
    }

    // Extract user IDs
    const userIds = attendances.map(attendance => attendance.fanId);

    // Auto-generate title and body based on live show status and time
    const now = new Date();
    const showDate = new Date(liveShow.date);
    const timeDiff = showDate.getTime() - now.getTime();
    const hoursUntilShow = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutesUntilShow = Math.floor(timeDiff / (1000 * 60));

    let title, body;
    
    if (liveShow.status === 'cancelled') {
      title = 'Live Show Cancelled';
      body = `"${liveShow.sessionTitle}" by ${liveShow.starId.name} has been cancelled.`;
    } else if (liveShow.status === 'completed') {
      title = 'Live Show Completed';
      body = `"${liveShow.sessionTitle}" by ${liveShow.starId.name} has ended. Thank you for joining!`;
    } else if (hoursUntilShow <= 0 && minutesUntilShow <= 0) {
      title = 'Live Show Starting Now!';
      body = `"${liveShow.sessionTitle}" by ${liveShow.starId.name} is starting right now! Join now!`;
    } else if (hoursUntilShow < 1) {
      title = 'Live Show Starting Soon!';
      body = `"${liveShow.sessionTitle}" by ${liveShow.starId.name} starts in ${minutesUntilShow} minutes!`;
    } else if (hoursUntilShow < 24) {
      title = 'Live Show Reminder';
      body = `"${liveShow.sessionTitle}" by ${liveShow.starId.name} starts in ${hoursUntilShow} hours!`;
    } else {
      title = 'Live Show Update';
      body = `Update about "${liveShow.sessionTitle}" by ${liveShow.starId.name}`;
    }

    // Prepare live show data for frontend
    const liveShowData = {
      ...liveShow,
      _id: liveShow._id,
      sessionTitle: liveShow.sessionTitle,
      date: liveShow.date,
      time: liveShow.time,
      attendanceFee: liveShow.attendanceFee,
      maxCapacity: liveShow.maxCapacity,
      currentAttendees: liveShow.currentAttendees,
      showCode: liveShow.showCode,
      inviteLink: liveShow.inviteLink,
      // Force status to pending for attendee notifications; overall show completes later
      status: 'pending',
      description: liveShow.description,
      thumbnail: liveShow.thumbnail,
      starId: liveShow.starId,
      starBaroniId: liveShow.starId && liveShow.starId.baroniId ? liveShow.starId.baroniId : undefined,
      createdAt: liveShow.createdAt,
      updatedAt: liveShow.updatedAt
    };

    // Merge live show data with any additional data provided
    const notificationData = {
      ...data,
      liveShow: liveShowData
    };

    // Send notifications to all attendees
    const result = await notificationService.sendToMultipleUsers(
      userIds,
      { title, body, type },
      notificationData,
      { 
        customPayload, 
        expiresAt, 
        relatedEntity: {
          type: 'live_show',
          id: liveShowId
        }
      }
    );

    if (result.success) {
      return res.json({
        success: true,
        message: `Notifications sent to live show attendees`,
        data: {
          successCount: result.successCount,
          failureCount: result.failureCount,
          totalAttendees: userIds.length,
          liveShow: {
            _id: liveShow._id,
            sessionTitle: liveShow.sessionTitle,
            showCode: liveShow.showCode
          }
        }
      });
    }

    return res.status(400).json({
      success: false,
      message: result.message || result.error || 'Failed to send notifications to live show attendees'
    });
  } catch (error) {
    console.error('Error sending notifications to live show attendees:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error while sending notifications' 
    });
  }
};

/**
 * Helper function to calculate time ago
 */
function getTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d ago`;
  }
}