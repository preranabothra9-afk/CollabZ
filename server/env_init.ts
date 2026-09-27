import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Auto-clone .env.example to .env if missing to prevent initialization failures
const envPath = path.resolve(process.cwd(), '.env');
const envExamplePath = path.resolve(process.cwd(), '.env.example');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  try {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('Successfully copied .env.example fallback into active .env configuration.');
  } catch (err) {
    console.error('Failed to clone .env configuration from fallback:', err);
  }
}

// Load environment variables immediately on application boot
dotenv.config();
console.log('Environment initialized successfully.');
