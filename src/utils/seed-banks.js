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

async function seedBanks() {
  try {
    console.log('Starting to seed Nigerian banks...');
    
    for (const bankData of nigerianBanks) {
      // Check if bank already exists
      const existing = await strapi.db.query('api::bank.bank').findOne({
        where: { code: bankData.code },
      });

      if (!existing) {
        await strapi.entityService.create('api::bank.bank', {
          data: bankData,
        });
        console.log(`✅ Created bank: ${bankData.name}`);
      } else {
        console.log(`⏭️  Bank already exists: ${bankData.name}`);
      }
    }

    console.log('✅ Bank seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding banks:', error);
  }
}

module.exports = { seedBanks };
