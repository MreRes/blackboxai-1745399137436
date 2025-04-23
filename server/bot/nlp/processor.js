const { NlpManager } = require('node-nlp');
const moment = require('moment');
require('moment/locale/id');  // Set locale ke bahasa Indonesia
moment.locale('id');

// Constants for date formatting and responses
const DATE_FORMAT = {
  full: {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  },
  short: {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  },
  time: {
    hour: '2-digit',
    minute: '2-digit'
  }
};

// Currency formatter
const CURRENCY_FORMAT = {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
};

class NLPProcessor {
  constructor() {
    this.manager = new NlpManager({ languages: ['id'], forceNER: true });
    this.initializeManager();
  }

  async initializeManager() {
    // Training data untuk intent
    this.addTransactionIntents();
    this.addReportIntents();
    this.addBudgetIntents();
    this.addHelpIntents();

    // Training data untuk entities
    this.addAmountEntities();
    this.addCategoryEntities();
    this.addDateEntities();
    
    // Train the model
    await this.manager.train();
  }

  addTransactionIntents() {
    // Intent pencatatan pengeluaran
    this.manager.addDocument('id', 'catat pengeluaran (amount) untuk (category)', 'transaction.expense');
    this.manager.addDocument('id', 'keluar (amount) buat (category)', 'transaction.expense');
    this.manager.addDocument('id', 'bayar (amount) untuk (category)', 'transaction.expense');
    this.manager.addDocument('id', 'habis (amount) di (category)', 'transaction.expense');
    this.manager.addDocument('id', 'beli (category) (amount)', 'transaction.expense');
    this.manager.addDocument('id', 'belanja (category) (amount)', 'transaction.expense');

    // Intent pencatatan pemasukan
    this.manager.addDocument('id', 'catat pemasukan (amount) dari (category)', 'transaction.income');
    this.manager.addDocument('id', 'masuk (amount) dari (category)', 'transaction.income');
    this.manager.addDocument('id', 'terima (amount) dari (category)', 'transaction.income');
    this.manager.addDocument('id', 'dapat (amount) dari (category)', 'transaction.income');
    this.manager.addDocument('id', 'gajian (amount)', 'transaction.income');
  }

  addReportIntents() {
    // Intent melihat laporan
    this.manager.addDocument('id', 'lihat laporan', 'report.view');
    this.manager.addDocument('id', 'cek laporan', 'report.view');
    this.manager.addDocument('id', 'tampilkan laporan', 'report.view');
    this.manager.addDocument('id', 'ringkasan keuangan', 'report.view');
    this.manager.addDocument('id', 'laporan bulan ini', 'report.view');
    this.manager.addDocument('id', 'laporan minggu ini', 'report.view');
    this.manager.addDocument('id', 'total pengeluaran', 'report.expense');
    this.manager.addDocument('id', 'total pemasukan', 'report.income');

    // Intent melihat riwayat transaksi
    this.manager.addDocument('id', 'lihat riwayat', 'transaction.history');
    this.manager.addDocument('id', 'riwayat transaksi', 'transaction.history');
    this.manager.addDocument('id', 'transaksi terakhir', 'transaction.history');
    this.manager.addDocument('id', 'history transaksi', 'transaction.history');
    this.manager.addDocument('id', 'cek transaksi', 'transaction.history');
    this.manager.addDocument('id', 'tampilkan transaksi', 'transaction.history');
    this.manager.addDocument('id', 'lihat mutasi', 'transaction.history');
    this.manager.addDocument('id', 'mutasi terakhir', 'transaction.history');
    this.manager.addDocument('id', 'lihat riwayat transaksi (period)', 'transaction.history');
    this.manager.addDocument('id', 'riwayat (period)', 'transaction.history');

    // Intent export riwayat transaksi
    this.manager.addDocument('id', 'export riwayat', 'transaction.export');
    this.manager.addDocument('id', 'export transaksi', 'transaction.export');
    this.manager.addDocument('id', 'unduh riwayat', 'transaction.export');
    this.manager.addDocument('id', 'unduh transaksi', 'transaction.export');
    this.manager.addDocument('id', 'download riwayat', 'transaction.export');
    this.manager.addDocument('id', 'download transaksi', 'transaction.export');
    this.manager.addDocument('id', 'export riwayat (period)', 'transaction.export');
    this.manager.addDocument('id', 'unduh riwayat (period)', 'transaction.export');
  }

