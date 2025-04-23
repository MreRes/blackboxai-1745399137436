const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/errorHandler');
const { protect } = require('../utils/authMiddleware');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { APIError } = require('../utils/errorHandler');
const moment = require('moment');
require('moment/locale/id');
moment.locale('id');

/**
 * @route   GET /api/reports/daily
 * @desc    Mendapatkan laporan harian
 * @access  Private
 */
router.get('/daily', protect, asyncHandler(async (req, res) => {
  const { date = new Date() } = req.query;
  const startDate = moment(date).startOf('day').toDate();
  const endDate = moment(date).endOf('day').toDate();

  const transactions = await Transaction.find({
    userId: req.user._id,
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort('timestamp');

  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Grup transaksi berdasarkan kategori
  const categorySummary = await Transaction.getCategorySummary(
    req.user._id,
    startDate,
    endDate
  );

  res.status(200).json({
    status: 'success',
    data: {
      date: moment(date).format('LL'),
      summary: {
        income,
        expense,
        balance: income - expense
      },
      categorySummary,
      transactions: transactions.map(t => t.getSummary())
    }
  });
}));

/**
 * @route   GET /api/reports/monthly
 * @desc    Mendapatkan laporan bulanan
 * @access  Private
 */
router.get('/monthly', protect, asyncHandler(async (req, res) => {
  const { month = moment().month() + 1, year = moment().year() } = req.query;
  const startDate = moment({ year, month: month - 1 }).startOf('month').toDate();
  const endDate = moment({ year, month: month - 1 }).endOf('month').toDate();

  // Dapatkan transaksi
  const transactions = await Transaction.find({
    userId: req.user._id,
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort('timestamp');

  // Dapatkan budget bulan ini
  const budget = await Budget.findOne({
    userId: req.user._id,
    month,
    year
  });

  // Hitung total income dan expense
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Grup transaksi per hari
  const dailyTransactions = transactions.reduce((acc, t) => {
    const day = moment(t.timestamp).format('YYYY-MM-DD');
    if (!acc[day]) {
      acc[day] = {
        date: moment(t.timestamp).format('LL'),
        income: 0,
        expense: 0,
        transactions: []
      };
    }
    if (t.type === 'income') acc[day].income += t.amount;
    if (t.type === 'expense') acc[day].expense += t.amount;
    acc[day].transactions.push(t.getSummary());
    return acc;
  }, {});

  // Grup transaksi berdasarkan kategori
  const categorySummary = await Transaction.getCategorySummary(
    req.user._id,
    startDate,
    endDate
  );

  res.status(200).json({
    status: 'success',
    data: {
      period: moment(startDate).format('MMMM YYYY'),
      summary: {
        income,
        expense,
        balance: income - expense,
        budget: budget ? budget.getSummary() : null
      },
      categorySummary,
      dailyTransactions: Object.values(dailyTransactions)
    }
  });
}));

/**
 * @route   GET /api/reports/yearly
 * @desc    Mendapatkan laporan tahunan
 * @access  Private
 */
router.get('/yearly', protect, asyncHandler(async (req, res) => {
  const { year = moment().year() } = req.query;
  const startDate = moment({ year }).startOf('year').toDate();
  const endDate = moment({ year }).endOf('year').toDate();

  // Dapatkan transaksi
  const transactions = await Transaction.find({
    userId: req.user._id,
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort('timestamp');

  // Dapatkan semua budget tahun ini
  const budgets = await Budget.find({
    userId: req.user._id,
    year
  }).sort('month');

  // Hitung total income dan expense
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Grup transaksi per bulan
  const monthlyTransactions = transactions.reduce((acc, t) => {
    const month = moment(t.timestamp).format('YYYY-MM');
    if (!acc[month]) {
      acc[month] = {
        month: moment(t.timestamp).format('MMMM YYYY'),
        income: 0,
        expense: 0,
        categories: {}
      };
    }
    if (t.type === 'income') acc[month].income += t.amount;
    if (t.type === 'expense') acc[month].expense += t.amount;
    
    // Grup per kategori dalam bulan
    if (!acc[month].categories[t.category]) {
      acc[month].categories[t.category] = {
        amount: 0,
        count: 0
      };
    }
    acc[month].categories[t.category].amount += t.amount;
    acc[month].categories[t.category].count += 1;
    
    return acc;
  }, {});

  // Grup transaksi berdasarkan kategori
  const categorySummary = await Transaction.getCategorySummary(
    req.user._id,
    startDate,
    endDate
  );

  res.status(200).json({
    status: 'success',
    data: {
      year,
      summary: {
        income,
        expense,
        balance: income - expense,
        averageMonthlyIncome: income / 12,
        averageMonthlyExpense: expense / 12
      },
      budgets: budgets.map(b => b.getSummary()),
      categorySummary,
      monthlyTransactions: Object.values(monthlyTransactions)
    }
  });
}));

/**
 * @route   GET /api/reports/trends
 * @desc    Mendapatkan tren keuangan
 * @access  Private
 */
router.get('/trends', protect, asyncHandler(async (req, res) => {
  const { months = 12 } = req.query;
  const endDate = moment().endOf('month').toDate();
  const startDate = moment().subtract(months - 1, 'months').startOf('month').toDate();

  // Dapatkan transaksi
  const transactions = await Transaction.find({
    userId: req.user._id,
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort('timestamp');

  // Dapatkan budgets
  const budgets = await Budget.find({
    userId: req.user._id,
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort('timestamp');

  // Grup transaksi per bulan
  const monthlyTrends = {};
  
  // Inisialisasi array untuk setiap bulan
  for (let m = 0; m < months; m++) {
    const monthDate = moment(startDate).add(m, 'months');
    const monthKey = monthDate.format('YYYY-MM');
    monthlyTrends[monthKey] = {
      month: monthDate.format('MMMM YYYY'),
      income: 0,
      expense: 0,
      budget: 0,
      categories: {}
    };
  }

  // Isi data transaksi
  transactions.forEach(t => {
    const monthKey = moment(t.timestamp).format('YYYY-MM');
    if (t.type === 'income') {
      monthlyTrends[monthKey].income += t.amount;
    } else {
      monthlyTrends[monthKey].expense += t.amount;
    }

    // Update kategori
    if (!monthlyTrends[monthKey].categories[t.category]) {
      monthlyTrends[monthKey].categories[t.category] = 0;
    }
    monthlyTrends[monthKey].categories[t.category] += t.amount;
  });

  // Isi data budget
  budgets.forEach(b => {
    const monthKey = moment({ year: b.year, month: b.month - 1 }).format('YYYY-MM');
    if (monthlyTrends[monthKey]) {
      monthlyTrends[monthKey].budget = b.totalBudget;
    }
  });

  res.status(200).json({
    status: 'success',
    data: {
      trends: Object.values(monthlyTrends)
    }
  });
}));

/**
 * @route   GET /api/reports/insights
 * @desc    Mendapatkan insight keuangan
 * @access  Private
 */
router.get('/insights', protect, asyncHandler(async (req, res) => {
  const now = moment();
  const thisMonth = {
    start: now.clone().startOf('month').toDate(),
    end: now.clone().endOf('month').toDate()
  };
  const lastMonth = {
    start: now.clone().subtract(1, 'month').startOf('month').toDate(),
    end: now.clone().subtract(1, 'month').endOf('month').toDate()
  };

  // Dapatkan transaksi bulan ini dan bulan lalu
  const thisMonthTransactions = await Transaction.find({
    userId: req.user._id,
    timestamp: { $gte: thisMonth.start, $lte: thisMonth.end }
  });

  const lastMonthTransactions = await Transaction.find({
    userId: req.user._id,
    timestamp: { $gte: lastMonth.start, $lte: lastMonth.end }
  });

  // Hitung statistik
  const calculateStats = (transactions) => ({
    income: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
    expense: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
    topExpenseCategories: Object.entries(
      transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + t.amount;
          return acc;
        }, {})
    )
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
  });

  const thisMonthStats = calculateStats(thisMonthTransactions);
  const lastMonthStats = calculateStats(lastMonthTransactions);

  // Dapatkan budget bulan ini
  const currentBudget = await Budget.getCurrentBudget(req.user._id);

  // Generate insights
  const insights = [];

  // Perbandingan dengan bulan lalu
  const incomeChange = ((thisMonthStats.income - lastMonthStats.income) / lastMonthStats.income) * 100;
  const expenseChange = ((thisMonthStats.expense - lastMonthStats.expense) / lastMonthStats.expense) * 100;

  insights.push({
    type: 'income_comparison',
    message: `Pendapatan bulan ini ${incomeChange > 0 ? 'naik' : 'turun'} ${Math.abs(incomeChange).toFixed(1)}% dibanding bulan lalu`
  });

  insights.push({
    type: 'expense_comparison',
    message: `Pengeluaran bulan ini ${expenseChange > 0 ? 'naik' : 'turun'} ${Math.abs(expenseChange).toFixed(1)}% dibanding bulan lalu`
  });

  // Budget insights
  if (currentBudget) {
    const overBudgetCategories = currentBudget.getOverBudgetCategories();
    if (overBudgetCategories.length > 0) {
      insights.push({
        type: 'budget_warning',
        message: `${overBudgetCategories.length} kategori telah melewati budget: ${overBudgetCategories.map(c => c.name).join(', ')}`
      });
    }
  }

  // Top expense category
  const [topCategory, topAmount] = thisMonthStats.topExpenseCategories[0] || [];
  if (topCategory) {
    insights.push({
      type: 'top_expense',
      message: `Pengeluaran terbesar bulan ini adalah kategori ${topCategory} (${new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR'
      }).format(topAmount)})`
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      currentMonth: {
        period: moment(thisMonth.start).format('MMMM YYYY'),
        ...thisMonthStats
      },
      previousMonth: {
        period: moment(lastMonth.start).format('MMMM YYYY'),
        ...lastMonthStats
      },
      insights
    }
  });
}));

module.exports = router;
