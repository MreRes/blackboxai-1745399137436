const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/errorHandler');
const { protect } = require('../utils/authMiddleware');
const Budget = require('../models/Budget');
const { APIError } = require('../utils/errorHandler');

/**
 * @route   POST /api/budget
 * @desc    Membuat atau mengupdate budget untuk bulan tertentu
 * @access  Private
 */
router.post('/', protect, asyncHandler(async (req, res) => {
  const { month, year, categories, totalBudget, notes } = req.body;

  // Validasi input
  if (!month || !year || !categories || !totalBudget) {
    throw new APIError('Semua field (month, year, categories, totalBudget) harus diisi', 400);
  }

  // Validasi kategori
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new APIError('Categories harus berupa array dan tidak boleh kosong', 400);
  }

  categories.forEach(category => {
    if (!category.name || !category.amount) {
      throw new APIError('Setiap kategori harus memiliki name dan amount', 400);
    }
  });

  // Cek apakah total amount kategori sama dengan totalBudget
  const totalCategoryAmount = categories.reduce((sum, cat) => sum + cat.amount, 0);
  if (totalCategoryAmount !== totalBudget) {
    throw new APIError('Total amount kategori harus sama dengan totalBudget', 400);
  }

  // Cari budget yang sudah ada atau buat baru
  let budget = await Budget.findOne({
    userId: req.user._id,
    month,
    year
  });

  if (budget) {
    // Update budget yang ada
    budget.categories = categories;
    budget.totalBudget = totalBudget;
    budget.notes = notes;
    budget.isActive = true;
  } else {
    // Buat budget baru
    budget = new Budget({
      userId: req.user._id,
      month,
      year,
      categories,
      totalBudget,
      notes
    });
  }

  await budget.save();

  res.status(201).json({
    status: 'success',
    data: {
      budget: budget
    }
  });
}));

/**
 * @route   GET /api/budget/current
 * @desc    Mendapatkan budget bulan ini
 * @access  Private
 */
router.get('/current', protect, asyncHandler(async (req, res) => {
  const budget = await Budget.getCurrentBudget(req.user._id);

  if (!budget) {
    throw new APIError('Budget untuk bulan ini belum diatur', 404);
  }

  const summary = budget.getSummary();

  res.status(200).json({
    status: 'success',
    data: {
      budget: summary
    }
  });
}));

/**
 * @route   GET /api/budget
 * @desc    Mendapatkan budget dengan filter
 * @access  Private
 */
router.get('/', protect, asyncHandler(async (req, res) => {
  const { month, year, isActive } = req.query;

  // Buat query filter
  const query = { userId: req.user._id };
  if (month) query.month = month;
  if (year) query.year = year;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const budgets = await Budget.find(query).sort('-year -month');

  res.status(200).json({
    status: 'success',
    results: budgets.length,
    data: {
      budgets: budgets.map(budget => budget.getSummary())
    }
  });
}));

/**
 * @route   GET /api/budget/:id
 * @desc    Mendapatkan detail budget
 * @access  Private
 */
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!budget) {
    throw new APIError('Budget tidak ditemukan', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      budget: budget.getSummary()
    }
  });
}));

/**
 * @route   PUT /api/budget/:id
 * @desc    Mengupdate budget
 * @access  Private
 */
router.put('/:id', protect, asyncHandler(async (req, res) => {
  const { categories, totalBudget, notes, isActive } = req.body;

  // Validasi input jika ada perubahan kategori
  if (categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
      throw new APIError('Categories harus berupa array dan tidak boleh kosong', 400);
    }

    categories.forEach(category => {
      if (!category.name || !category.amount) {
        throw new APIError('Setiap kategori harus memiliki name dan amount', 400);
      }
    });

    // Validasi total amount jika totalBudget juga diupdate
    if (totalBudget) {
      const totalCategoryAmount = categories.reduce((sum, cat) => sum + cat.amount, 0);
      if (totalCategoryAmount !== totalBudget) {
        throw new APIError('Total amount kategori harus sama dengan totalBudget', 400);
      }
    }
  }

  const budget = await Budget.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!budget) {
    throw new APIError('Budget tidak ditemukan', 404);
  }

  // Update fields
  if (categories) budget.categories = categories;
  if (totalBudget) budget.totalBudget = totalBudget;
  if (notes !== undefined) budget.notes = notes;
  if (isActive !== undefined) budget.isActive = isActive;

  await budget.save();

  res.status(200).json({
    status: 'success',
    data: {
      budget: budget.getSummary()
    }
  });
}));

/**
 * @route   DELETE /api/budget/:id
 * @desc    Menghapus budget
 * @access  Private
 */
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!budget) {
    throw new APIError('Budget tidak ditemukan', 404);
  }

  await budget.remove();

  res.status(200).json({
    status: 'success',
    message: 'Budget berhasil dihapus'
  });
}));

/**
 * @route   GET /api/budget/trend/:months
 * @desc    Mendapatkan trend budget beberapa bulan terakhir
 * @access  Private
 */
router.get('/trend/:months', protect, asyncHandler(async (req, res) => {
  const months = parseInt(req.params.months) || 6;
  
  const trends = await Budget.getBudgetTrend(req.user._id, months);

  res.status(200).json({
    status: 'success',
    data: {
      trends: trends.map(budget => budget.getSummary())
    }
  });
}));

/**
 * @route   GET /api/budget/alerts
 * @desc    Mendapatkan kategori yang melebihi atau hampir melebihi budget
 * @access  Private
 */
router.get('/alerts', protect, asyncHandler(async (req, res) => {
  const currentBudget = await Budget.getCurrentBudget(req.user._id);

  if (!currentBudget) {
    throw new APIError('Budget untuk bulan ini belum diatur', 404);
  }

  const overBudgetCategories = currentBudget.getOverBudgetCategories();

  res.status(200).json({
    status: 'success',
    data: {
      alerts: overBudgetCategories.map(cat => ({
        category: cat.name,
        budget: currentBudget.formatAmount(cat.amount),
        spent: currentBudget.formatAmount(cat.spent),
        percentage: ((cat.spent / cat.amount) * 100).toFixed(1)
      }))
    }
  });
}));

module.exports = router;
