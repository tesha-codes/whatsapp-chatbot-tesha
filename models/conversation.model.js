const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    _id: { type: mongoose.Types.ObjectId },
    topic: { type: String },
    services: {
        type: [mongoose.Types.ObjectId],
        default: []
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date,
    },
    messages: {
        type: [mongoose.Types.ObjectId],
        default: []
    }
}, { timestamps: true });

module.exports = mongoose.model("Conversation", ConversationSchema)