const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    code: {
        type: Number,
        required: true,
        unique:true
    }
}, { timestamps: true });

// Create indexes for search performance
CategorySchema.index({ name: 'text' });
CategorySchema.index({ description: "text" });


const Category = mongoose.model('Category', CategorySchema);

module.exports = Category;