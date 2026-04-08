const jwt = require('jsonwebtoken');

// Middleware is just a function that has access to req, res, and the "next" function
module.exports = function (req, res, next) {
    // 1. Look at the request headers for the ticket
    const token = req.header('x-auth-token');

    // 2. If there is no ticket at all, kick them out
    if (!token) {
        return res.status(401).json({ msg: 'No ticket found. Access Denied.' });
    }

    // 3. If there is a ticket, make sure it is real and hasn't been forged
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 4. Attach the user's ID to the request so the next function knows exactly who they are
        req.user = decoded.user;

        // 5. Open the door and let them through to the next function
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Ticket is fake or expired. Access Denied.' });
    }
};