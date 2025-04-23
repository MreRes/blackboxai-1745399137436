const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      // Kategori Pendapatan
      'Gaji',
      'Bonus',
      'Investasi',
      'Bisnis',
      'Freelance',
      'Hadiah',
      'Penjualan',
      'Lainnya-Pendapatan',
      
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
  description: {
    type: String,
    required: true,
    trim: true
  },
  source: {
    type: String,
    required: true,
    trim: true
  },
  attachments: [{
    type: String,
    trim: true
  }],
  timestamp: {
    type: Date,
    default: Date.now
  },
  tags: [{
    type: String,
    trim: true
  }],
  location: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index untuk pencarian dan filtering
transactionSchema.index({ userId: 1, timestamp: -1 });
transactionSchema.index({ category: 1 });
transactionSchema.index({ type: 1 });

// Method untuk memformat jumlah ke format rupiah
transactionSchema.methods.formatAmount = function() {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR'
  }).format(this.amount);
};

// Method untuk mendapatkan ringkasan transaksi
transactionSchema.methods.getSummary = function() {
  return {
    type: this.type === 'income' ? 'Pendapatan' : 'Pengeluaran',
    amount: this.formatAmount(),
    category: this.category,
    description: this.description,
    date: new Date(this.timestamp).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  };
};

// Static method untuk mendapatkan total berdasarkan tipe dan rentang waktu
transactionSchema.statics.getTotal = async function(userId, type, startDate, endDate) {
  const match = {
    userId,
    type,
    timestamp: {
      $gte: startDate,
      $lte: endDate
    }
  };

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  return result.length > 0 ? result[0].total : 0;
};

// Static method untuk mendapatkan ringkasan per kategori
transactionSchema.statics.getCategorySummary = async function(userId, startDate, endDate) {
  return await this.aggregate([
    {
      $match: {
        userId,
        timestamp: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
          category: '$category'
        },
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        categories: {
          $push: {
            category: '$_id.category',
            total: '$total',
            count: '$count'
          }
        },
        totalAmount: { $sum: '$total' }
      }
    }
  ]);
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
