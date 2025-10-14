import MessageModel from '../models/Message.js';
import ConversationModel from '../models/Conversation.js';
import User from '../models/User.js';
import NotificationHelper from '../utils/notificationHelper.js';
import { uploadFile } from '../utils/uploadFile.js';
import { sanitizeUserData } from '../utils/userDataHelper.js';
import crypto from 'crypto';
import axios from 'axios';
import agoraToken from 'agora-token';
const { ChatTokenBuilder } = agoraToken;

// Constants
const AGORA_TOKEN_EXPIRATION = 31536000; // 1 year (365 * 24 * 60 * 60)

// Utility functions
function sanitizeAgoraUsername(username) {
    // Remove or replace invalid characters for Agora Chat
    return username
        .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace invalid chars with underscore
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_|_$/g, '') // Remove leading/trailing underscores
        .substring(0, 64); // Limit length to 64 characters
}

function validateAgoraUsername(username) {
    // Basic validation - just check if it's not empty after sanitization
    const sanitized = sanitizeAgoraUsername(username);
    return sanitized.length > 0;
}

export function getAgoraUsername(user) {
    // const rawUsername = user.pseudo || user.name || user._id.toString();
    return user._id.toString();
}

function validateAgoraConfig() {
    const AGORA_APP_ID = process.env.AGORA_APP_ID || '711381888';
    const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || 'default_certificate';
    
    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
        throw new Error('Agora configuration is missing');
    }
    
    return { AGORA_APP_ID, AGORA_APP_CERTIFICATE };
}

// Agora Chat Token Generation Function
export function generateChatToken(userId, expireInSeconds = AGORA_TOKEN_EXPIRATION) {
  const { AGORA_APP_ID: APP_ID, AGORA_APP_CERTIFICATE: APP_CERT } = validateAgoraConfig();
  
  // Use agora-token package for proper token generation
  const userToken = ChatTokenBuilder.buildUserToken(APP_ID, APP_CERT, userId, expireInSeconds);
  
  return userToken;
}

// Generate App Token for admin operations
function generateAppToken(expireInSeconds = AGORA_TOKEN_EXPIRATION) {
  const { AGORA_APP_ID: APP_ID, AGORA_APP_CERTIFICATE: APP_CERT } = validateAgoraConfig();
  
  // Use agora-token package for app token generation
  const appToken = ChatTokenBuilder.buildAppToken(APP_ID, APP_CERT, expireInSeconds);
  
  return appToken;
}

