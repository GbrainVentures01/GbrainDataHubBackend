const nigerianBanks = [
  { name: 'Access Bank', code: '044', slug: 'access-bank' },
  { name: 'Citibank Nigeria', code: '023', slug: 'citibank' },
  { name: 'Ecobank Nigeria', code: '050', slug: 'ecobank' },
  { name: 'Fidelity Bank', code: '070', slug: 'fidelity-bank' },
  { name: 'First Bank of Nigeria', code: '011', slug: 'first-bank' },
  { name: 'First City Monument Bank (FCMB)', code: '214', slug: 'fcmb' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058', slug: 'gtbank' },
  { name: 'Heritage Bank', code: '030', slug: 'heritage-bank' },
  { name: 'Keystone Bank', code: '082', slug: 'keystone-bank' },
  { name: 'Polaris Bank', code: '076', slug: 'polaris-bank' },
  { name: 'Providus Bank', code: '101', slug: 'providus-bank' },
  { name: 'Stanbic IBTC Bank', code: '221', slug: 'stanbic-ibtc' },
  { name: 'Standard Chartered Bank', code: '068', slug: 'standard-chartered' },
  { name: 'Sterling Bank', code: '232', slug: 'sterling-bank' },
  { name: 'Union Bank of Nigeria', code: '032', slug: 'union-bank' },
  { name: 'United Bank for Africa (UBA)', code: '033', slug: 'uba' },
  { name: 'Unity Bank', code: '215', slug: 'unity-bank' },
  { name: 'Wema Bank', code: '035', slug: 'wema-bank' },
  { name: 'Zenith Bank', code: '057', slug: 'zenith-bank' },
  { name: 'Jaiz Bank', code: '301', slug: 'jaiz-bank' },
  { name: 'Suntrust Bank', code: '100', slug: 'suntrust-bank' },
  { name: 'Titan Trust Bank', code: '102', slug: 'titan-trust' },
  { name: 'Globus Bank', code: '103', slug: 'globus-bank' },
  { name: 'Parallex Bank', code: '104', slug: 'parallex-bank' },
  { name: 'Kuda Bank', code: '50211', slug: 'kuda-bank' },
  { name: 'VFD Microfinance Bank', code: '566', slug: 'vfd-mfb' },
  { name: 'Rubies Bank', code: '125', slug: 'rubies-bank' },
  { name: 'Optimus Bank', code: '107', slug: 'optimus-bank' },
  { name: 'PremiumTrust Bank', code: '105', slug: 'premiumtrust-bank' },
];

async function seedBanks(strapi) {
  try {
    console.log('Starting to seed Nigerian banks...');
    
    // Check if any banks exist
    const existingBanks = await strapi.entityService.count('api::bank.bank');
    
    if (existingBanks >= nigerianBanks.length) {
      console.log(`✅ All ${nigerianBanks.length} banks already seeded. Skipping seed operation.`);
      return;
    }

    // Get all existing bank codes in one query
    const allBanks = await strapi.entityService.findMany('api::bank.bank', {
      fields: ['code'],
      pagination: { limit: 1000 },
    });
    const existingCodes = new Set(allBanks.map(b => b.code));

    // Filter banks that need to be created
    const banksToCreate = nigerianBanks.filter(b => !existingCodes.has(b.code));

    if (banksToCreate.length === 0) {
      console.log('✅ All banks already exist. No seeding needed.');
      return;
    }

    // Create missing banks
    for (const bankData of banksToCreate) {
      try {
        await strapi.entityService.create('api::bank.bank', {
          data: bankData,
        });
        console.log(`✅ Created bank: ${bankData.name}`);
      } catch (err) {
        console.error(`⚠️  Failed to create bank ${bankData.name}:`, err.message);
      }
    }

    console.log(`✅ Bank seeding completed! Created ${banksToCreate.length} new banks.`);
  } catch (error) {
    console.error('⚠️  Error seeding banks (non-critical):', error.message);
    // Don't throw - this shouldn't block app startup
  }
}

module.exports = { seedBanks };
