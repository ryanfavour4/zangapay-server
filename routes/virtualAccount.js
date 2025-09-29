const express = require("express");
const {
    generateFincraVirtualAccount,
    getUserVirtualAccounts,
    generatePaystackVirtualAccount,
    generateSafeHavenVirtualAccount,
} = require("../controllers/virtualAccount");

const router = express.Router();

router.post("/fincra/generate/account", generateFincraVirtualAccount);

router.post("/safehaven/generate/account", generateSafeHavenVirtualAccount);

router.get("/fincra/get/account/:userId", getUserVirtualAccounts);

router.post("/paystack/generate/account", generatePaystackVirtualAccount);

router.get("/paystack/get/account/:userId", getUserVirtualAccounts);

module.exports = router;