// Register user with Agora Chat API
async function registerUserWithAgoraChat(username, password = null) {
  try {
    const { AGORA_APP_ID, AGORA_APP_CERTIFICATE } = validateAgoraConfig();
    
    const AGORA_ORG_NAME = process.env.AGORA_ORG_NAME || '711381888';
    const AGORA_APP_NAME = process.env.AGORA_APP_NAME || '1586836';
    
    // Generate app token for user creation (admin operations)
    const adminToken = generateAppToken(3600);
    
    // Use Easemob API format as shown in the example
    const agoraChatUrl = `https://a71.chat.agora.io/${AGORA_ORG_NAME}/${AGORA_APP_NAME}/users`;
    
    console.log('Registering user with Agora Chat:', {
      url: agoraChatUrl,
      username: username,
      appId: AGORA_APP_ID,
      orgName: AGORA_ORG_NAME,
      appName: AGORA_APP_NAME
    });
    
    const requestBody = {
      username: username
    };
    
    // Add password if provided
    if (password) {
      requestBody.password = password;
    }
    
    const response = await axios.post(agoraChatUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      timeout: 10000
    });
    
    console.log('Agora Chat registration successful:', response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Agora Chat registration error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Handle specific error cases
    if (error.response?.status === 400 && error.response?.data?.error === 'duplicate_unique_property_exists') {
      return {
        success: true,
        data: { message: 'User already exists', username: username },
        alreadyExists: true
      };
    }
    
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

export const storeMessage = async (req, res) => {
    const { conversationId, receiverId, message, type } = req.body;
    const authSenderId = req.user && req.user._id ? req.user._id : null;
    const file = req.file; // For image uploads

    if (!authSenderId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    let actualConversationId = conversationId;
    let effectiveReceiverId = receiverId;

    // If no conversationId provided, create or find conversation between sender and receiver
    if (!conversationId && authSenderId && receiverId) {
        // Validate conversation rules before creating/finding conversation
        if (String(authSenderId) === String(receiverId)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot start a conversation with yourself'
            });
        }

        // Get sender and receiver user details to validate roles
        const [sender, receiver] = await Promise.all([
            User.findById(authSenderId).select('role'),
            User.findById(receiverId).select('role')
        ]);

        if (!sender || !receiver) {
            return res.status(400).json({
                success: false,
                message: 'Invalid sender or receiver'
            });
        }

        // Enforce messaging: only fan can initiate to star; block others
        // if (!(sender.role === 'fan' && receiver.role === 'star')) {
        //     return res.status(400).json({
        //         success: false,
        //         message: 'Only fans can initiate conversations with stars'
        //     });
        // }

        const participants = [String(authSenderId), String(receiverId)].sort();

        let conversation = await ConversationModel.findOne({ participants });

        if (!conversation) {
            // Create new conversation
            conversation = await ConversationModel.create({
                participants,
                lastMessage: '',
                lastMessageAt: null
            });
        }

        actualConversationId = conversation._id.toString();
        effectiveReceiverId = receiverId;
    }

    if (!actualConversationId) {
        return res.status(400).json({
            success: false,
            message: 'Conversation ID is required or receiverId must be provided'
        });
    }

    // If conversationId is provided (or determined), enforce role rules and resolve receiver
    if (actualConversationId && !effectiveReceiverId) {
        // Load conversation and determine other participant
        const conversation = await ConversationModel.findById(actualConversationId).lean();
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }
        const participants = (conversation.participants || []).map(String);
        if (!participants.includes(String(authSenderId)) || participants.length !== 2) {
            return res.status(403).json({ success: false, message: 'Not allowed in this conversation' });
        }
        const otherParticipantId = participants.find(p => p !== String(authSenderId));
        const [sender, receiver] = await Promise.all([
            User.findById(authSenderId).select('role'),
            User.findById(otherParticipantId).select('role')
        ]);
        if (!sender || !receiver) {
            return res.status(400).json({ success: false, message: 'Invalid participants' });
        }
        // Only fan -> star messages are allowed
        if (!(sender.role === 'fan' && receiver.role === 'star')) {
            return res.status(400).json({ success: false, message: 'Only fans can message stars' });
        }
        effectiveReceiverId = otherParticipantId;
    }

    // Create message data object
    const messageData = {
        conversationId: actualConversationId,
        senderId: authSenderId,
        receiverId: effectiveReceiverId,
        message: message || '',
        type: type || 'text',
        isRead: false
    };

    // Handle image upload if file is provided
    if (file && file.mimetype.startsWith('image/')) {
        try {
            const imageUrl = await uploadFile(file.buffer);
            messageData.imageUrl = imageUrl;
            messageData.type = 'image';
            // If no message text provided, set a default message for image
            if (!messageData.message) {
                messageData.message = '';
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            return res.status(500).json({ 
                success: false, 
                message: 'Error uploading image' 
            });
        }
    }

    const msg = await MessageModel.create(messageData);

    await ConversationModel.findByIdAndUpdate(actualConversationId, {
        lastMessage: message || (messageData.type === 'image' ? 'Sent an image' : ''),
        lastMessageAt: new Date()
    });

    // Send notification to receiver about new message
    try {
      await NotificationHelper.sendMessageNotification(msg, {
        senderId: authSenderId.toString(),
        conversationId: actualConversationId
      });
    } catch (notificationError) {
      console.error('Error sending message notification:', notificationError);
    }

    res.json({ ...msg.toObject(), conversationId: actualConversationId });
};

export const listMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

        const messages = await MessageModel.find({ conversationId })
            .sort({ createdAt: 1 })
            .populate('senderId', 'name pseudo profilePic baroniId role agoraKey')
            .populate('receiverId', 'name pseudo profilePic baroniId role agoraKey')
            .lean();

        const authUserId = String(req.user && req.user._id ? req.user._id : '');
        const messagesWithOwnership = messages.map((msg) => {
            const sender = msg.senderId;
            const senderIdString = sender && typeof sender === 'object' && sender._id
                ? String(sender._id)
                : String(sender);
            return {
                ...msg,
                senderId: msg.senderId ? sanitizeUserData(msg.senderId) : msg.senderId,
                receiverId: msg.receiverId ? sanitizeUserData(msg.receiverId) : msg.receiverId,
                isMine: senderIdString === authUserId
            };
        });

        res.json({
            success: true,
            data: messagesWithOwnership
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching messages',
            error: error.message
        });
    }
}

