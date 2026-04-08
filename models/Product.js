const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a product name'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please add a description']
    },
    price: {
        type: Number,
        required: true
    },
    // NEW: Used to show the crossed-out sale price!
    originalPrice: {
        type: Number,
        // Not required, because not everything is on sale
    },
    category: {
        type: String,
        required: true,
        enum: ['Brakes', 'Engine', 'Lighting', 'Interior', 'Exterior', 'Accessories']
    },
    stock: {
        type: Number,
        required: true,
        default: 0 // If stock is 0, we can show "Out of Stock" on the frontend
    },
    imageUrl: {
        type: String, // We will store image links here
        default: 'no-photo.jpg'
    },
    // 🏆 THE MASTERPIECE FEATURE: Vehicle Compatibility
    compatibility: [{
        make: { type: String, required: true },  // e.g., 'Honda'
        model: { type: String, required: true }, // e.g., 'Civic'
        yearStart: { type: Number, required: true }, // e.g., 2016
        yearEnd: { type: Number, required: true }    // e.g., 2021
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    badgeText: {
        type: String,
        default: '' // Default is empty so it only shows if the Admin types something!
    }
});

module.exports = mongoose.model('Product', ProductSchema);