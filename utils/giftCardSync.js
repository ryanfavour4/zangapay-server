const cron = require('node-cron');
const axios = require('axios');
const GiftCard = require('../models/giftCards');
const dotenv = require('dotenv');
const GiftCardCountry = require('../models/giftCardCountries');

dotenv.config();

const reloadlyClientId = process.env.RELOADLY_API_CLIENT_ID;
const reloadlySecretKey = process.env.RELOADLY_API_CLIENT_SECRET;

const giftCardUrl = 'https://giftcards.reloadly.com/';

// Function to get access token from Reloadly
async function getReloadlyAccessToken() {
  try {
    const payload = {
      client_id: reloadlyClientId,
      client_secret: reloadlySecretKey,
      grant_type: 'client_credentials',
      audience: giftCardUrl,
    };

    const response = await axios.post('https://auth.reloadly.com/oauth/token', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Reloadly access token:', error);
    throw error;
  }
}

// Helper function to retry axios GET requests on EAI_AGAIN errors
async function fetchWithRetry(url, config, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, config);
    } catch (error) {
      if (error.code === 'EAI_AGAIN' && i < retries - 1) {
        console.warn(`Network error (EAI_AGAIN), retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw error;
      }
    }
  }
}

// Fetch all gift card products from Reloadly
async function fetchGiftCardProducts() {
  try {
    const accessToken = await getReloadlyAccessToken();
    const config = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    let allProducts = [];
    let page = 1;
    const size = 200;
    let totalPages = 1;
    const maxPages = 1000;

    do {
      const response = await fetchWithRetry(
        `${giftCardUrl}products?page=${page}&size=${size}&includeRange=true`,
        { headers: config }
      );
      const data = response.data;

      if (page === 1) {
        console.log('First page response:', JSON.stringify(data, null, 2));
      }

      allProducts = allProducts.concat(data.content || []);
      totalPages = data.totalPages || 1;

      console.log(`Page ${page} - Products so far: ${allProducts.length}`);
      console.log(`Fetched page ${page} of ${totalPages}`);
      page++;

      if (page > maxPages) {
        console.warn('Reached max page limit, breaking out of loop.');
        break;
      }
    } while (page <= totalPages);

    return allProducts;
  } catch (error) {
    console.error('Error fetching gift card products:', error);
    throw error;
  }
}

// Fetch all gift card countries from Reloadly
async function fetchGiftCardCountries() {
  try {
    const accessToken = await getReloadlyAccessToken();
    const config = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const response = await fetchWithRetry(`${giftCardUrl}countries`, { headers: config });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching gift card countries:', error);
    throw error;
  }
}

// Sync gift card products to database
async function syncGiftCardData() {
  try {
    await syncGiftCardCountries();
    
    console.log('Starting gift card data sync...');

    await GiftCard.updateMany(
      { isActive: false },
      { $set: { isActive: true } }
    );
    console.log('All gift cards marked as inactive before sync.');

    const products = await fetchGiftCardProducts();

    if (!products || products.length === 0) {
      console.log('No gift card products found');
      return;
    }

    let syncedCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    const syncedProductIds = [];

    for (const product of products) {
      try {
        const giftCardData = {
          productId: product.productId,
          data: product,
          isActive: true,
          lastSynced: new Date(),
        };

        syncedProductIds.push(product.productId);

        const existing = await GiftCard.findOne({ productId: product.productId });

        if (!existing) {
          await GiftCard.create(giftCardData);
          syncedCount++;
        } else {
          const isSame = JSON.stringify(existing.data) === JSON.stringify(product);
          if (!isSame) {
            await GiftCard.updateOne({ productId: product.productId }, giftCardData);
            updatedCount++;
          } else {
            // If unchanged, just set isActive to true and update lastSynced
            await GiftCard.updateOne(
              { productId: product.productId },
              { $set: { isActive: true, lastSynced: new Date() } }
            );
            unchangedCount++;
          }
        }
      } catch (error) {
        console.error(`Error syncing product ${product.productId}:`, error.message);
        errorCount++;
      }
    }

    console.log(`Gift card sync completed: ${syncedCount} new, ${updatedCount} updated, ${unchangedCount} unchanged, ${errorCount} errors`);

    // No need to mark inactive here, as we already did it before fetching
    // But if you want to ensure only those not in the current sync are inactive, you can uncomment below:
    /*
    await GiftCard.updateMany(
      { productId: { $nin: syncedProductIds }, isActive: true },
      { $set: { isActive: false } }
    );
    */

    console.log(`Inactive products updated.`);
  } catch (error) {
    console.error('Error in gift card sync:', error);
  }
}

// Sync gift card countries to database
async function syncGiftCardCountries() {
  try {
    console.log('Starting gift card countries sync...');
    const countries = await fetchGiftCardCountries();
    console.log('Countries returned by API:', countries.length);

    if (!countries || countries.length === 0) {
      console.log('No gift card countries found');
      return;
    }

    let syncedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const syncedCodes = [];

    for (const country of countries) {
      const countryCode = country.isoName || country.isoCode || country.code || country.countryCode;
      if (!countryCode) {
        console.log('Skipping country with missing code:', country);
        continue;
      }

      syncedCodes.push(countryCode);

      try {
        const countryData = {
          countryCode,
          data: country,
          isActive: true,
          lastSynced: new Date(),
        };

        const result = await GiftCardCountry.findOneAndUpdate(
          { countryCode },
          countryData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (result.isNew) {
          syncedCount++;
        } else {
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error syncing country ${countryCode}:`, error.message);
        errorCount++;
      }
    }

    console.log(`Gift card country sync completed: ${syncedCount} new, ${updatedCount} updated, ${errorCount} errors`);

    // Safer deactivation
    await GiftCardCountry.updateMany(
      { countryCode: { $nin: syncedCodes }, isActive: true },
      { $set: { isActive: false } }
    );
  } catch (error) {
    console.error('Error in gift card country sync:', error);
  }
}

// Start the cron job
function startGiftCardSyncCron() {
  cron.schedule('0 2 * * *', async () => {
    console.log('Running scheduled gift card sync...');
    await syncGiftCardData();
  }, {
    scheduled: true,
    timezone: 'Africa/Lagos',
  });

  console.log('Gift card sync cron job started - will run daily at 2:00 AM WAT');
}

// Run sync immediately
async function runGiftCardSyncNow() {
  console.log('Running gift card sync now...');
  await syncGiftCardData();
}

module.exports = {
  startGiftCardSyncCron,
  runGiftCardSyncNow,
  syncGiftCardData,
};
