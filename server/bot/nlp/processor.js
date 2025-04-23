const { NlpManager } = require('node-nlp');
const moment = require('moment');
require('moment/locale/id');  // Set locale ke bahasa Indonesia
moment.locale('id');

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
      'hari ini': ['hari ini', 'saat ini'],
      'kemarin': ['kemarin', 'yesterday'],
      'minggu ini': ['minggu ini', 'pekan ini'],
      'bulan ini': ['bulan ini', 'month'],
      'tahun ini': ['tahun ini', 'year'],
    };

    for (const [date, synonyms] of Object.entries(dates)) {
      this.manager.addNamedEntityText('date', date, ['id'], synonyms);
    }
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

  async processMessage(message) {
    try {
      // Analisis pesan menggunakan NLP
      const result = await this.manager.process('id', message);

      // Ekstrak informasi dari hasil analisis
      const intent = result.intent;
      const entities = {};

      // Proses entities yang ditemukan
      if (result.entities && result.entities.length > 0) {
        result.entities.forEach(entity => {
          if (entity.entity === 'amount') {
            entities.amount = this.normalizeAmount(entity.sourceText);
          } else {
            entities[entity.entity] = entity.option || entity.sourceText;
          }
        });
      }

      // Tambahkan confidence score
      const confidence = result.score;

      return {
        intent: intent,
        entities: entities,
        confidence: confidence,
        originalMessage: message
      };
    } catch (error) {
      console.error('Error processing message:', error);
      throw new Error('Gagal memproses pesan');
    }
  }

  generateResponse(result) {
    const responses = {
      'transaction.expense': [
        'Ok, sudah saya catat pengeluaran {amount} untuk {category}',
        'Pengeluaran {amount} untuk {category} sudah dicatat',
        'Sip, pengeluaran {amount} ({category}) sudah masuk catatan'
      ],
      'transaction.income': [
        'Ok, sudah saya catat pemasukan {amount} dari {category}',
        'Pemasukan {amount} dari {category} sudah dicatat',
        'Sip, pemasukan {amount} ({category}) sudah masuk catatan'
      ],
      'report.view': [
        'Berikut laporan keuangan Anda:',
        'Ini ringkasan keuangan Anda:',
        'Ini laporan keuangan terkini:'
      ],
      'budget.view': [
        'Berikut status budget Anda:',
        'Ini rincian budget Anda:',
        'Status penggunaan budget Anda:'
      ],
      'help': [
        'Berikut adalah bantuan penggunaan bot:\n' +
        '1. Catat pengeluaran: "catat pengeluaran 50rb untuk makan"\n' +
        '2. Catat pemasukan: "catat pemasukan 1jt dari gaji"\n' +
        '3. Lihat laporan: "lihat laporan"\n' +
        '4. Atur budget: "atur budget makan 2jt"'
      ]
    };

    // Pilih response template secara random
    const templates = responses[result.intent] || ['Maaf, saya tidak mengerti maksud Anda'];
    let response = templates[Math.floor(Math.random() * templates.length)];

    // Replace placeholders dengan nilai sebenarnya
    if (result.entities.amount) {
      response = response.replace('{amount}', new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR'
      }).format(result.entities.amount));
    }
    if (result.entities.category) {
      response = response.replace('{category}', result.entities.category);
    }

    return response;
  }
}

module.exports = NLPProcessor;
