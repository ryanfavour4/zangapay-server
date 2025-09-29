const mongoose = require('mongoose');

const giftCardSchema = new mongoose.Schema({
  productId: {
    type: Number,
    required: true,
    unique: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastSynced: {
    type: Date,
    default: Date.now
  }
}, { 
  timestamps: true,
  indexes: [
    { productId: 1 },
    { isActive: 1 },
    { 'data.brandId': 1 },
    { 'data.countryCode': 1 },
    { 'data.productName': 'text', 'data.brandName': 'text' }
  ]
});

const GiftCard = mongoose.model('GiftCard', giftCardSchema);

module.exports = GiftCard; 