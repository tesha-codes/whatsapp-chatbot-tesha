const mongoose = require('mongoose')
const ServiceReferenceSchema = new mongoose.Schema({
    _id: mongoose.Types.ObjectId,
    title: {
        type: String,
        required: true
    },
    category: {
        type: mongoose.Types.ObjectId,
        ref: 'Category',
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    serviceType: {
        type: [String],
        enum: ['Household', 'Skilled Task', 'Yard Work', 'Moving', 'Pet Care', 'Senior Care', 'Home Maintenance', 'Errands & Shopping'],
        required: true
    },
    unitPrice: {
        type: Number,
        required: true
    },
    code: {
        type: Number,
        require: true,
        trim: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Service', ServiceReferenceSchema);
