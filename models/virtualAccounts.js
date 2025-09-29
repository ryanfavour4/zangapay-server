const mongoose = require('mongoose');

const VirtualAccountsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: null,
  },
  fincraAccount: {
    fullName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    bankName: { type: String, default: null },
    accountName: { type: String, default: null },
    expiresAt: { type: String, default: null },
  },
  safeHavenAccount: {
    fullName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    bankName: { type: String, default: null },
    accountName: { type: String, default: null },
    expiresAt: { type: String, default: null },
  },
}, { timestamps: true });

const VirtualAccounts = mongoose.model('VirtualAccounts', VirtualAccountsSchema);

module.exports = VirtualAccounts;
