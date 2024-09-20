const mongoose = require("mongoose");
const { fieldEncryption } = require("mongoose-field-encryption");
const crypto = require('node:crypto')

const MessageSchema = new mongoose.Schema({
    _id: mongoose.Types.ObjectId,
    sender: {
        type: String,
        enum: ['User', 'System'],
    },
    messageType: {
        type: String,
        enum: ['Text', 'Image', 'Voice'],
        default: "Text"
    },
    body: {
        type: String,
        required: true
    },
    attachments: {
        fileType: {
            type: String
        },
        fileUrl: {
            type: String
        }
    },
}, { timestamps: true });

MessageSchema.plugin(fieldEncryption, {
    fields: ['sender', 'body', 'attachments.fileUrl'],
    secret: process.env.MONGO_SECRET_ENCRYPTION_KEY,
    saltGenerator: function (secret) {
        const salt = crypto.randomBytes(16).toString('hex').slice(0, 16);
        return salt
    }
})

module.exports = mongoose.model('Message', MessageSchema)