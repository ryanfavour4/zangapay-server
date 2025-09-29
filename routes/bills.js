const express = require("express");
const {
    airtimePurchase,
    dataPurchase,
    cableSubscription,
    electricityBillSubscription,
    fetchDataPlans,
    fetchCableTvPlans,
    verifyTvSmartCode,
    verifyElectricityMeterNumber,
    getWaecRegistrationVariations,
    waecRegistrationSubscription,
    getWaecResultCheckerVariations,
    waecResultCheckerSubscription,
    getJambSubscriptionVariations,
    jambRegistrationSubscription,
    getAllEsimsDataPackages,
    esimSubscription,
    viewGiftCardRedeemInstructions,
    purchaseGiftCard,
    getThirdPartyColorCodes,
    getThirdPartyEngineCapacityCode,
    getThirdPartyInsuranceVariations,
    getThirdPartyLocalGovernmentAreaCode,
    getThirdPartyStateCode,
    getThirdPartyVehicleMakeCode,
    getThirdPartyVehicleModelCode,
    thirdPartyInsuranceSubscription,
    getPersonalAccidentInsuranceVariations,
    personalAccidentInsuranceSubscription,
    bettingSubscription,
    verifyIfAirtime2CashIsAvailable,
    airtime2CashSubscription,
    getAvailableGiftCardsCountries,
    getAvailableGiftCardsProducts,
    getAvailableGiftCardsProductsByCountry,
    getPurchasedGiftCardTransaction,
    purchaseVirtualCard,
    topupVirtualCard,
    getSpectranetVariations,
    spectranetInternetSubscription,
    getSmileInternetVariations,
    verifySmileEmail,
    smileInternetSubscription,
    getInternationalAirtimeVariations,
    getInternationalAirtimeCountries,
    getInternationalAirtimeOperators,
    getInternationalProductTypes,
    internationalAirtimeSubscription,
    waecNecoAndJambSubscriptions,
    fetchFlightBookingLocations,
    fetchFlightBookingOffers,
    validateFlightBookingOfferPrice,
    flightBookingSubscription,
    buy9mobileAirtime,
    getUserCardDetails,
    freezeVirtualCard,
    unfreezeVirtualCard,
    terminateVirtualCard,
    fetch9MobileDataPlans,
    buy9mobileData,
    getMobileNetworkPlans,
    fetchEducationPlans,
    searchGiftCardsByTerm,
    searchGiftCardsByTermValidators,
    purchaseGiftCardValidators,
    airtimePurchaseValidators,
    dataPurchaseValidators,
    cableSubscriptionValidators,
    electricityBillSubscriptionValidators,
    bettingSubscriptionValidators,
    airtime2CashSubscriptionValidators,
    waecNecoAndJambSubscriptionsValidators,
    thirdPartyInsuranceSubscriptionValidators,
    personalAccidentInsuranceSubscriptionValidators,
    esimSubscriptionValidators,
    purchaseVirtualCardValidators,
} = require("../controllers/bills");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const purchaseLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many purchase attempts, please try again in a minute.",
});

// done

router.post(
    "/bills/airtime/subscription",
    purchaseLimiter,
    airtimePurchaseValidators,
    airtimePurchase
);

//not done

router.post("/bills/airtime/9mobile/airtime", buy9mobileAirtime);

router.post("/bills/airtime/9mobile/data", buy9mobileData);

router.get("/bills/9mobile/get", fetch9MobileDataPlans);

router.get("/bills/data/plans", getMobileNetworkPlans);

//done

router.post(
    "/bills/data/subscription",
    purchaseLimiter,
    dataPurchaseValidators,
    dataPurchase
);

router.post(
    "/bills/cable/subscription",
    purchaseLimiter,
    cableSubscriptionValidators,
    cableSubscription
);

//  done

router.post(
    "/bills/electricity/subscription",
    purchaseLimiter,
    electricityBillSubscriptionValidators,
    electricityBillSubscription
);

// done

router.get("/bills/fetch/netowrk-plans/:provider", fetchDataPlans);

router.get("/bills/fetch/tv-plans/:provider", fetchCableTvPlans);

router.post("/bills/verify/tv-smartcode", verifyTvSmartCode);

// done

router.post(
    "/bills/verify/electricity-meter-number",
    verifyElectricityMeterNumber
);

//  done

router.post(
    "/bills/education/subscription",
    purchaseLimiter,
    waecNecoAndJambSubscriptionsValidators,
    waecNecoAndJambSubscriptions
);
// router.get('/bills/waec/variations', getWaecRegistrationVariations)

// router.post('/bills/waec/subscription', waecRegistrationSubscription)

// router.get('/bills/waec/result-checker/variations', getWaecResultCheckerVariations)

// router.post('/bills/waec/result-checker/subscription', waecResultCheckerSubscription)

// router.post('/bills/jamb/variations', getJambSubscriptionVariations)

// router.post('/bills/jamb/subscription', jambRegistrationSubscription)

//  done

router.get("/bills/esims/get", getAllEsimsDataPackages);

router.post(
    "/bills/esims/subscription",
    purchaseLimiter,
    esimSubscriptionValidators,
    esimSubscription
);

// done

router.get("/bills/giftcard/countries/get", getAvailableGiftCardsCountries);

router.get(
    "/bills/giftcard/products/country/get/:countryCode",
    getAvailableGiftCardsProductsByCountry
);

router.get("/bills/giftcard/products/get", getAvailableGiftCardsProducts);

