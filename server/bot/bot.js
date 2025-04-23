const venom = require('venom-bot');
const { Client } = require('whatsapp-web.js');
const NLPProcessor = require('./nlp/processor');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { APIError } = require('../utils/errorHandler');

class WhatsAppBot {
  constructor() {
    this.nlp = new NLPProcessor();
    this.sessions = new Map();
    this.initializeBot();
  }

  async initializeBot() {
    try {
      // Inisialisasi Venom Bot
      this.venomBot = await venom.create({
        session: 'financial-assistant',
        multidevice: true,
        headless: true,
        useChrome: true,
        debug: false,
        logQR: false
      });

      // Inisialisasi WhatsApp Web.js
      this.wwjsClient = new Client({
        puppeteer: {
          headless: true,
          args: ['--no-sandbox']
        }
      });

      this.setupEventListeners();
      console.log('WhatsApp Bot initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WhatsApp Bot:', error);
      throw new APIError('Gagal menginisialisasi WhatsApp Bot', 500);
    }
  }

  setupEventListeners() {
    // Venom Bot event listeners
    this.venomBot.onMessage(async (message) => {
      if (!message.isGroupMsg) {
        await this.handleMessage(message);
      }
    });

    // WhatsApp Web.js event listeners
    this.wwjsClient.on('qr', (qr) => {
      // Simpan QR code untuk ditampilkan di panel admin
      this.currentQR = qr;
    });

    this.wwjsClient.on('ready', () => {
      console.log('WhatsApp Web.js Client is ready');
    });

    this.wwjsClient.on('message', async (message) => {
      if (!message.isGroupMsg) {
        await this.handleMessage(message);
      }
    });
  }

  async handleMessage(message) {
    try {
      const phoneNumber = message.from.replace('@c.us', '');
      
      // Cek apakah nomor terdaftar dan aktif
      const user = await User.findOne({
        'phoneNumbers.number': phoneNumber,
        'phoneNumbers.isActive': true
      });

      if (!user) {
        return this.sendMessage(message.from, 
          'Maaf, nomor Anda belum terdaftar atau tidak aktif. ' +
          'Silakan hubungi admin untuk aktivasi.'
        );
      }

      if (user.isActivationExpired()) {
        return this.sendMessage(message.from,
          'Maaf, masa aktif layanan Anda telah berakhir. ' +
          'Silakan hubungi admin untuk perpanjangan.'
        );
      }

      // Proses pesan dengan NLP
      const result = await this.nlp.processMessage(message.body);

      // Handle berdasarkan intent
      await this.handleIntent(result, message, user);

    } catch (error) {
      console.error('Error handling message:', error);
      await this.sendMessage(message.from,
        'Maaf, terjadi kesalahan dalam memproses pesan Anda. ' +
        'Silakan coba beberapa saat lagi.'
      );
    }
  }

  async handleIntent(result, message, user) {
    const { intent, entities, confidence } = result;

    // Jika confidence terlalu rendah
    if (confidence < 0.7) {
      return this.sendMessage(message.from,
        'Maaf, saya kurang memahami maksud Anda. ' +
        'Silakan gunakan format yang lebih jelas atau ketik "bantuan" untuk melihat panduan.'
      );
    }

    switch (intent) {
      case 'transaction.expense':
      case 'transaction.income':
        await this.handleTransaction(intent, entities, message, user);
        break;

      case 'report.view':
      case 'report.expense':
      case 'report.income':
        await this.handleReport(intent, entities, message, user);
        break;

      case 'budget.set':
      case 'budget.view':
        await this.handleBudget(intent, entities, message, user);
        break;

      case 'help':
        await this.sendHelpMessage(message.from);
        break;

      default:
        await this.sendMessage(message.from,
          'Maaf, saya tidak mengenali perintah tersebut. ' +
          'Ketik "bantuan" untuk melihat daftar perintah yang tersedia.'
        );
    }
  }