  addBudgetIntents() {
    // Intent budget
    this.manager.addDocument('id', 'atur budget (category) (amount)', 'budget.set');
    this.manager.addDocument('id', 'set budget (category) (amount)', 'budget.set');
    this.manager.addDocument('id', 'tentukan budget (category) (amount)', 'budget.set');
    this.manager.addDocument('id', 'lihat budget', 'budget.view');
    this.manager.addDocument('id', 'cek budget', 'budget.view');
  }

  addHelpIntents() {
    // Intent bantuan
    this.manager.addDocument('id', 'bantuan', 'help');
    this.manager.addDocument('id', 'cara pakai', 'help');
    this.manager.addDocument('id', 'tutorial', 'help');
    this.manager.addDocument('id', 'contoh command', 'help');
  }

  addAmountEntities() {
    // Entity untuk nominal uang
    this.manager.addNamedEntityText('amount', '1000', ['id'], ['1000', '1rb', '1 ribu']);
    this.manager.addNamedEntityText('amount', '2000', ['id'], ['2000', '2rb', '2 ribu']);
    // ... tambahkan entity lainnya
    
    // Regex untuk mendeteksi format nominal
    this.manager.addRegexEntity('amount', 'id', /(Rp\.?\s?)?(\d+(\.\d{3})*(\,\d{2})?)(rb|ribu|k|jt|juta|m|mio|million)?/i);
  }

  addCategoryEntities() {
    // Entity untuk kategori
    const categories = {
      // Pendapatan
      'Gaji': ['gaji', 'gajian', 'salary'],
      'Bonus': ['bonus', 'thr', 'insentif'],
      'Investasi': ['investasi', 'dividen', 'bunga', 'return'],
      'Bisnis': ['bisnis', 'usaha', 'dagang'],
      'Freelance': ['freelance', 'project', 'kerjaan'],
      
      // Pengeluaran
      'Makanan & Minuman': ['makan', 'makanan', 'minuman', 'food', 'snack', 'jajan'],
      'Transportasi': ['transport', 'bensin', 'parkir', 'toll', 'grab', 'gojek'],
      'Belanja': ['belanja', 'shopping', 'beli', 'mart'],
      'Tagihan': ['tagihan', 'listrik', 'air', 'internet', 'pulsa', 'wifi'],
      'Hiburan': ['hiburan', 'movie', 'film', 'game', 'entertainment'],
    };

    for (const [category, synonyms] of Object.entries(categories)) {
      this.manager.addNamedEntityText('category', category, ['id'], synonyms);
    }
  }

  addDateEntities() {
    // Entity untuk tanggal relatif
    const dates = {
      'hari ini': ['hari ini', 'saat ini', 'sekarang', 'hari', 'today', 'hr ini', 'skrg'],
      'kemarin': ['kemarin', 'yesterday', 'yest', 'kmrn', 'kemaren', 'kmrin'],
      'minggu ini': ['minggu ini', 'pekan ini', 'week', 'minggu', 'week ini', 'mgg ini', 'minggu skrg'],
      'bulan ini': ['bulan ini', 'month', 'bulan', 'month ini', 'bln ini', 'bulan skrg'],
      'tahun ini': ['tahun ini', 'year', 'tahun', 'year ini', 'thn ini', 'tahun skrg'],
      'minggu lalu': ['minggu lalu', 'pekan lalu', 'last week', 'minggu kemarin', 'mgg lalu', 'minggu kmrn'],
      'bulan lalu': ['bulan lalu', 'last month', 'bulan kemarin', 'bln lalu', 'bulan kmrn'],
      'tahun lalu': ['tahun lalu', 'last year', 'tahun kemarin', 'thn lalu', 'tahun kmrn'],
      'awal bulan': ['awal bulan', 'awal bln', 'permulaan bulan'],
      'akhir bulan': ['akhir bulan', 'akhir bln', 'penghujung bulan'],
      'bulan depan': ['bulan depan', 'next month', 'bln depan', 'bulan berikutnya'],
      'minggu depan': ['minggu depan', 'next week', 'mgg depan', 'pekan depan']
    };

    // Tambah sinonim untuk bulan
    const months = {
      'januari': ['jan', 'january', 'januari'],
      'februari': ['feb', 'february', 'februari'],
      'maret': ['mar', 'march', 'maret'],
      'april': ['apr', 'april'],
      'mei': ['may', 'mei'],
      'juni': ['jun', 'june', 'juni'],
      'juli': ['jul', 'july', 'juli'],
      'agustus': ['aug', 'august', 'agustus', 'ags'],
      'september': ['sep', 'sept', 'september'],
      'oktober': ['oct', 'october', 'oktober', 'okt'],
      'november': ['nov', 'november'],
      'desember': ['dec', 'december', 'desember', 'des']
    };

    // Tambah entity untuk tanggal relatif
    for (const [date, synonyms] of Object.entries(dates)) {
      this.manager.addNamedEntityText('date', date, ['id'], synonyms);
    }

    // Tambah entity untuk bulan
    for (const [month, synonyms] of Object.entries(months)) {
      this.manager.addNamedEntityText('month', month, ['id'], synonyms);
    }

    // Regex untuk format tanggal
    const datePatterns = [
      // Format DD/MM/YYYY atau DD-MM-YYYY
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/,
      
      // Format DD Bulan YYYY (e.g., "15 januari 2024")
      /(\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})/i,
      
      // Format Bulan YYYY (e.g., "januari 2024")
      /(?:jan|feb|mar|apr|mei|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}/i,
      
      // Format DD Bulan (e.g., "15 januari")
      /(\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|aug|sep|oct|nov|dec)[a-z]*)/i,
      
