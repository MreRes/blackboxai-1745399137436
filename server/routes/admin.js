const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/errorHandler');
const { protect, restrictTo } = require('../utils/authMiddleware');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { APIError } = require('../utils/errorHandler');
const moment = require('moment');
const crypto = require('crypto');

/**
 * @route   POST /api/admin/users
 * @desc    Membuat user baru
 * @access  Admin
 */
router.post('/users', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const {
    username,
    maxPhoneNumbers = 1,
    activationPeriod = process.env.ACTIVATION_PERIOD_TRIAL
  } = req.body;

  // Validasi input
  if (!username) {
    throw new APIError('Username diperlukan', 400);
  }

  // Cek username unik
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    throw new APIError('Username sudah digunakan', 400);
  }

  // Generate kode aktivasi
  const activationCode = crypto.randomBytes(3).toString('hex').toUpperCase();

  // Hitung tanggal kadaluarsa
  const activationExpiry = moment().add(activationPeriod, 'days').toDate();

  // Buat user baru
  const user = new User({
    username,
    activationCode,
    maxPhoneNumbers,
    activationExpiry
  });

  await user.save();

  res.status(201).json({
    status: 'success',
    data: {
      user: {
        ...user.toObject(),
        activationCode // Tampilkan kode aktivasi hanya saat pembuatan
      }
    }
  });
}));

/**
 * @route   GET /api/admin/users
 * @desc    Mendapatkan semua user
 * @access  Admin
 */
router.get('/users', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const { 
    search,
    isActive,
    page = 1,
    limit = 10,
    sort = '-createdAt'
  } = req.query;

  // Buat query filter
  const query = { isAdmin: false };
  
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { 'phoneNumbers.number': { $regex: search, $options: 'i' } }
    ];
  }

  if (isActive !== undefined) {
    const now = new Date();
    if (isActive === 'true') {
      query.activationExpiry = { $gt: now };
    } else {
      query.activationExpiry = { $lte: now };
    }
  }

  // Hitung total documents untuk pagination
  const total = await User.countDocuments(query);

  // Dapatkan users dengan pagination
  const users = await User.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    status: 'success',
    results: users.length,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    },
    data: {
      users
    }
  });
}));

/**
 * @route   GET /api/admin/users/:id
 * @desc    Mendapatkan detail user
 * @access  Admin
 */
router.get('/users/:id', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new APIError('User tidak ditemukan', 404);
  }

  // Dapatkan statistik user
  const stats = {
    totalTransactions: await Transaction.countDocuments({ userId: user._id }),
    activePhoneNumbers: user.phoneNumbers.filter(p => p.isActive).length,
    daysUntilExpiry: moment(user.activationExpiry).diff(moment(), 'days')
  };

  res.status(200).json({
    status: 'success',
    data: {
      user,
      stats
    }
  });
}));

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Mengupdate user
 * @access  Admin
 */
router.put('/users/:id', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const {
    maxPhoneNumbers,
    activationPeriod,
    isActive
  } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new APIError('User tidak ditemukan', 404);
  }

  // Update maxPhoneNumbers jika diberikan
  if (maxPhoneNumbers !== undefined) {
    user.maxPhoneNumbers = maxPhoneNumbers;
  }

  // Update masa aktif jika diberikan
  if (activationPeriod) {
    user.activationExpiry = moment().add(activationPeriod, 'days').toDate();
  }

  // Update status aktif nomor telepon
  if (isActive !== undefined) {
    user.phoneNumbers.forEach(phone => {
      phone.isActive = isActive;
    });
  }

  await user.save();

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
}));

/**
 * @route   POST /api/admin/users/:id/extend
 * @desc    Memperpanjang masa aktif user
 * @access  Admin
 */
