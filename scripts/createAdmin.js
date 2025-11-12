import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/baroni');
    console.log('Connected to MongoDB');

    // Admin credentials
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@baroni.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.ADMIN_NAME || 'Baroni Admin';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      email: adminEmail.toLowerCase(), 
      role: 'admin' 
    });

    if (existingAdmin) {
      console.log('Admin already exists with email:', adminEmail);
      console.log('Admin ID:', existingAdmin._id);
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Create admin user
    const admin = await User.create({
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      name: adminName,
      role: 'admin',
      isDev: false
    });

    console.log('Admin created successfully!');
    console.log('Email:', admin.email);
    console.log('Name:', admin.name);
    console.log('Role:', admin.role);
    console.log('ID:', admin._id);

  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
createAdmin();
