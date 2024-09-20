const mongoose = require('mongoose');
const { fieldEncryption } = require('mongoose-field-encryption');
const cypto = require("node:crypto")

const SubscriptionSchema = new mongoose.Schema({
    _id: mongoose.Types.ObjectId,
    user: {
        type: mongoose.Types.ObjectId
    },
    plan: {
        type: String,
        enum: ['Basic', 'Premium', 'Free Trial'],
        required: true,
        default: 'Free Trial'
    },
    duration: {
        type: String,
        enum: ['Monthly', 'Yearly'],
    },
    active: {
        type: Boolean,
        required: true,
        default: false
    },
}, { timestamps: true })

SubscriptionSchema.plugin(fieldEncryption, {
    fields: ["user"],
    secret: process.env.MONGO_SECRET_ENCRYPTION_KEY,
    saltGenerator: function (secret) {
        const salt = cypto.randomBytes(16).toString('hex').slice(0, 16);
        return salt;
    }

})
module.exports = mongoose.model('Subscription', SubscriptionSchema);
