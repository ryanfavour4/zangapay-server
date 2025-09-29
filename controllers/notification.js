const customError = require("../customError")
const Notifications = require("../models/notification")


async function getNotifications (req,res,next) {
  try{
       const {userId} = req.params

       const checkIfNotificationsExists = await Notifications.find({toUserId: userId}).sort({createdAt: -1})

       if(checkIfNotificationsExists.length === 0) return next(customError('Notification does not exists for current user'))

      res.json({message: checkIfNotificationsExists})
  }
  catch(err) {
    console.log(err)
    next(customError(err))
  }
}

async function getUnreadNotificationsCount(req, res,next){
  try{
   const { userId } = req.params;
 
   
   const checkIfNotificationsExists = await Notifications.find({toUserId: userId})

   if(checkIfNotificationsExists.length === 0) return next(customError('Notification does not exists for current user'))

  const unreadCount = await Notifications.countDocuments({ toUserId: userId, isRead: false });
        
 res.json({message: unreadCount });
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function getNotificationDetails(req, res, next) {
  try{
    const {notificationId} = req.params

    const details = await Notifications.findById(notificationId)

    res.json({message: details})
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function updateUnreadNotificationsToRead (req,res,next){
  try{
    const {userId} = req.body

    const checkIfNotificationsExists = await Notifications.find({userId})

    if(checkIfNotificationsExists.length === 0) return next(customError('Notification does not exists for current user'))

    const updateNotificationReadStatus =  await Notifications.updateMany({ userId, isRead: false }, { isRead: true })

 
    res.json({message: updateNotificationReadStatus})
  
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

async function clearAllUserNotifications (req,res,next){
  try{
    const {userId} = req.body

    const checkIfNotificationsExists = await Notifications.find({userId})

    if(checkIfNotificationsExists.length === 0) return next(customError('Notification does not exists for current user'))

    const updateNotificationReadStatus =  await Notifications.updateMany({ userId, isRead: false }, { isRead: true })

 
    res.json({message: updateNotificationReadStatus})
  
  }
  catch(err){
    console.log(err)
    next(customError(err))
  }
}

module.exports = {
  getNotifications,
  updateUnreadNotificationsToRead,
  getUnreadNotificationsCount,
  getNotificationDetails,
}