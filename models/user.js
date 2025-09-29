const mongoose = require('mongoose');
const { Schema } = mongoose;

// Define the Location Schema

// Define the User Schema
const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    default: null,
    unique: true,
    required: true,
  },
  isPhoneVerified: {
    type: Boolean,
    default: false,
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
  },
  gender: {
    type: String,
    default: null,
  },
  sessionExpireAt: {
    type: Number,
    default: null,
  },
  userAuthId: {
    type: String,
    default: null,
  },
  otpId: {
    type: String,
    default: null,
  },
  profileImage: {
    type: String,
    default: null,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  isNewUser: {
    type: Boolean,
    default: false,
  },
  locationAddress: {
    type: String, // Embed the LocationSchema into UserSchema
    default: null, // Default value can be null or an empty object
  },
  locationLatitude:{
    type: Number,
    default:0
  },
  isKycVerified:{
    type: Boolean,
    default: false
  },
  kycStatus:{
    type: String,
    default: null
  },
  isBlocked:{
    type: Boolean,
    default: false
  },
  password:{
    type: String, 
    default: null
  },
  isDeleted:{
    type: Boolean,
    default: false
  },
  locationLongitude:{
    type:Number,
    default:0
  },
  isPinEnabled:{
    type: Boolean,
    default: true
  },
  role:{
    type:String,
    default: 'user'
  },
  referralCode:{
    type: String,
    default: null
  },
  sessionId: {
    type: String,
    default: null
  }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

module.exports = User;
