const mongoose = require('mongoose');
const ServiceTypes = require("./../mock/ServiceTypes.mock");
const { fieldEncryption } = require('mongoose-field-encryption');
const crypto = require("node:crypto")

const ServiceSchema = new mongoose.Schema({
    _id: mongoose.Types.ObjectId,
    client: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    serviceProvider: {
        type: mongoose.Types.ObjectId,
        ref: 'ServiceProvider',
        required: true
    },
    serviceType: {
        type: [String],
        enum: ServiceTypes,
        default: []
    },
    description: {
        type: String,
    },
    location: {
        type: String,
    },
    status: {
        type: String,
        required: true,
        enum: ['Open', 'In-Progress', 'Completed', 'Cancelled'],
        default: 'Open'
    },
    feedback: {
        type: String,
    }
}, { timestamps: true }).index({
    "location": "2dsphere", "serviceType": "text"
});

ServiceSchema.plugin(fieldEncryption, {
    fields: ['client', 'serviceProvider', 'location'],
    secret: process.env.MONGO_SECRET_ENCRYPTION_KEY,
    saltGenerator: function (secret) {
        const salt = crypto.randomBytes(16).toString('hex').slice(0, 16);
        return salt;
    }
});

module.exports = mongoose.model("Service", ServiceSchema)