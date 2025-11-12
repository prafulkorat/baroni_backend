import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Config from '../models/Config.js';
import Category from '../models/Category.js';
import CountryServiceConfig from '../models/CountryServiceConfig.js';

// Load environment variables
dotenv.config();

const initializeDefaultConfig = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/baroni');
    console.log('Connected to MongoDB');

    // Initialize default configuration
    console.log('Initializing default configuration...');
    const config = await Config.getSingleton();
    console.log('✓ Default configuration initialized');
    console.log('Config ID:', config._id);

    // Initialize default categories (professions)
    const defaultCategories = [
      { name: 'Actor', image: 'https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/placeholder_aws6oc.png' },
      { name: 'Musician', image: 'https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/placeholder_aws6oc.png' },
      { name: 'Comedian', image: 'https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/placeholder_aws6oc.png' },
      { name: 'Singer', image: 'https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/placeholder_aws6oc.png' },
      { name: 'Dancer', image: 'https://res.cloudinary.com/ddnpvm2yk/image/upload/v1759868390/placeholder_aws6oc.png' }
    ];

    for (const categoryData of defaultCategories) {
      const existingCategory = await Category.findOne({ name: categoryData.name });
      if (!existingCategory) {
        await Category.create(categoryData);
        console.log(`✓ Created default category: ${categoryData.name}`);
      } else {
        console.log(`- Category already exists: ${categoryData.name}`);
      }
    }

    // Initialize default country service configurations
    const defaultCountries = [
      {
        country: 'USA',
        countryCode: 'US',
        services: { videoCall: true, dedication: false, liveShow: true },
        sortOrder: 0
      },
      {
        country: 'Nigeria',
        countryCode: 'NG',
        services: { videoCall: true, dedication: true, liveShow: true },
        sortOrder: 1
      },
      {
        country: 'France',
        countryCode: 'FR',
        services: { videoCall: true, dedication: true, liveShow: false },
        sortOrder: 2
      }
    ];

    for (const countryData of defaultCountries) {
      const existingCountry = await CountryServiceConfig.findOne({ country: countryData.country });
      if (!existingCountry) {
        await CountryServiceConfig.create(countryData);
        console.log(`✓ Created default country config: ${countryData.country}`);
      } else {
        console.log(`- Country config already exists: ${countryData.country}`);
      }
    }

    console.log('🎉 Default configuration initialization completed successfully!');

  } catch (error) {
    console.error('❌ Error initializing default configuration:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
initializeDefaultConfig();
