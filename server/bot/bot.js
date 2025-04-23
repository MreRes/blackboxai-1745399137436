const venom = require('venom-bot');
const { Client } = require('whatsapp-web.js');
const NLPProcessor = require('./nlp/processor');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { APIError } = require('../utils/errorHandler');
const path = require('path');

class WhatsAppBot {
  constructor() {
    this.nlp = new NLPProcessor();
    this.sessions = new Map();
    this.initializeBot().catch(err => {
      console.error('Failed to initialize bot:', err);
      // Don't throw error here, let the bot retry initialization
    });
  }

  async initializeBot() {
    try {
      // Clear existing session data
      const sessionPath = path.join(process.cwd(), 'tokens', 'financial-assistant');
      
      // Venom Bot configuration
      const venomOptions = {
        session: 'financial-assistant',
        multidevice: true,
        headless: 'new', // Use new headless mode
        useChrome: true,
        debug: true, // Enable debug for troubleshooting
        logQR: true, // Show QR in console
        disableWelcome: true,
        browserArgs: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // Important for Docker/Linux
          '--disable-gpu'
        ],
        createPathFileToken: true,
        waitForLogin: true
      };

      console.log('Initializing Venom Bot...');
      this.venomBot = await venom.create(
        venomOptions,
        (base64Qr, asciiQR, attempts) => {
          console.log('QR Code received:', asciiQR);
          this.currentQR = base64Qr;
        },
        (statusSession, session) => {
          console.log('Status Session:', statusSession);
          console.log('Session:', session);
        },
        {
          folderNameToken: 'tokens',
          headless: 'new',
          devtools: false,
          useChrome: true,
          debug: false,
          logQR: true,
          browserArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
          ],
          refreshQR: 15000,
          autoClose: 60000,
          createPathFileToken: true,
        }
      );

      console.log('Venom Bot initialized successfully');
      this.setupEventListeners();

    } catch (error) {
      console.error('Error in bot initialization:', error);
      
      // If initialization fails, wait and retry
      console.log('Retrying bot initialization in 30 seconds...');
      setTimeout(() => {
        this.initializeBot().catch(console.error);
      }, 30000);
    }
  }

  setupEventListeners() {
    if (!this.venomBot) {
      console.error('Cannot setup event listeners: Bot not initialized');
      return;
    }

    // Venom Bot event listeners
    this.venomBot.onStateChange((state) => {
      console.log('State changed:', state);
      if (state === 'DISCONNECTED') {
        console.log('Bot disconnected, attempting to reconnect...');
        this.initializeBot().catch(console.error);
      }
    });

    this.venomBot.onMessage(async (message) => {
      if (!message.isGroupMsg) {
        try {
          await this.handleMessage(message);
        } catch (error) {
          console.error('Error handling message:', error);
        }
      }
    });
  }

  async handleMessage(message) {
    try {
      const phoneNumber = message.from.replace('@c.us', '');
      
      // Check if number is registered and active
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

      // Process message with NLP
      const result = await this.nlp.processMessage(message.body);

      // Handle based on intent
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

    // If confidence is too low
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

      case 'transaction.history':
        await this.handleTransactionHistory(entities, message, user);
        break;

      case 'transaction.export':
        await this.handleTransactionExport(entities, message, user);
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

  async sendMessage(to, message) {
    try {
      if (!this.venomBot) {
        throw new Error('Bot not initialized');
      }
      await this.venomBot.sendText(to, message);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Don't throw error here, just log it
    }
  }

  getQRCode() {
    return this.currentQR;
  }

  async restart() {
    try {
      console.log('Restarting bot...');
      if (this.venomBot) {
        await this.venomBot.close();
      }
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
