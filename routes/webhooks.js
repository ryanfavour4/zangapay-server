const express = require('express');
const pluginWebHookEvent = require('../webhooks/plugin-web-hook');
const vtpassWebhookEvent = require('../webhooks/vtpass-web-hook');
const { giftcardWebhook } = require('../webhooks/giftcard-web-hook');
const { virtualCardWebhooks } = require('../webhooks/virtual-card-web-hook');
const { verifyFincraWebhook } = require('../controllers/deposit');
const vtuAfricaWebhook = require('../webhooks/airtime-cash-webhook');
const router = express.Router();

router.post('/pluging-webhook', pluginWebHookEvent);

router.post('/vtpass-webhook', vtpassWebhookEvent);

router.post('/bitnob-webhook', virtualCardWebhooks);

router.post('/reloadly-webhook', giftcardWebhook);

router.post('/fincra/webhook/verify', verifyFincraWebhook);

router.post('/vtu-africa-webhook', vtuAfricaWebhook);

module.exports = router;