router.post('/users/:id/extend', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const { period } = req.body;

  if (!period) {
    throw new APIError('Periode perpanjangan diperlukan', 400);
  }

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new APIError('User tidak ditemukan', 404);
  }

  // Perpanjang masa aktif
  const currentExpiry = moment(user.activationExpiry);
  const newExpiry = currentExpiry.isAfter(moment()) ?
    currentExpiry.add(period, 'days') :
    moment().add(period, 'days');

  user.activationExpiry = newExpiry.toDate();
  await user.save();

  res.status(200).json({
    status: 'success',
    data: {
      user,
      expiryDate: user.activationExpiry
    }
  });
}));

/**
 * @route   POST /api/admin/users/:id/reset-activation
 * @desc    Reset kode aktivasi user
 * @access  Admin
 */
router.post('/users/:id/reset-activation', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new APIError('User tidak ditemukan', 404);
  }

  // Generate kode aktivasi baru
  const newActivationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  user.activationCode = newActivationCode;

  await user.save();

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        ...user.toObject(),
        activationCode: newActivationCode // Tampilkan kode aktivasi baru
      }
    }
  });
}));

/**
 * @route   GET /api/admin/stats
 * @desc    Mendapatkan statistik sistem
 * @access  Admin
 */
router.get('/stats', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const now = moment();

  // Statistik user
  const totalUsers = await User.countDocuments({ isAdmin: false });
  const activeUsers = await User.countDocuments({
    isAdmin: false,
    activationExpiry: { $gt: now.toDate() }
  });
  const expiringUsers = await User.countDocuments({
    isAdmin: false,
    activationExpiry: {
      $gt: now.toDate(),
      $lt: now.add(7, 'days').toDate()
    }
  });

  // Statistik transaksi
  const totalTransactions = await Transaction.countDocuments();
  const monthlyTransactions = await Transaction.countDocuments({
    timestamp: {
      $gte: moment().startOf('month').toDate(),
      $lte: moment().endOf('month').toDate()
    }
  });

  // Total amount transaksi bulan ini
  const monthlyAmount = await Transaction.aggregate([
    {
      $match: {
        timestamp: {
          $gte: moment().startOf('month').toDate(),
          $lte: moment().endOf('month').toDate()
        }
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' }
      }
    }
  ]);

  // Format statistik amount
  const formatAmount = (type) => {
    const data = monthlyAmount.find(a => a._id === type);
    return data ? data.total : 0;
  };

  res.status(200).json({
    status: 'success',
    data: {
      users: {
        total: totalUsers,
        active: activeUsers,
        expiring: expiringUsers
      },
      transactions: {
        total: totalTransactions,
        monthly: monthlyTransactions,
        monthlyIncome: formatAmount('income'),
        monthlyExpense: formatAmount('expense')
      }
    }
  });
}));

/**
 * @route   GET /api/admin/users/:id/transactions
 * @desc    Mendapatkan transaksi user tertentu
 * @access  Admin
 */
router.get('/users/:id/transactions', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    type,
    category,
    page = 1,
    limit = 10,
    sort = '-timestamp'
  } = req.query;

  // Validasi user exists
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new APIError('User tidak ditemukan', 404);
  }

  // Buat query filter
  const query = { userId: user._id };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  if (type) query.type = type;
  if (category) query.category = category;

  // Hitung total untuk pagination
  const total = await Transaction.countDocuments(query);

  // Dapatkan transaksi dengan pagination
  const transactions = await Transaction.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.status(200).json({
    status: 'success',
    results: transactions.length,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    },
    data: {
      transactions: transactions.map(t => t.getSummary())
    }
  });
}));

/**
 * @route   GET /api/admin/users/:id/budget
 * @desc    Mendapatkan budget user tertentu
 * @access  Admin
 */
router.get('/users/:id/budget', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const { month, year } = req.query;

  // Validasi user exists
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new APIError('User tidak ditemukan', 404);
  }

  // Buat query filter
  const query = { userId: user._id };
  if (month) query.month = parseInt(month);
  if (year) query.year = parseInt(year);

  const budgets = await Budget.find(query).sort('-year -month');

  res.status(200).json({
    status: 'success',
    data: {
      budgets: budgets.map(b => b.getSummary())
    }
  });
}));

module.exports = router;
