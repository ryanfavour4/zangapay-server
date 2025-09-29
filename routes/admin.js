const express = require('express');
const { signupUserWithEmail, signinWithEmailAndPassword, logoutUserSession, getAllUsers, getTotalRevenue, getRecentActivities, logActivity, fundUserAccount, getAllTransactions, getTransactionById, sendNotifications, getAllNotifications, fundReferralUsersAccount, resetUserPassword, verifyEmailOtpSentToUser, sendEmailOtpForForgottenPassword, getAllAdminOfficials, updateAdminRole, addAdminOfficials, deleteAdminOfficials, getTransactionStats, getTotalTransactionsAmount, getUsersWalletAndTransactions, getActiveUsers, getDashboardStats, updateDataPlan, getDataPlans, getNineMobileDataPlans, getServiceFees, getWithdrawalFees, updateServiceFees, updateWithdrawalFees, storeServiceFees, storeWithdrawalFees, getReferralStats, listReferrals, creditUserByReferralCode, markUserNotificationsAsRead, updateUserDataPlanPrice, blockUser, unblockUser, deleteUser, hardDeleteUser, getReferredUsers } = require('../controllers/admin');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/admin/signup', signupUserWithEmail);

router.post('/admin/add/official', authMiddleware('email', ['admin']), addAdminOfficials);

router.post('/admin/signin', signinWithEmailAndPassword);

router.delete('/admin/delete/official/:id', authMiddleware('email', ['admin']), deleteAdminOfficials);

router.get('/admin/officials', authMiddleware('email', ['admin']), getAllAdminOfficials);

router.post('/admin/logout', logoutUserSession);  

router.patch('/admin/reset/password', authMiddleware('email', ['admin']), resetUserPassword);

router.patch('/admin/update/role', authMiddleware('email', ['admin']), updateAdminRole);

router.get('/admin/users', getAllUsers);

router.get('/admin/revenue', getTotalRevenue);

router.get('/admin/activities', getRecentActivities);

router.post('/admin/fund/user', authMiddleware('email', ['admin']), fundUserAccount);

router.get('/admin/transactions', authMiddleware('email', ['admin', 'support']), getAllTransactions);

router.get('/admin/transaction/:id', authMiddleware('email', ['admin', 'support']), getTransactionById);

router.post('/admin/notify', authMiddleware('email', ['admin']), sendNotifications);

router.get('/admin/notifications/:type', authMiddleware('email', ['admin', 'support']), getAllNotifications);

router.patch('/admin/notifications/mark-read', authMiddleware('email', ['admin', 'support']), markUserNotificationsAsRead);

router.post('/admin/fund/referral', authMiddleware('email', ['admin']), fundReferralUsersAccount);

router.post('/admin/verify/email', verifyEmailOtpSentToUser);

router.patch('/admin/block/user/:userId/:action', authMiddleware('email', ['admin']), blockUser);

router.patch('/admin/unblock/user/:userId', authMiddleware('email', ['admin']), unblockUser);

router.delete('/admin/soft/delete/user/:userId', authMiddleware('email', ['admin']), deleteUser);

router.delete('/admin/hard/delete/user/:userId', authMiddleware('email', ['admin']), hardDeleteUser);

router.post('/admin/forgot/password', sendEmailOtpForForgottenPassword);

router.get('/admin/transaction-stats', authMiddleware('email', ['admin', 'support']), getTransactionStats);

router.get('/admin/total-amount', authMiddleware('email', ['admin', 'support']), getTotalTransactionsAmount);

router.get('/admin/users-wallet-transactions', authMiddleware('email', ['admin', 'support']), getUsersWalletAndTransactions);

router.get('/admin/active-users', authMiddleware('email', ['admin', 'support']), getActiveUsers);

router.get('/admin/dashboard', authMiddleware('email', ['admin', 'support']), getDashboardStats);

router.patch('/admin/data/update', updateUserDataPlanPrice)

router.get('/admin/data/get', getDataPlans)

router.get('/admin/9mobiledata/get', authMiddleware('email', ['admin']), getNineMobileDataPlans)

// New routes for service fees
router.get('/admin/service-fees', authMiddleware('email', ['admin']), getServiceFees);
router.post('/admin/service-fees/store', storeServiceFees);
router.put('/admin/service-fees/update', authMiddleware('email', ['admin']), updateServiceFees);

// New routes for withdrawal fees
router.get('/admin/withdrawal-fees', authMiddleware('email', ['admin']), getWithdrawalFees);
router.post('/admin/withdrawal-fees/store', storeWithdrawalFees);
router.put('/admin/withdrawal-fees/update', authMiddleware('email', ['admin']), updateWithdrawalFees);

// Referral routes
router.get('/referrals/stats', getReferralStats);
router.get('/referrals', listReferrals);
router.post('/referrals/credit', authMiddleware('email', ['admin']), creditUserByReferralCode);
router.get('/referrals/referred-user/:code', getReferredUsers);


module.exports = router;
