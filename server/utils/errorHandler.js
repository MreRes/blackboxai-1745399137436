/**
 * Custom error class untuk API errors
 */
class APIError extends Error {
  constructor(message, statusCode, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle MongoDB duplicate key errors
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const message = `${field} sudah digunakan. Mohon gunakan ${field} yang lain.`;
  return new APIError(message, 400);
};

/**
 * Handle MongoDB validation errors
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Data tidak valid. ${errors.join('. ')}`;
  return new APIError(message, 400, errors);
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => 
  new APIError('Token tidak valid. Silakan login kembali.', 401);

/**
 * Handle JWT expired error
 */
const handleJWTExpiredError = () => 
  new APIError('Token Anda telah kadaluarsa. Silakan login kembali.', 401);

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error untuk development
  if (process.env.NODE_ENV === 'development') {
    console.error('ERROR 💥:', err);
  }

  // Handle specific errors
  let error = { ...err };
  error.message = err.message;

  if (error.code === 11000) error = handleDuplicateKeyError(error);
  if (error.name === 'ValidationError') error = handleValidationError(error);
  if (error.name === 'JsonWebTokenError') error = handleJWTError();
  if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

  // Send error response
  if (process.env.NODE_ENV === 'development') {
    // Development error response - with error details
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      error: err,
      stack: err.stack
    });
  } else {
    // Production error response - without error details
    if (err.isOperational) {
      // Operational, trusted error: send message to client
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    } else {
      // Programming or other unknown error: don't leak error details
      console.error('ERROR 💥:', err);
      res.status(500).json({
        status: 'error',
        message: 'Terjadi kesalahan pada server. Mohon coba beberapa saat lagi.'
      });
    }
  }
};

/**
 * Async handler wrapper to eliminate try-catch blocks
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * Not Found error handler
 */
const notFound = (req, res, next) => {
  const err = new APIError(`Tidak dapat menemukan ${req.originalUrl} pada server ini.`, 404);
  next(err);
};

module.exports = {
  APIError,
  errorHandler,
  asyncHandler,
  notFound
};