      // Format tanggal dengan kata "tanggal" (e.g., "tanggal 15 januari")
      /tanggal\s+(\d{1,2})(?:\s+(?:jan|feb|mar|apr|mei|jun|jul|aug|sep|oct|nov|dec)[a-z]*)?/i,
      
      // Format "awal/akhir/pertengahan bulan" dengan opsional nama bulan
      /(?:awal|akhir|pertengahan)\s+(?:bulan|bln)(?:\s+(?:jan|feb|mar|apr|mei|jun|jul|aug|sep|oct|nov|dec)[a-z]*)?/i
    ];

    // Tambahkan semua pattern sebagai regex entity
    datePatterns.forEach(pattern => {
      this.manager.addRegexEntity('date', 'id', pattern);
    });
  }

  // Override process message untuk menangani format tanggal
  async processMessage(message) {
    try {
      const result = await this.manager.process('id', message);
      const entities = {};

      if (result.entities && result.entities.length > 0) {
        result.entities.forEach(entity => {
          if (entity.entity === 'amount') {
            entities.amount = this.normalizeAmount(entity.sourceText);
          } else if (entity.entity === 'date') {
            entities.date = this.normalizeDate(entity.sourceText);
          } else {
            entities[entity.entity] = entity.option || entity.sourceText;
          }
        });
      }

      return {
        intent: result.intent,
        entities: entities,
        confidence: result.score,
        originalMessage: message
      };
    } catch (error) {
      console.error('Error processing message:', error);
      throw new Error('Gagal memproses pesan');
    }
  }

  // Helper untuk normalisasi tanggal
  normalizeDate(dateStr) {
    const lowerDateStr = dateStr.toLowerCase().trim();

    // Jika sudah dalam format yang dikenali, kembalikan langsung
    const knownFormats = [
      'hari ini', 'kemarin', 'minggu ini', 'bulan ini', 'tahun ini',
      'minggu lalu', 'bulan lalu', 'tahun lalu', 'awal bulan', 'akhir bulan',
      'bulan depan', 'minggu depan'
    ];
    if (knownFormats.includes(lowerDateStr)) {
      return lowerDateStr;
    }

    try {
      // Handle format DD/MM/YYYY atau DD-MM-YYYY
      if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(lowerDateStr)) {
        const [day, month, year] = lowerDateStr.split(/[-\/]/);
        const date = new Date(year, month - 1, day);
        if (!isNaN(date)) {
          return date.toISOString().split('T')[0];
        }
      }

      // Handle format "tanggal DD bulan YYYY"
      const tanggalMatch = lowerDateStr.match(/tanggal\s+(\d{1,2})(?:\s+([a-z]+))?(?:\s+(\d{4}))?/);
      if (tanggalMatch) {
        const day = parseInt(tanggalMatch[1]);
        let month = new Date().getMonth();
        let year = new Date().getFullYear();

        if (tanggalMatch[2]) {
          const monthNames = {
            'januari': 0, 'jan': 0, 'februari': 1, 'feb': 1,
            'maret': 2, 'mar': 2, 'april': 3, 'apr': 3,
            'mei': 4, 'may': 4, 'juni': 5, 'jun': 5,
            'juli': 6, 'jul': 6, 'agustus': 7, 'aug': 7, 'ags': 7,
            'september': 8, 'sep': 8, 'oktober': 9, 'okt': 9,
            'november': 10, 'nov': 10, 'desember': 11, 'des': 11
          };
          month = monthNames[tanggalMatch[2]] || month;
        }

        if (tanggalMatch[3]) {
          year = parseInt(tanggalMatch[3]);
        }

        const date = new Date(year, month, day);
        if (!isNaN(date)) {
          return date.toISOString().split('T')[0];
        }
      }

      // Handle format "bulan YYYY"
      const monthYearMatch = lowerDateStr.match(/([a-z]+)(?:\s+(\d{4}))?/);
      if (monthYearMatch) {
        const monthNames = {
          'januari': 0, 'jan': 0, 'februari': 1, 'feb': 1,
          'maret': 2, 'mar': 2, 'april': 3, 'apr': 3,
          'mei': 4, 'may': 4, 'juni': 5, 'jun': 5,
          'juli': 6, 'jul': 6, 'agustus': 7, 'aug': 7, 'ags': 7,
          'september': 8, 'sep': 8, 'oktober': 9, 'okt': 9,
          'november': 10, 'nov': 10, 'desember': 11, 'des': 11
        };

        const month = monthNames[monthYearMatch[1]];
        if (month !== undefined) {
          const year = monthYearMatch[2] ? parseInt(monthYearMatch[2]) : new Date().getFullYear();
          const date = new Date(year, month, 1);
          if (!isNaN(date)) {
            return date.toISOString().split('T')[0];
          }
        }
      }

      // Handle "awal/akhir/pertengahan bulan"
      if (lowerDateStr.includes('awal bulan')) {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      } else if (lowerDateStr.includes('akhir bulan')) {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      } else if (lowerDateStr.includes('pertengahan bulan')) {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 15).toISOString().split('T')[0];
      }

      // Coba parse tanggal dari string
      const date = new Date(dateStr);
      if (!isNaN(date)) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.error('Error normalizing date:', error);
    }

    // Default ke hari ini jika format tidak dikenali
    return 'hari ini';
  }

  normalizeAmount(amountStr) {
    // Hapus format currency dan spasi
    let amount = amountStr.replace(/[Rp\s\.]/g, '');
    
    // Convert shorthand ke nilai penuh
    const multipliers = {
      'rb': 1000,
      'ribu': 1000,
      'k': 1000,
      'jt': 1000000,
      'juta': 1000000,
      'm': 1000000,
      'mio': 1000000,
      'million': 1000000
    };

    // Cek multiplier
    for (const [suffix, multiplier] of Object.entries(multipliers)) {
      if (amount.toLowerCase().endsWith(suffix)) {
        amount = parseFloat(amount.toLowerCase().replace(suffix, '')) * multiplier;
        break;
      }
    }

    return parseFloat(amount);
  }

  // Format transaction summary for history and export
  formatTransactionSummary(transactions, period = 'hari ini', includeDetails = true) {
    // Calculate totals
    const summary = transactions.reduce((acc, t) => {
      if (t.type === 'income') {
        acc.income += t.amount;
      } else {
        acc.expense += t.amount;
      }
      return acc;
    }, { income: 0, expense: 0 });

    // Group by category
    const categories = transactions.reduce((acc, t) => {
      if (!acc[t.type]) acc[t.type] = {};
      if (!acc[t.type][t.category]) {
        acc[t.type][t.category] = { total: 0, count: 0 };
      }
      acc[t.type][t.category].total += t.amount;
      acc[t.type][t.category].count++;
      return acc;
    }, {});

    // Format the summary
    let result = `📊 *Ringkasan Transaksi ${period}*\n\n`;
    
    // Add totals
    result += `💰 Total Pemasukan: ${new Intl.NumberFormat('id-ID', CURRENCY_FORMAT).format(summary.income)}\n`;
    result += `💸 Total Pengeluaran: ${new Intl.NumberFormat('id-ID', CURRENCY_FORMAT).format(summary.expense)}\n`;
    result += `💵 Saldo: ${new Intl.NumberFormat('id-ID', CURRENCY_FORMAT).format(summary.income - summary.expense)}\n\n`;

    // Add category breakdown
    if (Object.keys(categories).length > 0) {
      result += `📋 *Rincian per Kategori:*\n`;
      ['income', 'expense'].forEach(type => {
        if (categories[type]) {
          result += `\n${type === 'income' ? '📈 PEMASUKAN' : '📉 PENGELUARAN'}:\n`;
          Object.entries(categories[type])
            .sort((a, b) => b[1].total - a[1].total)
            .forEach(([category, data]) => {
              result += `• ${category}: ${new Intl.NumberFormat('id-ID', CURRENCY_FORMAT).format(data.total)} (${data.count}x)\n`;
            });
        }
      });
    }

    // Add transaction details if requested
    if (includeDetails && transactions.length > 0) {
      result += `\n📝 *Detail Transaksi:*\n`;
      
      // Group by date
      const byDate = transactions.reduce((acc, t) => {
        const date = new Date(t.timestamp).toLocaleDateString('id-ID', DATE_FORMAT.full);
        if (!acc[date]) acc[date] = [];
        acc[date].push(t);
        return acc;
      }, {});

      // Sort dates in descending order
      Object.entries(byDate)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .forEach(([date, dayTransactions]) => {
          result += `\n📅 ${date}\n`;
          
          // Sort transactions by time
          dayTransactions
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .forEach((t, i) => {
              const time = new Date(t.timestamp).toLocaleTimeString('id-ID', DATE_FORMAT.time);
              const amount = new Intl.NumberFormat('id-ID', CURRENCY_FORMAT).format(t.amount);
              const icon = t.type === 'income' ? '💰' : '💸';
              
              result += `${i + 1}. ${icon} ${amount}\n`;
              result += `   📝 ${t.category}\n`;
              if (t.description && t.description !== t.category) {
                result += `   ℹ️ ${t.description}\n`;
              }
              result += `   ⏰ ${time}\n`;
              if (t.source) {
                result += `   📱 Via: ${t.source}\n`;
              }
              result += '\n';
            });
        });
    }

    return result;
  }

  generateResponse(result) {
    const responses = {
      'transaction.expense': [
        'Ok, sudah saya catat pengeluaran {amount} untuk {category}',
        'Pengeluaran {amount} untuk {category} sudah dicatat',
        'Sip, pengeluaran {amount} ({category}) sudah masuk catatan',
        'Baik, saya sudah mencatat pengeluaran {amount} untuk {category}',
        'Pengeluaran sebesar {amount} untuk {category} berhasil dicatat',
        'Transaksi pengeluaran {amount} untuk {category} sudah saya simpan',
        'Sudah saya catat ya pengeluaran {amount} untuk keperluan {category}',
        'Pengeluaran untuk {category} sebesar {amount} berhasil ditambahkan'
      ],
      'transaction.income': [
        'Ok, sudah saya catat pemasukan {amount} dari {category}',
        'Pemasukan {amount} dari {category} sudah dicatat',
        'Sip, pemasukan {amount} ({category}) sudah masuk catatan',
        'Baik, saya sudah mencatat pemasukan {amount} dari {category}',
        'Pemasukan sebesar {amount} dari {category} berhasil dicatat',
        'Transaksi pemasukan {amount} dari {category} sudah saya simpan',
        'Sudah saya catat ya pemasukan {amount} dari {category}',
        'Pemasukan dari {category} sebesar {amount} berhasil ditambahkan'
      ],
      'transaction.history': [
        'Berikut riwayat transaksi yang Anda minta:',
        'Ini catatan transaksi yang Anda cari:',
        'Saya temukan riwayat transaksi berikut:',
        'Berikut detail transaksi yang Anda minta:',
        'Ini riwayat transaksi yang berhasil saya temukan:',
        'Berikut daftar transaksi yang saya temukan:',
        'Saya berhasil menemukan transaksi berikut:',
        'Ini dia riwayat transaksi yang Anda cari:'
      ],
      'transaction.history.empty': [
        'Maaf, tidak ada transaksi untuk periode {period}.',
        'Belum ada transaksi yang tercatat untuk periode {period}.',
        'Saya tidak menemukan transaksi apapun di periode {period}.',
        'Periode {period} belum memiliki catatan transaksi.',
        'Tidak ada data transaksi yang bisa saya tampilkan untuk periode {period}.',
        'Sepertinya belum ada transaksi yang dicatat di periode {period}.',
        'Catatan transaksi untuk periode {period} masih kosong.',
        'Belum ada aktivitas keuangan yang tercatat di periode {period}.'
      ],
      'transaction.export': [
        'Baik, saya akan siapkan laporan transaksi untuk periode {period}...',
        'Ok, sedang menyiapkan laporan transaksi {period}...',
        'Mohon tunggu sebentar, sedang mengumpulkan data transaksi {period}...',
        'Siap, akan saya buatkan laporan transaksi {period}...',
        'Ok, sedang memproses laporan transaksi {period} untuk Anda...',
        'Sedang menyiapkan data transaksi {period}, mohon tunggu sebentar...',
        'Akan saya buatkan laporan lengkap untuk periode {period}...',
        'Sedang mengumpulkan semua transaksi di periode {period}...'
      ],
      'transaction.export.success': [
        'Laporan transaksi berhasil dibuat. Silakan cek dan simpan informasi di atas.',
        'Berikut laporan transaksi yang Anda minta. Jangan lupa disimpan ya.',
        'Laporan sudah siap. Silakan disimpan untuk referensi Anda.',
        'Data transaksi berhasil diekspor. Silakan dicek dan disimpan.',
        'Laporan sudah selesai dibuat. Semoga membantu.',
        'Export data transaksi berhasil. Silakan diunduh dan disimpan.',
        'Laporan transaksi periode {period} sudah siap diunduh.',
        'Data transaksi sudah saya siapkan dalam format yang mudah dibaca.'
      ],
      'transaction.export.empty': [
        'Maaf, tidak ada data yang bisa diekspor untuk periode {period}.',
        'Belum ada transaksi yang bisa diekspor untuk periode {period}.',
        'Tidak bisa membuat laporan karena belum ada transaksi di periode {period}.',
        'Periode {period} masih kosong, belum ada transaksi yang bisa diekspor.',
        'Tidak ada data yang bisa dimasukkan ke dalam laporan untuk periode {period}.',
        'Mohon maaf, saya tidak menemukan transaksi apapun di periode {period}.',
        'Belum ada aktivitas keuangan yang bisa diekspor untuk periode {period}.',
        'Data transaksi periode {period} masih kosong, belum bisa dibuat laporan.'
      ],
      'report.view': [
        'Berikut laporan keuangan Anda:',
        'Ini ringkasan keuangan Anda:',
        'Ini laporan keuangan terkini:',
        'Berikut rangkuman keuangan Anda:',
        'Ini ringkasan kondisi keuangan Anda:',
        'Berikut analisis keuangan Anda:',
        'Ini dia laporan kondisi keuangan Anda:',
        'Saya sudah siapkan laporan keuangan berikut:'
      ],
      'budget.view': [
        'Berikut status budget Anda:',
        'Ini rincian budget Anda:',
        'Status penggunaan budget Anda:',
        'Berikut detail budget yang sudah diatur:',
        'Ini informasi budget terkini Anda:',
        'Berikut penggunaan budget per kategori:',
        'Ini dia status penggunaan budget Anda:',
        'Saya sudah siapkan ringkasan budget berikut:'
      ],
      'help': [
        'Berikut panduan penggunaan bot:\n\n' +
        '1. Catat Transaksi:\n' +
        '   • Pengeluaran: "catat pengeluaran 50rb untuk makan"\n' +
        '   • Pemasukan: "catat pemasukan 1jt dari gaji"\n\n' +
        '2. Lihat & Export Riwayat:\n' +
        '   • "lihat riwayat" (hari ini)\n' +
        '   • "riwayat kemarin"\n' +
        '   • "riwayat minggu ini"\n' +
        '   • "riwayat bulan ini"\n' +
        '   • "export riwayat"\n' +
        '   • "unduh transaksi bulan ini"\n\n' +
        '3. Laporan & Budget:\n' +
        '   • "lihat laporan"\n' +
        '   • "atur budget makan 2jt"\n' +
        '   • "cek budget"\n\n' +
        'Tips: Bot memahami berbagai format nominal (50rb, 1jt, dll) dan tanggal dalam Bahasa Indonesia.'
      ]
    };

    // Pilih response template secara random
    const templates = responses[result.intent] || ['Maaf, saya tidak mengerti maksud Anda'];
    let response = templates[Math.floor(Math.random() * templates.length)];

    // Replace placeholders dengan nilai sebenarnya
    if (result.entities.amount) {
      response = response.replace(/{amount}/g, new Intl.NumberFormat('id-ID', CURRENCY_FORMAT)
        .format(result.entities.amount));
    }
    if (result.entities.category) {
      response = response.replace(/{category}/g, result.entities.category);
    }
    if (result.entities.date) {
      const formattedDate = this.normalizeDate(result.entities.date);
      response = response.replace(/{period}/g, formattedDate);
    }

    return response;
  }
}

module.exports = NLPProcessor;
