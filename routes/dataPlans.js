const express = require("express");
const rateLimit = require("express-rate-limit");
const {
    storeDataNetworks,
    fetchDataPlans,
    getMobileNetworkPlans,
} = require("../controllers/bills");
const {
    getVacServicesSafehaven,
    purchaseAirtimeServicesSafehaven,
} = require("../controllers/services");

const purchaseLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many purchase attempts, please try again in a minute.",
});

const router = express.Router();

router.post("/data/plans/store", storeDataNetworks);

router.get("/data/plans/get/:provider", fetchDataPlans);

router.get("/data/api/get", getMobileNetworkPlans);

router.get("/services/safehaven", getVacServicesSafehaven);
router.post(
    "/bills/airtime/subscription/safehaven",
    purchaseLimiter,
    purchaseAirtimeServicesSafehaven
);

module.exports = router;