export const getUserConversations = async (req, res) => {
    try {
        const userId = String(req.user._id);

        // Get conversations where user is a participant
        const conversations = await ConversationModel.find({
            participants: userId
        })
        .sort({ lastMessageAt: -1 })
        .lean();

        // Get participant details for each conversation
        const conversationsWithDetails = await Promise.all(
            conversations.map(async (conv) => {
                // Get the other participant (not the current user)
                const otherParticipantId = conv.participants.find(participantId => participantId !== userId);

                // Get user details for the other participant
                const otherUser = await User.findById(otherParticipantId)
                    .select('name pseudo profilePic baroniId role')
                    .lean();

                // Get unread message count for this conversation
                const unreadCount = await MessageModel.countDocuments({
                    conversationId: conv._id,
                    receiverId: userId,
                    isRead: false
                });

                return {
                    _id: conv._id,
                    lastMessage: conv.lastMessage,
                    lastMessageAt: conv.lastMessageAt,
                    otherParticipant: otherUser ? sanitizeUserData(otherUser) : otherUser,
                    unreadCount: unreadCount,
                    createdAt: conv.createdAt,
                    updatedAt: conv.updatedAt
                };
            })
        );

        res.json({
            success: true,
            data: conversationsWithDetails
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching conversations',
            error: error.message
        });
    }
};

// Generate token for an existing user (similar to the example)
export const generateUserToken = async (req, res) => {
    try {
        const userId = String(req.user._id);
        const { username } = req.body;
        
        // Validate username if provided, otherwise use user's pseudo/name
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const agoraUsername = username || getAgoraUsername(user);
        
        console.log('Username processing:', {
            originalUsername: username,
            userPseudo: user.pseudo,
            userName: user.name,
            userId: user._id.toString(),
            finalUsername: agoraUsername
        });
        
        // Validate username format
        if (!validateAgoraUsername(agoraUsername)) {
            return res.status(400).json({
                success: false,
                message: 'Username cannot be empty or contain only invalid characters.',
                debug: {
                    originalUsername: username,
                    processedUsername: agoraUsername,
                    userPseudo: user.pseudo,
                    userName: user.name
                }
            });
        }
        
        // Generate token for the user
        const token = generateChatToken(agoraUsername, AGORA_TOKEN_EXPIRATION);
        
        // Save chat token to user document
        await User.findByIdAndUpdate(userId, {
            chatToken: token
        });
        
        res.json({
            success: true,
            message: 'Token generated successfully',
            data: {
                agoraUsername: agoraUsername,
                chatToken: token,
                uuid: user._id.toString() // Using user ID as UUID for consistency
            }
        });
    } catch (error) {
        console.error('Generate user token error:', error);
        
        if (error.message.includes('Agora App ID and Certificate are required')) {
            return res.status(500).json({
                success: false,
                message: 'Agora configuration is missing',
                error: 'Server configuration error'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error generating token',
            error: error.message
        });
    }
};

// Helper function to register user for messaging (can be called internally)
export async function registerUserForMessagingInternal(userId) {
    try {
        // Validate user exists
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Validate user has required fields
        if (!user.pseudo && !user.name) {
            throw new Error('User must have a pseudo or name to register for messaging');
        }

        // Use user's pseudo or name as username for Agora Chat
        const agoraUsername = getAgoraUsername(user);
        
        console.log('Registration username processing:', {
            userPseudo: user.pseudo,
            userName: user.name,
            userId: user._id.toString(),
            finalUsername: agoraUsername
        });
        
        // Validate username format (Agora Chat requirements)
        if (!validateAgoraUsername(agoraUsername)) {
            throw new Error('Username cannot be empty or contain only invalid characters.');
        }
        
        // Register user with Agora Chat API
        const agoraRegistration = await registerUserWithAgoraChat(agoraUsername);
        
        // Check if registration was successful
        if (!agoraRegistration.success) {
            throw new Error(`Failed to register user with Agora Chat: ${agoraRegistration.error}`);
        }
        
        // Generate Agora Chat Token for the user
        const chatToken = generateChatToken(agoraUsername, AGORA_TOKEN_EXPIRATION);

        // Save chat token to user document
        await User.findByIdAndUpdate(userId, {
            chatToken: chatToken
        });

        // Extract UUID from Agora registration response
        const uuid = agoraRegistration.data?.entities?.[0]?.uuid || null;
        
        return {
            success: true,
            message: agoraRegistration.alreadyExists 
                ? 'User already registered for messaging' 
                : 'User registered for messaging successfully',
            data: {
                agoraUsername: agoraUsername,
                chatToken: chatToken,
                uuid: uuid
            },
            alreadyExists: agoraRegistration.alreadyExists || false
        };
    } catch (error) {
        console.error('Register user for messaging error:', error);
        throw error;
    }
}

export const markMessagesAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = String(req.user._id);

        // Validate conversation exists and user is a participant
        const conversation = await ConversationModel.findById(conversationId).lean();
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const participants = (conversation.participants || []).map(String);
        if (!participants.includes(userId)) {
            return res.status(403).json({
                success: false,
                message: 'Not allowed in this conversation'
            });
        }

        // Mark all unread messages in this conversation as read for the current user
        const result = await MessageModel.updateMany(
            {
                conversationId: conversationId,
                receiverId: userId,
                isRead: false
            },
            {
                isRead: true
            }
        );

        res.json({
            success: true,
            message: 'Messages marked as read',
            data: {
                modifiedCount: result.modifiedCount
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error marking messages as read',
            error: error.message
        });
    }
};

