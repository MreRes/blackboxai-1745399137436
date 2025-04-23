const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/errorHandler');
const { protect, restrictTo } = require('../utils/authMiddleware');
const User = require('../models/User');
const { APIError } = require('../utils/errorHandler');
const bot = require('../bot/bot');
const bcrypt = require('bcryptjs');

/**
 * @route   PUT /api/settings/admin/password
 * @desc    Mengubah password admin
 * @access  Admin
 */
router.put('/admin/password', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  // Validasi input
  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new APIError('Semua field harus diisi', 400);
  }

  if (newPassword !== confirmPassword) {
    throw new APIError('Password baru dan konfirmasi password tidak cocok', 400);
  }

  // Validasi password minimal 8 karakter
  if (newPassword.length < 8) {
    throw new APIError('Password baru minimal 8 karakter', 400);
  }

  // Cek password lama
  const admin = await User.findById(req.user._id);
  const isPasswordValid = await admin.comparePassword(currentPassword);

  if (!isPasswordValid) {
    throw new APIError('Password saat ini tidak valid', 401);
  }

  // Update password
  admin.password = newPassword;
  await admin.save();

  res.status(200).json({
    status: 'success',
    message: 'Password berhasil diubah'
  });
}));

/**
 * @route   GET /api/settings/whatsapp/qr
 * @desc    Mendapatkan QR code untuk WhatsApp Web
 * @access  Admin
 */
router.get('/whatsapp/qr', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const qrCode = bot.getQRCode();

  if (!qrCode) {
    throw new APIError('QR code belum tersedia. Silakan coba beberapa saat lagi.', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      qrCode
    }
  });
}));

/**
 * @route   POST /api/settings/whatsapp/restart
 * @desc    Restart WhatsApp bot
 * @access  Admin
 */
router.post('/whatsapp/restart', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  await bot.restart();

  res.status(200).json({
    status: 'success',
    message: 'WhatsApp bot berhasil di-restart'
  });
}));

/**
 * @route   GET /api/settings/system
 * @desc    Mendapatkan pengaturan sistem
 * @access  Admin
 */
router.get('/system', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const settings = {
    activationPeriods: {
      trial: parseInt(process.env.ACTIVATION_PERIOD_TRIAL),
      monthly: parseInt(process.env.ACTIVATION_PERIOD_MONTHLY),
      yearly: parseInt(process.env.ACTIVATION_PERIOD_YEARLY)
    },
    botName: process.env.BOT_NAME,
    defaultLanguage: process.env.DEFAULT_LANGUAGE,
    environment: process.env.NODE_ENV
  };

  res.status(200).json({
    status: 'success',
    data: {
      settings
    }
  });
}));

/**
 * @route   GET /api/settings/categories
 * @desc    Mendapatkan daftar kategori transaksi
 * @access  Private
 */
router.get('/categories', protect, asyncHandler(async (req, res) => {
  const categories = {
    income: [
      'Gaji',
      'Bonus',
      'Investasi',
      'Bisnis',
      'Freelance',
      'Hadiah',
      'Penjualan',
      'Lainnya-Pendapatan'
    ],
    expense: [
      'Makanan & Minuman',
      'Transportasi',
      'Belanja',
      'Tagihan & Utilitas',
      'Hiburan',
      'Kesehatan',
      'Pendidikan',
      'Investasi',
      'Asuransi',
      'Donasi',
      'Rumah',
      'Elektronik',
      'Pakaian',
      'Olahraga',
      'Perawatan Pribadi',
      'Lainnya-Pengeluaran'
    ]
  };

  res.status(200).json({
    status: 'success',
    data: {
      categories
    }
  });
}));

/**
 * @route   GET /api/settings/bot-status
 * @desc    Mendapatkan status bot
 * @access  Admin
 */
router.get('/bot-status', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  const status = {
    isRunning: true, // Akan diupdate dengan status sebenarnya dari bot
    lastRestart: new Date(), // Akan diupdate dengan waktu restart terakhir
    activeConnections: 0, // Akan diupdate dengan jumlah koneksi aktif
    memoryUsage: process.memoryUsage()
  };

  res.status(200).json({
    status: 'success',
    data: {
      status
    }
  });
}));

/**
 * @route   POST /api/settings/backup
 * @desc    Membuat backup data
 * @access  Admin
 */
router.post('/backup', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  // TODO: Implementasi backup data
  throw new APIError('Fitur backup belum tersedia', 501);
}));

/**
 * @route   POST /api/settings/restore
 * @desc    Memulihkan data dari backup
 * @access  Admin
 */
router.post('/restore', protect, restrictTo('admin'), asyncHandler(async (req, res) => {
  // TODO: Implementasi restore data
  throw new APIError('Fitur restore belum tersedia', 501);
}));

module.exports = router;
