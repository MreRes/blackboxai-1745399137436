const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/errorHandler');
const { protect, validateActivationCode, createSendToken } = require('../utils/authMiddleware');
const User = require('../models/User');
const { APIError } = require('../utils/errorHandler');

/**
 * @route   POST /api/auth/user/login
 * @desc    Login user dengan username dan kode aktivasi
 * @access  Public
 */
router.post('/user/login', validateActivationCode, asyncHandler(async (req, res) => {
  createSendToken(req.user, 200, res);
}));

/**
 * @route   POST /api/auth/admin/login
 * @desc    Login admin dengan username dan password
 * @access  Public
 */
router.post('/admin/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Cek apakah username dan password ada
  if (!username || !password) {
    throw new APIError('Mohon masukkan username dan password', 400);
  }

  // Cari user admin
  const admin = await User.findOne({ username, isAdmin: true });
  if (!admin) {
    throw new APIError('Username atau password tidak valid', 401);
  }

  // Verifikasi password
  const isPasswordValid = await admin.comparePassword(password);
  if (!isPasswordValid) {
    throw new APIError('Username atau password tidak valid', 401);
  }

  createSendToken(admin, 200, res);
}));

/**
 * @route   POST /api/auth/user/register-phone
 * @desc    Mendaftarkan nomor WhatsApp baru untuk user
 * @access  Private
 */
router.post('/user/register-phone', protect, asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new APIError('Nomor WhatsApp diperlukan', 400);
  }

  // Cek apakah nomor sudah terdaftar
  const existingUser = await User.findOne({
    'phoneNumbers.number': phoneNumber
  });

  if (existingUser) {
    throw new APIError('Nomor WhatsApp ini sudah terdaftar', 400);
  }

  // Cek apakah user masih bisa menambah nomor
  if (!req.user.canAddPhoneNumber()) {
    throw new APIError('Anda telah mencapai batas maksimal nomor yang dapat didaftarkan', 400);
  }

  // Tambahkan nomor baru
  req.user.phoneNumbers.push({
    number: phoneNumber,
    isActive: true
  });

  await req.user.save();

  res.status(200).json({
    status: 'success',
    message: 'Nomor WhatsApp berhasil didaftarkan',
    data: {
      phoneNumbers: req.user.phoneNumbers
    }
  });
}));

/**
 * @route   POST /api/auth/user/verify-activation
 * @desc    Verifikasi kode aktivasi
 * @access  Public
 */
router.post('/user/verify-activation', asyncHandler(async (req, res) => {
  const { username, activationCode } = req.body;

  if (!username || !activationCode) {
    throw new APIError('Username dan kode aktivasi diperlukan', 400);
  }

  const user = await User.findOne({ username });

  if (!user) {
    throw new APIError('Username atau kode aktivasi tidak valid', 401);
  }

  if (user.activationCode !== activationCode) {
    throw new APIError('Username atau kode aktivasi tidak valid', 401);
  }

  if (user.isActivationExpired()) {
    throw new APIError('Kode aktivasi telah kadaluarsa', 401);
  }

  res.status(200).json({
    status: 'success',
    message: 'Kode aktivasi valid',
    data: {
      username: user.username,
      expiryDate: user.activationExpiry
    }
  });
}));

/**
 * @route   GET /api/auth/user/me
 * @desc    Mendapatkan data user yang sedang login
 * @access  Private
 */
router.get('/user/me', protect, asyncHandler(async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
}));

/**
 * @route   PUT /api/auth/user/deactivate-phone
 * @desc    Menonaktifkan nomor WhatsApp
 * @access  Private
 */
router.put('/user/deactivate-phone', protect, asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new APIError('Nomor WhatsApp diperlukan', 400);
  }

  const phoneIndex = req.user.phoneNumbers.findIndex(
    phone => phone.number === phoneNumber
  );

  if (phoneIndex === -1) {
    throw new APIError('Nomor WhatsApp tidak ditemukan', 404);
  }

  req.user.phoneNumbers[phoneIndex].isActive = false;
  await req.user.save();

  res.status(200).json({
    status: 'success',
    message: 'Nomor WhatsApp berhasil dinonaktifkan',
    data: {
      phoneNumbers: req.user.phoneNumbers
    }
  });
}));

/**
 * @route   PUT /api/auth/user/reactivate-phone
 * @desc    Mengaktifkan kembali nomor WhatsApp
 * @access  Private
 */
router.put('/user/reactivate-phone', protect, asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new APIError('Nomor WhatsApp diperlukan', 400);
  }

  const phoneIndex = req.user.phoneNumbers.findIndex(
    phone => phone.number === phoneNumber
  );

  if (phoneIndex === -1) {
    throw new APIError('Nomor WhatsApp tidak ditemukan', 404);
  }

  req.user.phoneNumbers[phoneIndex].isActive = true;
  req.user.phoneNumbers[phoneIndex].activatedAt = new Date();
  await req.user.save();

  res.status(200).json({
    status: 'success',
    message: 'Nomor WhatsApp berhasil diaktifkan kembali',
    data: {
      phoneNumbers: req.user.phoneNumbers
    }
  });
}));

module.exports = router;
