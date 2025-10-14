import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    conversationId: String,
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: String,
    type: {type: String, default: "text"},
    imageUrl: {
        type: String,
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, {timestamps: true});

const MessageModel = mongoose.model('Message', messageSchema);
export default MessageModel;

