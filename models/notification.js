const mongoose = require('mongoose');

const NotificationsSchema = new mongoose.Schema({
   title: {
      type: String,
      default: null
   },
   message:{
      type: String,
      default: null
   },
   type:{
      type: String,
      default:'users'
   },
   read:{
      type:Boolean,
      default: false
   }
},{timestamps: true});

const Notifications = mongoose.model('Notifications', NotificationsSchema);


module.exports = Notifications;
