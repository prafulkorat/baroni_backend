import express from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import {storeMessageValidator} from "../../validators/storeMessageRequestValidators.js";
import {listMessages, storeMessage, getUserConversations, registerUserForMessaging, generateUserToken, markMessagesAsRead, clearChatToken} from "../../controllers/messages.js";
import { uploadChatMessage } from '../../middlewares/upload.js';

const router = express.Router();

router.use(requireAuth);

// Get all conversations for authenticated user
router.get('/conversations', getUserConversations);

// Get messages for a specific conversation
router.get('/:conversationId', listMessages);

// Store a new message (with optional image upload)
router.post('/', uploadChatMessage.single('image'), storeMessageValidator, storeMessage);

router.post('/register', registerUserForMessaging);

// Generate token for messaging
router.post('/token', generateUserToken);

// Clear chat token for authenticated user
router.delete('/token', clearChatToken);

// Mark messages as read for a conversation
router.put('/:conversationId/read', markMessagesAsRead);

export default router;