export const registerUserForMessaging = async (req, res) => {
    try {
        const userId = String(req.user._id);
        
        // Validate user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Validate user has required fields
        if (!user.pseudo && !user.name) {
            return res.status(400).json({
                success: false,
                message: 'User must have a pseudo or name to register for messaging'
            });
        }

        // Use user's pseudo or name as username for Agora Chat
        const agoraUsername = getAgoraUsername(user);
        
        console.log('Registration username processing:', {
            userPseudo: user.pseudo,
            userName: user.name,
            userId: user._id.toString(),
            finalUsername: agoraUsername
        });
        
        // Validate username format (Agora Chat requirements)
        if (!validateAgoraUsername(agoraUsername)) {
            return res.status(400).json({
                success: false,
                message: 'Username cannot be empty or contain only invalid characters.',
                debug: {
                    processedUsername: agoraUsername,
                    userPseudo: user.pseudo,
                    userName: user.name
                }
            });
        }
        
        // Register user with Agora Chat API
        const agoraRegistration = await registerUserWithAgoraChat(agoraUsername);
        
        // Check if registration was successful
        if (!agoraRegistration.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to register user with Agora Chat',
                error: agoraRegistration.error
            });
        }
        
        // Generate Agora Chat Token for the user
        const chatToken = generateChatToken(agoraUsername, AGORA_TOKEN_EXPIRATION);

        // Save chat token to user document
        await User.findByIdAndUpdate(userId, {
            chatToken: chatToken
        });

        // Extract UUID from Agora registration response
        const uuid = agoraRegistration.data?.entities?.[0]?.uuid || null;
        
        res.json({
            success: true,
            message: agoraRegistration.alreadyExists 
                ? 'User already registered for messaging' 
                : 'User registered for messaging successfully',
            data: {
                agoraUsername: agoraUsername,
                chatToken: chatToken,
                uuid: uuid
            }
        });
    } catch (error) {
        console.error('Register user for messaging error:', error);
        
        // Handle specific error types
        if (error.message.includes('Agora App ID and Certificate are required')) {
            return res.status(500).json({
                success: false,
                message: 'Agora configuration is missing',
                error: 'Server configuration error'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error registering user for messaging',
            error: error.message
        });
    }
};