  async handleTransaction(intent, entities, message, user) {
    try {
      const { amount, category } = entities;

      if (!amount || !category) {
        return this.sendMessage(message.from,
          'Mohon sertakan jumlah dan kategori transaksi. ' +
          'Contoh: "catat pengeluaran 50rb untuk makan"'
        );
      }

      const transaction = new Transaction({
        userId: user._id,
        amount: amount,
        type: intent === 'transaction.expense' ? 'expense' : 'income',
        category: category,
        description: entities.description || category,
        source: message.from
      });

      await transaction.save();

      // Jika transaksi adalah pengeluaran, update budget
      if (intent === 'transaction.expense') {
        const currentBudget = await Budget.getCurrentBudget(user._id);
        if (currentBudget) {
          const categoryBudget = currentBudget.categories.find(
            cat => cat.name === category
          );
          if (categoryBudget) {
            categoryBudget.spent += amount;
            await currentBudget.save();

            // Cek jika melebihi budget
            if (categoryBudget.spent >= categoryBudget.amount) {
              await this.sendMessage(message.from,
                `⚠️ Perhatian: Pengeluaran untuk kategori ${category} ` +
                `telah mencapai/melebihi budget yang ditetapkan.`
              );
            }
          }
        }
      }

      // Kirim konfirmasi
      const response = this.nlp.generateResponse({
        intent,
        entities: {
          amount: transaction.formatAmount(),
          category
        }
      });

      await this.sendMessage(message.from, response);

    } catch (error) {
      console.error('Error handling transaction:', error);
      await this.sendMessage(message.from,
        'Maaf, terjadi kesalahan dalam mencatat transaksi. ' +
        'Silakan coba lagi.'
      );
    }
  }

