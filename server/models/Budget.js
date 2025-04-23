const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: true,
    min: 2023
  },
  categories: [{
    name: {
      type: String,
      required: true,
      enum: [
        // Kategori Pengeluaran
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
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    spent: {
      type: Number,
      default: 0
    },
    alert: {
      type: Number, // Persentase untuk alert (e.g., 80 untuk 80%)
      default: 80
    }
  }],
  totalBudget: {
    type: Number,
    required: true,
    min: 0
  },
  notes: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index untuk pencarian
budgetSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

// Update timestamp sebelum save
budgetSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method untuk mendapatkan persentase penggunaan budget
budgetSchema.methods.getUsagePercentage = function() {
  const totalSpent = this.categories.reduce((acc, cat) => acc + (cat.spent || 0), 0);
  return (totalSpent / this.totalBudget) * 100;
};

// Method untuk mengecek kategori yang melebihi budget
budgetSchema.methods.getOverBudgetCategories = function() {
  return this.categories.filter(cat => {
    const percentage = (cat.spent / cat.amount) * 100;
    return percentage >= cat.alert;
  });
};

// Method untuk memformat jumlah ke format rupiah
budgetSchema.methods.formatAmount = function(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(amount);
};

// Method untuk mendapatkan ringkasan budget
budgetSchema.methods.getSummary = function() {
  const totalSpent = this.categories.reduce((acc, cat) => acc + (cat.spent || 0), 0);
  const remaining = this.totalBudget - totalSpent;
  
  return {
    month: this.month,
    year: this.year,
    totalBudget: this.formatAmount(this.totalBudget),
    totalSpent: this.formatAmount(totalSpent),
    remaining: this.formatAmount(remaining),
    usagePercentage: this.getUsagePercentage(),
    categories: this.categories.map(cat => ({
      name: cat.name,
      budget: this.formatAmount(cat.amount),
      spent: this.formatAmount(cat.spent || 0),
      percentage: ((cat.spent || 0) / cat.amount) * 100,
      isOverBudget: ((cat.spent || 0) / cat.amount) * 100 >= cat.alert
    }))
  };
};

// Static method untuk mendapatkan budget aktif berdasarkan userId
budgetSchema.statics.getCurrentBudget = async function(userId) {
  const now = new Date();
  return await this.findOne({
    userId,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    isActive: true
  });
};

// Static method untuk mendapatkan trend budget beberapa bulan terakhir
budgetSchema.statics.getBudgetTrend = async function(userId, months = 6) {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1);
  
  return await this.find({
    userId,
    year: {
      $gte: startDate.getFullYear()
    },
    month: {
      $gte: startDate.getMonth() + 1
    },
    isActive: true
  }).sort({ year: 1, month: 1 });
};

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;
