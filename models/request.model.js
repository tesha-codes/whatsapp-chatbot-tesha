const mongoose = require('mongoose');

const ServiceRequestSchema = new mongoose.Schema({
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true,
    },
    requester: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    serviceProviders: {
        type: [mongoose.Types.ObjectId],
        required: true,
        ref: 'User',
        default: []
    },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
        default: 'Pending',
    },
    address: {
        physicalAddress: {
            type: String,
        },
        coordinates: {
            type: [Number],
        },
    },
    city: {
        type: String,
        required: true
    },
    notes: {
        type: String
    },
    id: {
        type: String,
        required: true,
        trim: true
    }
}, { timestamps: true });

module.exports = mongoose.model('ServiceRequest', ServiceRequestSchema);
