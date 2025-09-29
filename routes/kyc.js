const express = require('express');
const { storeUserDocumentsAndInfo, updateUserDocumentsAndInfo, getUserKycStatus} = require('../controllers/kyc');

const router = express.Router();

router.post('/kyc/send', storeUserDocumentsAndInfo);

router.post('/kyc/update', updateUserDocumentsAndInfo)

router.get('/kyc/get/:userId', getUserKycStatus)

// router.patch('/kyc/accept', acceptKycInformation)

// router.patch('/kyc/reject', rejectKycInformation)

module.exports = router;
