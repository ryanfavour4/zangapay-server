const mongoose = require('mongoose');

const FincraVirtualAccountsSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: null,
    required: true
  },
  fullName:{
    type: String,
    default: null
  },
  accountNumber:{
    type: String,
    default:0
  },
  bankName:{
    type: String,
    default: null
  },
  accountName:{
    type: String,
    default: null
  },
  expiresAt:{
    type: String,
    default: null
  }
}, { timestamps: true });

const FincraVirtualAccounts = mongoose.model('FincraVirtualAccounts', FincraVirtualAccountsSchema);

module.exports = FincraVirtualAccounts;
