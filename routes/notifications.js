const express = require('express');
const { getNotifications, updateUnreadNotificationsToRead, getUnreadNotificationsCount, getNotificationDetails } = require('../controllers/notification');

const router = express.Router();


router.get('/notifications/get/:userId', getNotifications); 

router.get('/notifications/get/read-status/:userId', getUnreadNotificationsCount); 

router.get('/notifications/get/details/:notificationId', getNotificationDetails); 

router.patch('/notifications/update/read-status', updateUnreadNotificationsToRead); 


module.exports = router;
