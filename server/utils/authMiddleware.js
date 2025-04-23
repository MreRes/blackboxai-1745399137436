const jwt = require('jsonwebtoken');
const { APIError } = require('./errorHandler');
const User = require('../models/User');

/**
 * Middleware untuk memproteksi route yang membutuhkan autentikasi
 */
exports.protect = async (req, res, next) => {
  try {
    // 1) Cek jika token ada
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new APIError('Anda belum login. Silakan login terlebih dahulu.', 401)
      );
    }

    // 2) Verifikasi token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Cek jika user masih ada
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(
        new APIError('User dengan token ini sudah tidak ada lagi.', 401)
      );
    }

    // 4) Cek jika user adalah regular user dan memiliki kode aktivasi yang masih aktif
    if (!user.isAdmin) {
      if (user.isActivationExpired()) {
        return next(
          new APIError('Kode aktivasi Anda telah kadaluarsa. Silakan hubungi admin untuk perpanjangan.', 401)
        );
      }
    }

    // Grant access to protected route
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware untuk membatasi akses berdasarkan role
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.isAdmin ? 'admin' : 'user')) {
      return next(
        new APIError('Anda tidak memiliki izin untuk mengakses route ini.', 403)
      );
    }
    next();
  };
};

/**
 * Middleware untuk memvalidasi nomor WhatsApp
 */
exports.validateWhatsApp = async (req, res, next) => {
  try {
    const phoneNumber = req.body.phoneNumber || req.query.phoneNumber;
    
    if (!phoneNumber) {
      return next(
        new APIError('Nomor WhatsApp diperlukan.', 400)
      );
    }

    // Cek apakah nomor sudah terdaftar
    const existingUser = await User.findOne({
      'phoneNumbers.number': phoneNumber
    });

    if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
      return next(
        new APIError('Nomor WhatsApp ini sudah terdaftar pada user lain.', 400)
      );
    }

    // Jika nomor valid, lanjutkan
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware untuk memvalidasi kode aktivasi
 */
exports.validateActivationCode = async (req, res, next) => {
  try {
    const { username, activationCode } = req.body;

    const user = await User.findOne({ username });

    if (!user) {
      return next(
        new APIError('Username atau kode aktivasi tidak valid.', 401)
      );
    }

    if (user.activationCode !== activationCode) {
      return next(
        new APIError('Username atau kode aktivasi tidak valid.', 401)
      );
    }

    if (user.isActivationExpired()) {
      return next(
        new APIError('Kode aktivasi telah kadaluarsa. Silakan hubungi admin untuk perpanjangan.', 401)
      );
    }

    // Jika kode aktivasi valid, lanjutkan
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Generate JWT Token
 */
exports.signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

/**
 * Create and send token response
 */
exports.createSendToken = (user, statusCode, res) => {
  const token = exports.signToken(user._id);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};
