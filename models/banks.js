const mongoose = require('mongoose');

const BanksSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: null,
    required: true
  },
  bankCode:{
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
  fullname:{
    type: String,
    default: null
  }
}, { timestamps: true });

const Banks = mongoose.model('Banks', BanksSchema);

module.exports = Banks;
