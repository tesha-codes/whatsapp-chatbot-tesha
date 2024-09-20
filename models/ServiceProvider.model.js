const mongoose = require('mongoose');
const ServiceTypes = require('./../mock/ServiceTypes.mock')

const ServiceProviderSchema = new mongoose.Schema({
    _id: mongoose.Types.ObjectId,
    user: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    providerType: {
        type: [String],
        required: true,
        default: [],
        enum: ServiceTypes
    },
    available: {
        type: Boolean,
        default: false
    },
    jobs: {
        type: [mongoose.Types.ObjectId],
        default: []
    },
    rating: {
        type: String,
        default: "0.0"
    },
    preferredJobs: {
        type: [String],
        default: [],
        enum: ServiceTypes
    },
    ecocashNumber: {
        type: String,
        required: true,
        trim: true
    },
    basicHourlyRate: {
        type: Number,
        required: true,
        default: 2
    },
    subscription: {
        types: [mongoose.Types.ObjectId],
        required: true,
        ref: 'Subscription'
    }
}, { timestamps: true }).index({
    "providerType": "text",
    "preferredJobs": "text"
});

module.exports = mongoose.model('ServiceProvider', ServiceProviderSchema)