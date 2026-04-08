// ==========================================
// 1. IMPORTING REQUIRED PACKAGES
// ==========================================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // The Bouncer for our React frontend
const dotenv = require('dotenv'); // The Vault for our secrets

// ==========================================
// 2. CONFIGURING SECRETS
// ==========================================
// This line MUST be run before we try to use any process.env variables.
// It opens the .env file and loads it into the server's memory.
dotenv.config();

// ==========================================
// 3. INITIALIZING THE APP
// ==========================================
const app = express();

// ==========================================
// 4. MIDDLEWARE (The Translators & Bouncers)
// ==========================================
// Allow requests from other ports (like our future React app on port 3000)
app.use(cors());

// Tell the server how to read incoming JSON data from the frontend
// Without this, req.body will just be "undefined"
app.use(express.json());

// ==========================================
// 5. DATABASE CONNECTION
// ==========================================
// We pass the secret connection string from our .env file to Mongoose
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected to Auto Parts Hub'))
    .catch((err) => console.log('❌ MongoDB Connection Error:', err));

// ==========================================
// 6. ROUTES (The Doors to our Server)
// ==========================================

// Route everything that goes to /api/auth to our new auth.js file
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));

// A simple test door to make sure the server is awake
app.get('/', (req, res) => {
    res.send('Auto Parts Hub API is officially running! 🚗⚙️');
});

// ==========================================
// 7. STARTING THE ENGINE
// ==========================================
// Use the port from .env, but if it fails, default to 5000
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server engine started on port ${PORT}`);
});