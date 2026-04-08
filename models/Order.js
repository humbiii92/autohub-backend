const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    items: [
        {
            name: String,
            price: Number,
            quantity: Number,
            imageUrl: String
        }
    ],
    shippingAddress: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        zipCode: { type: String, required: true },
        phone: { type: String, required: true }
    },
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        default: 'Processing' // Later, the Admin can change this to 'Shipped'
    },
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('order', orderSchema);