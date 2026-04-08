const router = require('express').Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth');   // Bouncer 1: Checks for VIP Ticket
const admin = require('../middleware/admin'); // Bouncer 2: Checks for Admin Status

// ==========================================
// ROUTE: GET /api/products
// DESC:  Get all products (Public - anyone can browse the store)
// ==========================================
router.get('/', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ==========================================
// ROUTE: POST /api/products
// DESC:  Add a new product (Private - ADMIN ONLY)
// ==========================================
// Notice how we put [auth, admin] in an array right before the (req, res) function!
router.post('/', [auth, admin], async (req, res) => {
    try {
        // 1. Grab the product details you typed in
        const { name, description, price, category, stock, imageUrl, compatibility } = req.body;

        // 2. Build the new product based on our blueprint
        const newProduct = new Product({
            name,
            description,
            price,
            category,
            stock,
            imageUrl,
            compatibility
        });

        // 3. Save it to MongoDB
        const product = await newProduct.save();

        // 4. Send the saved product back as confirmation
        res.json(product);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.delete('/:id', [auth, admin], async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ msg: 'Product not found' });

        await product.deleteOne();
        res.json({ msg: 'Product removed from inventory' })
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.put('/:id', [auth, admin], async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );

        if (!product) return res.status(404).json({ msg: 'Product not found' });
        res.json(product);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;