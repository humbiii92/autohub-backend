const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Order = require('../models/Order');

// 1. CHECKOUT DOOR: Create a new order
router.post('/', auth, async (req, res) => {
    try {
        const newOrder = new Order({
            user: req.user.id,
            items: req.body.items,
            totalAmount: req.body.totalAmount,
            // THE MISSING LINK: Tell Express to grab the address!
            shippingAddress: req.body.shippingAddress
        });

        const order = await newOrder.save();
        res.json(order);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 2. PROFILE DOOR: Get all orders for the logged-in user
router.get('/myorders', auth, async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id }).sort({ date: -1 }); // Newest first
        res.json(orders);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ==========================================
// ROUTE: PUT /api/orders/:id/cancel
// DESC:  Cancel an order within 30 minutes
// ==========================================
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ msg: 'Order not found' });

        // Security Check: Does this order belong to this user?
        if (order.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized to cancel this order' });
        }

        // TIME CHECK MATH: 30 minutes * 60 seconds * 1000 milliseconds
        const timeLimit = 30 * 60 * 1000;
        const timePassed = Date.now() - new Date(order.date).getTime();

        if (timePassed > timeLimit) {
            return res.status(400).json({ msg: 'Too late! The 30-minute cancellation window has closed.' });
        }

        if (order.status === 'Cancelled') {
            return res.status(400).json({ msg: 'Order is already cancelled.' });
        }

        // Change the status and save!
        order.status = 'Cancelled';
        await order.save();

        res.json({ msg: 'Order cancelled successfully', order });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;