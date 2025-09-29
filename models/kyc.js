const mongoose = require('mongoose');

const KycSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true 
},
documentNumber:{
    type:Number,
    required:true
},
documentPhoto:{
    type:String,
    required:true,
    unique:true
},
isDocumentVerified:{
  type:Boolean,
  default:false
},
isUserVerified:{
    type:Boolean,
    default:false
},
documentType: {
    type: String,
    default: null
},
status: {
    type: String, 
    default: 'not-verified'  
}
});

const Kyc = mongoose.model('Kyc', KycSchema);


module.exports = Kyc;
