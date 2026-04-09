const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// ==========================================
// ROUTE: POST /api/auth/register
// DESC:  Register a new user
// ==========================================
router.post('/register', async (req, res) => {
    try {
        // 1. Grab the data the user typed in the frontend
        const { name, email, password } = req.body;

        // 2. Validation: Did they forget anything?
        if (!name || !email || !password) {
            return res.status(400).json({ msg: 'Please enter all fields' });
        }

        // 3. Check if the user already exists in our database
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists with this email' });
        }

        // 4. Create the new user object (but DO NOT save it yet!)
        user = new User({ name, email, password });

        // 5. SECURITY: Scramble the password using bcrypt
        // We create a "salt" (extra randomness) and mix it with the password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // 6. Save the user to MongoDB
        // ... (keep the password hashing and user.save() above this)
        await user.save();

        // ... (keep the part where you generate and save the code)
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = code;
        await user.save();

        // ==========================================
        // NEW: THE REAL EMAIL SENDER
        // ==========================================

        // ==========================================
        // NEW: MODERN RESEND API
        // ==========================================
        const { data, error } = await resend.emails.send({
            from: 'AutoHub <onboarding@resend.dev>',
            to: user.email,
            subject: 'AutoHub - Your Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #E0E0E0; border-radius: 8px; max-width: 500px; margin: 0 auto;">
                    <h2 style="color: #FD7E14;">Welcome to AutoHub! 🚗💨</h2>
                    <p>Thank you for registering. To complete your setup, please enter the following 6-digit security code on the verification page:</p>
                    <div style="background-color: #F8F9FA; padding: 15px; text-align: center; font-size: 30px; font-weight: bold; letter-spacing: 5px; color: #333333; margin: 20px 0; border-radius: 6px;">
                        ${code}
                    </div>
                    <p style="font-size: 12px; color: #666;">If you did not request this, please ignore this email.</p>
                </div>
            `
        });

        if (error) {
            console.error('Resend Error:', error);
            return res.status(500).json({ msg: 'Failed to send email API' });
        }

        console.log(`Email successfully sent via Resend to ${user.email}`);

        // 4. Tell React to move to the verification page
        res.json({ msg: 'Registration successful. Please check your email for the code.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ==========================================
// ROUTE: POST /api/auth/login
// DESC:  Authenticate (Login) user & get token
// ==========================================
router.post('/login', async (req, res) => {
    try {
        // 1. Grab the email and password they typed
        const { email, password } = req.body;

        // 2. Validation
        if (!email || !password) {
            return res.status(400).json({ msg: 'Please enter all fields' });
        }

        // 3. Find the user in the database
        // IMPORTANT: Because we set `select: false` on the password in User.js, 
        // we have to add `.select('+password')` here to force MongoDB to give it to us just this once!
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // 4. SECURITY: Check the password
        // bcrypt compares the plain text password they typed to the scrambled hash in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // 5. If it matches, give them a fresh VIP Ticket
        const payload = { user: { id: user.id } };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '5h' },
            (err, token) => {
                if (err) throw err;
                res.json({
                    token,
                    user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin }
                });
            }
        );

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ==========================================
// ROUTE: POST /api/auth/verify
// DESC:  Verify the 6-digit code and grant VIP Token
// ==========================================
router.post('/verify', async (req, res) => {
    const { email, code } = req.body;

    try {
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'User not found' });

        // Check if code matches
        if (user.verificationCode !== code) {
            return res.status(400).json({ msg: 'Invalid verification code' });
        }

        // SUCCESS! Unlock the account and erase the used code
        user.isVerified = true;
        user.verificationCode = undefined;
        await user.save();

        // NOW we give them the VIP Ticket (JWT)
        const payload = { user: { id: user.id, isAdmin: user.isAdmin } };
        jwt.sign(payload, 'yourSecretKey', { expiresIn: 3600 }, (err, token) => {
            if (err) throw err;
            res.json({ token, user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin } });
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ==========================================
// ROUTE: GET /api/auth/me
// DESC:  Get the logged-in user's profile info
// ==========================================
router.get('/me', auth, async (req, res) => {
    try {
        // Find the user by the ID in their token, but DO NOT send the password back! (-password)
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ==========================================
// ROUTE: PUT /api/auth/updatedetails
// DESC:  Update user name or password
// ==========================================
router.put('/updatedetails', auth, async (req, res) => {
    const { name, currentPassword, newPassword } = req.body;

    try {
        let user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // 1. Update the Name
        if (name) user.name = name;

        // 2. Handle Password Change (If they filled it out)
        if (currentPassword && newPassword) {
            // Check if the current password matches the database
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ msg: 'Current password is incorrect.' });
            }
            // Hash the new password and save it
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
        }

        await user.save();

        // Send back the updated user (without the password!)
        res.json({ _id: user.id, name: user.name, email: user.email });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});
// ==========================================
// ROUTE: POST /api/auth/forgotpassword
// DESC:  Send a 6-digit reset code to the user's email
// ==========================================
router.post('/forgotpassword', async (req, res) => {
    const { email } = req.body;

    try {
        let user = await User.findOne({ email });
        if (!user) {
            // SECURITY: Don't tell hackers if the email exists or not!
            return res.json({ msg: 'If that email exists, a reset code has been sent.' });
        }

        // 1. Generate a 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. Save it to the database, and make it expire in 15 minutes
        user.resetPasswordCode = code;
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 mins from now
        await user.save();

        // 3. Send the email using the new Resend API
        const { data, error } = await resend.emails.send({
            from: 'AutoHub <onboarding@resend.dev>',
            to: user.email,
            subject: 'AutoHub - Password Reset Request',
            html: `
                <div style="font-family: Arial; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 500px; margin: 0 auto;">
                    <h2 style="color: #DC3545;">Password Reset Request 🔒</h2>
                    <p>Someone requested a password reset for your AutoHub account. Use the code below to reset it. This code expires in 15 minutes.</p>
                    <div style="background-color: #F8F9FA; padding: 15px; text-align: center; font-size: 30px; font-weight: bold; letter-spacing: 5px; color: #333; margin: 20px 0; border-radius: 6px;">
                        ${code}
                    </div>
                    <p style="font-size: 12px; color: #666;">If you didn't request this, ignore this email. Your password is safe.</p>
                </div>
            `
        });

        if (error) {
            console.error('Resend Error:', error);
            return res.status(500).json({ msg: 'Failed to send reset email' });
        }

        // Send success message to the frontend (keeps hackers guessing if the email exists)
        res.json({ msg: 'If that email exists, a reset code has been sent.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ==========================================
// ROUTE: POST /api/auth/resetpassword
// DESC:  Verify code and set new password
// ==========================================
router.post('/resetpassword', async (req, res) => {
    const { email, code, newPassword } = req.body;

    try {
        let user = await User.findOne({
            email,
            resetPasswordCode: code,
            resetPasswordExpires: { $gt: Date.now() } // "Greater Than" right now (meaning not expired!)
        });

        if (!user) {
            return res.status(400).json({ msg: 'Invalid or expired reset code.' });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // Erase the used codes so they can't be used again
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ msg: 'Password has been reset successfully! You can now log in.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});
// ==========================================
// ROUTE: GET /api/auth/users
// DESC:  Get all users (ADMIN ONLY)
// ==========================================
router.get('/users', auth, async (req, res) => {
    try {
        // SECURITY DOUBLE-CHECK: Are they actually the boss?
        const requester = await User.findById(req.user.id);
        if (!requester || !requester.isAdmin) {
            return res.status(403).json({ msg: 'Access denied. Command Center is restricted.' });
        }

        // Fetch everyone, but NEVER send passwords back! (-password)
        const users = await User.find().select('-password').sort({ date: -1 });
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ==========================================
// ROUTE: PUT /api/auth/users/:id/role
// DESC:  Toggle Admin status for a user
// ==========================================
router.put('/users/:id/role', auth, async (req, res) => {
    try {
        // SECURITY DOUBLE-CHECK
        const requester = await User.findById(req.user.id);
        if (!requester || !requester.isAdmin) {
            return res.status(403).json({ msg: 'Access denied.' });
        }

        // SAFETY NET: Don't let an admin accidentally demote themselves!
        if (req.params.id === req.user.id) {
            return res.status(400).json({ msg: 'You cannot downgrade your own account. Ask another admin to do it.' });
        }

        let targetUser = await User.findById(req.params.id);
        if (!targetUser) return res.status(404).json({ msg: 'User not found' });

        // Toggle the boolean (if true, make false. If false, make true)
        targetUser.isAdmin = !targetUser.isAdmin;
        await targetUser.save();

        res.json({ msg: `User role updated successfully.`, user: targetUser });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;