const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return this.isAdmin === true;
    }
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  activationCode: {
    type: String,
    required: function() {
      return this.isAdmin === false;
    }
  },
  phoneNumbers: [{
    number: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    activatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  maxPhoneNumbers: {
    type: Number,
    default: 1
  },
  activationExpiry: {
    type: Date,
    required: function() {
      return this.isAdmin === false;
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if phone number is registered and active
userSchema.methods.isPhoneNumberValid = function(phoneNumber) {
  const phone = this.phoneNumbers.find(p => p.number === phoneNumber);
  if (!phone) return false;
  return phone.isActive;
};

// Method to check if user can add more phone numbers
userSchema.methods.canAddPhoneNumber = function() {
  return this.phoneNumbers.length < this.maxPhoneNumbers;
};

// Method to check if activation is expired
userSchema.methods.isActivationExpired = function() {
  return Date.now() > this.activationExpiry;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
