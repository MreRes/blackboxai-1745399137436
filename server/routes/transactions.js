const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/errorHandler');
const { protect } = require('../utils/authMiddleware');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { APIError } = require('../utils/errorHandler');

/**
 * @route   POST /api/transactions
 * @desc    Membuat transaksi baru
 * @access  Private
 */
router.post('/', protect, asyncHandler(async (req, res) => {
  const { amount, type, category, description, source } = req.body;

  // Validasi input
  if (!amount || !type || !category || !description) {
    throw new APIError('Semua field (amount, type, category, description) harus diisi', 400);
  }

  // Validasi tipe transaksi
  if (!['income', 'expense'].includes(type)) {
    throw new APIError('Tipe transaksi harus income atau expense', 400);
  }

  // Buat transaksi baru
  const transaction = new Transaction({
    userId: req.user._id,
    amount,
    type,
    category,
    description,
    source: source || 'web'
  });

  await transaction.save();

  // Jika transaksi adalah pengeluaran, update budget
  if (type === 'expense') {
    const currentBudget = await Budget.getCurrentBudget(req.user._id);
    if (currentBudget) {
      const categoryBudget = currentBudget.categories.find(
        cat => cat.name === category
      );
      if (categoryBudget) {
        categoryBudget.spent += amount;
        await currentBudget.save();

        // Jika melebihi budget, tambahkan warning di response
        if (categoryBudget.spent >= categoryBudget.amount) {
          res.status(201).json({
            status: 'success',
            data: {
              transaction: transaction,
              warning: `Pengeluaran untuk kategori ${category} telah mencapai/melebihi budget yang ditetapkan.`
            }
          });
          return;
        }
      }
    }
  }

  res.status(201).json({
    status: 'success',
    data: {
      transaction
    }
  });
}));

/**
 * @route   GET /api/transactions
 * @desc    Mendapatkan semua transaksi dengan filter
 * @access  Private
 */
router.get('/', protect, asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    type,
    category,
    source,
    page = 1,
    limit = 10,
    sort = '-timestamp'
  } = req.query;

  // Buat query filter
  const query = { userId: req.user._id };

  // Filter berdasarkan tanggal
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  // Filter lainnya
  if (type) query.type = type;
  if (category) query.category = category;
  if (source) query.source = source;

  // Hitung total documents untuk pagination
  const total = await Transaction.countDocuments(query);

  // Eksekusi query dengan pagination dan sort
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
      transactions
    }
  });
}));

/**
 * @route   GET /api/transactions/:id
 * @desc    Mendapatkan detail transaksi
 * @access  Private
 */
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!transaction) {
    throw new APIError('Transaksi tidak ditemukan', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      transaction
    }
  });
}));

/**
 * @route   PUT /api/transactions/:id
 * @desc    Mengupdate transaksi
 * @access  Private
 */
router.put('/:id', protect, asyncHandler(async (req, res) => {
  const { amount, type, category, description } = req.body;

  // Cari transaksi yang akan diupdate
  const oldTransaction = await Transaction.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!oldTransaction) {
    throw new APIError('Transaksi tidak ditemukan', 404);
  }

  // Update budget lama jika ini adalah transaksi pengeluaran
  if (oldTransaction.type === 'expense') {
    const oldBudget = await Budget.getCurrentBudget(req.user._id);
    if (oldBudget) {
      const oldCategoryBudget = oldBudget.categories.find(
        cat => cat.name === oldTransaction.category
      );
      if (oldCategoryBudget) {
        oldCategoryBudget.spent -= oldTransaction.amount;
        await oldBudget.save();
      }
    }
  }

  // Update transaksi
  const updatedTransaction = await Transaction.findByIdAndUpdate(
    req.params.id,
    {
      amount: amount || oldTransaction.amount,
      type: type || oldTransaction.type,
      category: category || oldTransaction.category,
      description: description || oldTransaction.description
    },
    {
      new: true,
      runValidators: true
    }
  );

  // Update budget baru jika ini adalah transaksi pengeluaran
  if (updatedTransaction.type === 'expense') {
    const newBudget = await Budget.getCurrentBudget(req.user._id);
    if (newBudget) {
      const newCategoryBudget = newBudget.categories.find(
        cat => cat.name === updatedTransaction.category
      );
      if (newCategoryBudget) {
        newCategoryBudget.spent += updatedTransaction.amount;
        await newBudget.save();

        // Cek jika melebihi budget
        if (newCategoryBudget.spent >= newCategoryBudget.amount) {
          res.status(200).json({
            status: 'success',
            data: {
              transaction: updatedTransaction,
              warning: `Pengeluaran untuk kategori ${updatedTransaction.category} telah mencapai/melebihi budget yang ditetapkan.`
            }
          });
          return;
        }
      }
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      transaction: updatedTransaction
    }
  });
}));

/**
 * @route   DELETE /api/transactions/:id
 * @desc    Menghapus transaksi
 * @access  Private
 */
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!transaction) {
    throw new APIError('Transaksi tidak ditemukan', 404);
  }

  // Update budget jika ini adalah transaksi pengeluaran
  if (transaction.type === 'expense') {
    const budget = await Budget.getCurrentBudget(req.user._id);
    if (budget) {
      const categoryBudget = budget.categories.find(
        cat => cat.name === transaction.category
      );
      if (categoryBudget) {
        categoryBudget.spent -= transaction.amount;
        await budget.save();
      }
    }
  }

  await transaction.remove();

  res.status(200).json({
    status: 'success',
    message: 'Transaksi berhasil dihapus'
  });
}));

/**
 * @route   GET /api/transactions/summary/category
 * @desc    Mendapatkan ringkasan transaksi per kategori
 * @access  Private
 */
router.get('/summary/category', protect, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const summary = await Transaction.getCategorySummary(
    req.user._id,
    startDate ? new Date(startDate) : new Date(0),
    endDate ? new Date(endDate) : new Date()
  );

  res.status(200).json({
    status: 'success',
    data: {
      summary
    }
  });
}));

/**
 * @route   GET /api/transactions/summary/total
 * @desc    Mendapatkan total transaksi (income/expense)
 * @access  Private
 */
router.get('/summary/total', protect, asyncHandler(async (req, res) => {
  const { startDate, endDate, type } = req.query;

  if (!type || !['income', 'expense'].includes(type)) {
    throw new APIError('Tipe transaksi (income/expense) harus disertakan', 400);
  }

  const total = await Transaction.getTotal(
    req.user._id,
    type,
    startDate ? new Date(startDate) : new Date(0),
    endDate ? new Date(endDate) : new Date()
  );

  res.status(200).json({
    status: 'success',
    data: {
      type,
      total
    }
  });
}));

module.exports = router;
