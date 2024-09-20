const mongoose = require("mongoose");
const { fieldEncryption } = require("mongoose-field-encryption");
const crypto = require("node:crypto")

const ChatSchema = new mongoose.Schema({
    _id: mongoose.Types.ObjectId,
    user: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    conversations: {
        type: [mongoose.Types.ObjectId],
        ref: 'Conversation',
        default: []
    },
    lastMessageStamp: {
        type: Date,
        required: true
    }
}, { timestamps: true });

ChatSchema.plugin(fieldEncryption, {
    fields: ['user', 'conversations', 'lastMessageStamp'],
    secret: process.env.MONGO_SECRET_ENCRYPTION_KEY,
    saltGenerator: function (secret) {
        const salt = crypto.randomBytes(16).toString('hex').slice(0, 16);
        return salt;
    }
})

module.exports = mongoose.model('Chat', ChatSchema)