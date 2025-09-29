const mongoose = require('mongoose');

const giftCardCountrySchema = new mongoose.Schema({
  countryCode: {
    type: String,
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
    { countryCode: 1 },
    { isActive: 1 }
  ]
});

const GiftCardCountry = mongoose.model('GiftCardCountry', giftCardCountrySchema);

module.exports = GiftCardCountry; 