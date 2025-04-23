require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budget');
const reportRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const settingsRoutes = require('./routes/settings');

// Import error handlers
const { errorHandler, notFound } = require('./utils/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Connect to MongoDB with retry logic
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/financial-assistant', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // Timeout after 5s instead of 30s
    });
    console.log('Connected to MongoDB');

    // Initialize WhatsApp bot only after DB connection is established
    require('./bot/bot');

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/transactions', transactionRoutes);
    app.use('/api/budget', budgetRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/settings', settingsRoutes);

    // Handle 404 errors
    app.use(notFound);

    // Error handling middleware
    app.use(errorHandler);

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('MongoDB connection error:', err);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

// Start the connection process
connectDB();
