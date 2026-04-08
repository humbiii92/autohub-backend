const User = require('../models/User'); // <-- THIS IS THE MISSING LINE!

module.exports = async function(req, res, next) {
    try {
        // 1. We know their ID because the 'auth.js' bouncer just attached it to req.user!
        // Let's grab their latest profile from the database.
        const user = await User.findById(req.user.id);

        // 2. Check the flag we made in the blueprint
        if (!user.isAdmin) {
            return res.status(403).json({ msg: 'Access Denied. You are not an Admin.' });
        }

        // 3. If they ARE an admin, let them through!
        next();
    } catch (err) {
        console.error("Admin Middleware Error:", err);
        res.status(500).send('Server Error');
    }
};