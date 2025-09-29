const mongoose = require('mongoose');

const VirtualCardsSchema = new mongoose.Schema({
  cardId:{
   type: String,
    default: null,
    required: true 
  },
  userId:{
    type: String,
    default: null,
    required: true
  },
  status:{
    type: String,
    default: 'active',
    required: true
  }
}, { timestamps: true });

const VirtualCards = mongoose.model('VirtualCards', VirtualCardsSchema);

module.exports = VirtualCards;
