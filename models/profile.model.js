const mongoose = require('mongoose');
const { fieldEncryption } = require("mongoose-field-encryption");
const crypto = require("node:crypto")


const ProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Types.ObjectId,
        ref: "User"
    },
    active: {
        type: Boolean,
        require: true,
        default: true
    },
    video: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true
    },
    nationalIdentification: {
        cardNumber: {
            type: String,
            required: true
        },
        cardImage: {
            type: String,
            required: true
        }

    },
    whatsAppAccountId: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
}, { timestamps: true });

ProfileSchema.plugin(fieldEncryption, {
    fields: ['video', 'image', 'nationalIdentification.cardNumber', 'nationalIdentification.cardImage', 'whatsAppAccountId'],
    secret: process.env.MONGO_SECRET_ENCRYPTION_KEY,
    saltGenerator: function (secret) {
        const salt = crypto.randomBytes(16).toString('hex').slice(0, 16);
        return salt;
    }
})

module.exports = mongoose.model('Profile', ProfileSchema)