  async handleReport(intent, entities, message, user) {
    try {
      const now = new Date();
      const period = entities.date || 'bulan ini';
      
      let startDate, endDate;
      
      switch (period) {
        case 'hari ini':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          endDate = new Date(now.setHours(23, 59, 59, 999));
          break;
        case 'minggu ini':
          startDate = new Date(now.setDate(now.getDate() - now.getDay()));
          endDate = new Date(now.setDate(now.getDate() + 6));
          break;
        case 'bulan ini':
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      const transactions = await Transaction.find({
        userId: user._id,
        timestamp: { $gte: startDate, $lte: endDate }
      });

      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const expense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const balance = income - expense;

      // Format amounts
      const formatAmount = (amount) => {
        return new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR'
        }).format(amount);
      };

      // Generate category summary
      const categorySummary = await Transaction.getCategorySummary(
        user._id,
        startDate,
        endDate
      );

      let report = `📊 *Laporan Keuangan ${period}*\n\n`;
      report += `💰 Total Pemasukan: ${formatAmount(income)}\n`;
      report += `💸 Total Pengeluaran: ${formatAmount(expense)}\n`;
      report += `💵 Saldo: ${formatAmount(balance)}\n\n`;
      
      if (categorySummary.length > 0) {
        report += '*Rincian per Kategori:*\n';
        categorySummary.forEach(summary => {
          report += `\n${summary._id === 'income' ? '📈 Pemasukan' : '📉 Pengeluaran'}:\n`;
          summary.categories.forEach(cat => {
            report += `${cat.category}: ${formatAmount(cat.total)}\n`;
          });
        });
      }

      await this.sendMessage(message.from, report);

    } catch (error) {
      console.error('Error generating report:', error);
      await this.sendMessage(message.from,
        'Maaf, terjadi kesalahan dalam membuat laporan. ' +
        'Silakan coba lagi.'
      );
    }
  }

  async handleBudget(intent, entities, message, user) {
    try {
      if (intent === 'budget.set') {
        const { amount, category } = entities;
        
        if (!amount || !category) {
          return this.sendMessage(message.from,
            'Mohon sertakan jumlah dan kategori budget. ' +
            'Contoh: "atur budget makan 2jt"'
          );
        }

        let budget = await Budget.getCurrentBudget(user._id);
        
        if (!budget) {
          budget = new Budget({
            userId: user._id,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            categories: [],
            totalBudget: 0
          });
        }

        const categoryIndex = budget.categories.findIndex(
          cat => cat.name === category
        );

        if (categoryIndex >= 0) {
          budget.categories[categoryIndex].amount = amount;
        } else {
          budget.categories.push({
            name: category,
            amount: amount,
            spent: 0
          });
        }

        budget.totalBudget = budget.categories.reduce(
          (sum, cat) => sum + cat.amount,
          0
        );

        await budget.save();

        await this.sendMessage(message.from,
          `✅ Budget untuk ${category} telah diatur: ${new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR'
          }).format(amount)}`
        );

      } else if (intent === 'budget.view') {
        const budget = await Budget.getCurrentBudget(user._id);
        
        if (!budget) {
          return this.sendMessage(message.from,
            'Anda belum mengatur budget untuk bulan ini.'
          );
        }

        const summary = budget.getSummary();
        let message = `📋 *Status Budget Bulan Ini*\n\n`;
        message += `💰 Total Budget: ${summary.totalBudget}\n`;
        message += `💸 Total Terpakai: ${summary.totalSpent}\n`;
        message += `💵 Sisa: ${summary.remaining}\n`;
        message += `📊 Penggunaan: ${summary.usagePercentage.toFixed(1)}%\n\n`;
        
        message += '*Rincian per Kategori:*\n';
        summary.categories.forEach(cat => {
          const status = cat.isOverBudget ? '⚠️' : '✅';
          message += `\n${status} ${cat.name}:\n`;
          message += `Budget: ${cat.budget}\n`;
          message += `Terpakai: ${cat.spent} (${cat.percentage.toFixed(1)}%)\n`;
        });

        await this.sendMessage(message.from, message);
      }

    } catch (error) {
      console.error('Error handling budget:', error);
      await this.sendMessage(message.from,
        'Maaf, terjadi kesalahan dalam mengelola budget. ' +
        'Silakan coba lagi.'
      );
    }
  }

  async sendHelpMessage(to) {
    const help = 
      '🤖 *Financial Assistant Bot - Panduan Penggunaan*\n\n' +
      '*1. Mencatat Transaksi*\n' +
      '• Pengeluaran: "catat pengeluaran 50rb untuk makan"\n' +
      '• Pemasukan: "catat pemasukan 1jt dari gaji"\n\n' +
      '*2. Melihat Laporan*\n' +
      '• "lihat laporan"\n' +
      '• "laporan bulan ini"\n' +
      '• "laporan minggu ini"\n\n' +
      '*3. Mengatur Budget*\n' +
      '• Set budget: "atur budget makan 2jt"\n' +
      '• Lihat budget: "lihat budget"\n\n' +
      '*Tips:*\n' +
      '• Bot memahami berbagai format nominal:\n' +
      '  50rb, 50k, 50.000, 1jt, 1.5jt\n' +
      '• Gunakan bahasa natural/sehari-hari\n' +
      '• Ketik "bantuan" untuk melihat panduan ini\n\n' +
      '❓ Butuh bantuan lebih lanjut?\n' +
      'Silakan hubungi admin.';

    await this.sendMessage(to, help);
  }

  async sendMessage(to, message) {
    try {
      // Coba kirim menggunakan Venom
      await this.venomBot.sendText(to, message);
    } catch (error) {
      try {
        // Fallback ke WhatsApp Web.js
        await this.wwjsClient.sendMessage(to, message);
      } catch (error) {
        console.error('Failed to send message:', error);
        throw new APIError('Gagal mengirim pesan', 500);
      }
    }
  }

  getQRCode() {
    return this.currentQR;
  }

  async restart() {
    try {
      // Close existing sessions
      if (this.venomBot) {
        await this.venomBot.close();
      }
      if (this.wwjsClient) {
        await this.wwjsClient.destroy();
      }

      // Reinitialize
      await this.initializeBot();
      
      return true;
    } catch (error) {
      console.error('Failed to restart bot:', error);
      throw new APIError('Gagal me-restart bot', 500);
    }
  }
}

// Export singleton instance
module.exports = new WhatsAppBot();