router.get(
    "/bills/giftcard/transaction/get/:transactionId",
    getPurchasedGiftCardTransaction
);

router.get("/bills/giftcard/redeem/:brandId", viewGiftCardRedeemInstructions);

router.post(
    "/bills/giftcard/subscription",
    purchaseLimiter,
    purchaseGiftCardValidators,
    purchaseGiftCard
);

// done

router.get(
    "/bills/insurance/third-party/color-codes/get",
    getThirdPartyColorCodes
);

router.get(
    "/bills/insurance/third-party/capacity-codes/get",
    getThirdPartyEngineCapacityCode
);

router.get(
    "/bills/insurance/third-party/variations/get",
    getThirdPartyInsuranceVariations
);

router.get(
    "/bills/insurance/third-party/lga-codes/get/:stateCode",
    getThirdPartyLocalGovernmentAreaCode
);

router.get(
    "/bills/insurance/third-party/state-codes/get",
    getThirdPartyStateCode
);

router.get(
    "/bills/insurance/third-party/vehicle-make-codes/get",
    getThirdPartyVehicleMakeCode
);

router.get(
    "/bills/insurance/third-party/model-codes/get/:vehicleMakeCode",
    getThirdPartyVehicleModelCode
);

router.post(
    "/bills/insurance/third-party/subscription",
    purchaseLimiter,
    thirdPartyInsuranceSubscriptionValidators,
    thirdPartyInsuranceSubscription
);

//service not available

router.get(
    "/bills/insurance/personal-accident/variations/get",
    getPersonalAccidentInsuranceVariations
);

router.get(
    "/bills/insurance/personal-accident/subscription",
    purchaseLimiter,
    personalAccidentInsuranceSubscriptionValidators,
    personalAccidentInsuranceSubscription
);

//done

router.post(
    "/bills/betting/subscription",
    purchaseLimiter,
    bettingSubscriptionValidators,
    bettingSubscription
);

router.get(
    "/bills/airtime-to-cash/availability/:network",
    verifyIfAirtime2CashIsAvailable
);

router.post(
    "/bills/airtime2cash/subscription",
    purchaseLimiter,
    airtime2CashSubscriptionValidators,
    airtime2CashSubscription
);

//done below

router.get("/bills/spectranet/variations/get", getSpectranetVariations);

router.post("/bills/spectranet/subscription", spectranetInternetSubscription);

router.get("/bills/smile/variations/get", getSmileInternetVariations);

router.post("/bills/smile/verify", verifySmileEmail);

router.post("/bills/smile/subscription", smileInternetSubscription);

router.get(
    "/bills/international-airtime/variations/get/:operatorId/:productId",
    getInternationalAirtimeVariations
);

router.get(
    "/bills/international-airtime/countries/get",
    getInternationalAirtimeCountries
);

router.get(
    "/bills/international-airtime/operators/get/:countryCode/:productId",
    getInternationalAirtimeOperators
);

router.get(
    "/bills/international-airtime/product-types/get/:countryCode",
    getInternationalProductTypes
);

router.post(
    "/bills/international-airtime/subscription",
    internationalAirtimeSubscription
);

router.get("/bills/education/get", fetchEducationPlans);
//
// done

router.get(
    "/bills/flight/search/location/:keyword",
    fetchFlightBookingLocations
);

router.post("/bills/flight/search/offers", fetchFlightBookingOffers);

router.post("/bills/flight/validate/offer", validateFlightBookingOfferPrice);

router.post("/bills/flight/subscription", flightBookingSubscription);

// done

router.post(
    "/bills/virtual-card/create",
    purchaseLimiter,
    purchaseVirtualCardValidators,
    purchaseVirtualCard
);

router.post("/bills/virtual-card/topup", topupVirtualCard);

router.get("/bills/virtual-card/get/:userId", getUserCardDetails);

router.post("/bills/virtual-card/freeze", freezeVirtualCard);

router.post("/bills/virtual-card/unfreeze", unfreezeVirtualCard);

router.post("/bills/virtual-card/terminate", terminateVirtualCard);

// Add this route for manual gift card sync
router.post("/sync-giftcards", async (req, res) => {
    try {
        const { runGiftCardSyncNow } = require("../utils/giftCardSync");
        await runGiftCardSyncNow();
        res.json({ message: "Gift card sync completed successfully" });
    } catch (error) {
        console.error("Error in manual gift card sync:", error);
        res.status(500).json({ error: "Failed to sync gift cards" });
    }
});

router.get("/giftcards/stats", async (req, res) => {
    try {
        const GiftCard = require("../models/giftCards");

        const totalCards = await GiftCard.countDocuments();
        const activeCards = await GiftCard.countDocuments({ isActive: true });
        const lastSync = await GiftCard.findOne()
            .sort({ lastSynced: -1 })
            .select("lastSynced");

        // Get unique countries
        const countries = await GiftCard.distinct("data.countryCode");

        // Get unique brands
        const brands = await GiftCard.distinct("data.brandName");

        res.json({
            totalCards,
            activeCards,
            inactiveCards: totalCards - activeCards,
            lastSync: lastSync ? lastSync.lastSynced : null,
            uniqueCountries: countries.length,
            uniqueBrands: brands.length,
        });
    } catch (error) {
        console.error("Error getting gift card stats:", error);
        res.status(500).json({ error: "Failed to get gift card statistics" });
    }
});

router.get(
    "/bills/giftcard/search",
    searchGiftCardsByTermValidators,
    searchGiftCardsByTerm,
    purchaseLimiter
);

module.exports = router;
