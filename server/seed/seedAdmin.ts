import bcrypt from 'bcryptjs';
import { UserModel, db } from '../database';
import { generateUUID } from '../auth';
import { User } from '../../src/types';

/**
 * Validates password strength according to enterprise security standard.
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special symbol
 */
function validatePasswordStrength(password: string): boolean {
  if (password.length < 8) return false;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasNonsAlphanumeric = /[^a-zA-Z\d]/.test(password);
  return hasUpperCase && hasLowerCase && hasNumbers && hasNonsAlphanumeric;
}

export async function seedAdmin(): Promise<void> {
  const adminName = process.env.ADMIN_NAME;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // Print startup check
  console.log('\x1b[36m%s\x1b[0m', 'ℹ️ Checking administrative profiles status...');

  try {
    // 1. If environment variables are missing, warn the cluster logs and skip
    if (!adminName || !adminEmail || !adminPassword) {
      console.log('\x1b[33m%s\x1b[0m', '⚠️ Missing ADMIN_NAME, ADMIN_EMAIL, or ADMIN_PASSWORD env variables.');
      console.log('\x1b[31m%s\x1b[0m', '❌ Admin seed failed: Environment variables not configured.');
      return;
    }

    // 2. Normalize and check constraints
    const emailLower = adminEmail.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      console.log('\x1b[31m%s\x1b[0m', `❌ Admin seed failed: Invalid email format (${adminEmail})`);
      return;
    }

    // 3. Validate password strength
    if (!validatePasswordStrength(adminPassword)) {
      console.log('\x1b[31m%s\x1b[0m', '❌ Admin seed failed: Password does not meet security strength criteria (At least 8 chars, 1 uppercase, 1 lowercase, 1 number, and 1 special character).');
      return;
    }

    // 4. Look up database for administrator by the current configured email address
    const existingUser = await UserModel.findOne({ email: emailLower });
    
    if (existingUser) {
      let changed = false;

      // Ensure their role is elevated to admin
      if (existingUser.role !== 'admin') {
        existingUser.role = 'admin';
        changed = true;
        
        await db.logAudit(
          existingUser._id,
          existingUser.name,
          existingUser.email,
          'ROLE_CHANGE',
          'Seeder automatically elevated existing user profile to Super Administrator role policy to match environment configuration.',
          undefined,
          '127.0.0.1'
        );
        console.log('\x1b[32m%s\x1b[0m', `✅ Existing user elevated to Admin: ${existingUser.email}`);
      }

      // Repair verification state: an env-configured admin is not a
      // self-service signup, so the verification gate must never apply.
      if (existingUser.isVerified !== true) {
        existingUser.isVerified = true;
        existingUser.verifyToken = null;
        existingUser.verifyTokenExpiresAt = null;
        changed = true;
        console.log('\x1b[32m%s\x1b[0m', `✅ Admin email marked as verified: ${existingUser.email}`);
      }

      // Check if password needs to be synchronized (e.g., if env ADMIN_PASSWORD has changed)
      const currentPasswordHash = await db.getPasswordHash(existingUser._id);
      const isPasswordMatch = currentPasswordHash ? await bcrypt.compare(adminPassword, currentPasswordHash) : false;

      if (!isPasswordMatch) {
         const salt = await bcrypt.genSalt(10);
         existingUser.password = await bcrypt.hash(adminPassword, salt);
         changed = true;

         await db.logAudit(
           existingUser._id,
           existingUser.name,
           existingUser.email,
           'PASSWORD_RESET',
           'System startup seeder synchronized database credentials with configured environment credentials.',
           undefined,
           '127.0.0.1'
         );
         console.log('\x1b[32m%s\x1b[0m', `✅ Admin credentials password synchronized with environment variables: ${emailLower}`);
      }

      if (changed) {
        existingUser.updatedAt = new Date().toISOString();
        await existingUser.save();
      } else {
        console.log('\x1b[36m%s\x1b[0m', 'ℹ️ Admin already exists');
      }
      return;
    }

    // 5. Create new Administrator user account if it doesn't exist
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const adminUserObj: User = {
      id: generateUUID(),
      name: adminName,
      email: emailLower,
      avatar: adminName.slice(0, 2).toUpperCase(),
      role: 'admin',
      createdAt: new Date().toISOString()
    };

    // Store user with properly salted password
    await UserModel.create({
      _id: adminUserObj.id,
      name: adminUserObj.name,
      email: adminUserObj.email,
      password: passwordHash,
      avatar: adminUserObj.avatar,
      role: 'admin',
      blocked: false,
      isBlocked: false,
      // Bootstrapped from server env, not a self-service signup, so the
      // email-verification gate does not apply. Without this the seeded
      // admin would be created with the schema default (false) and
      // permanently locked out of their own dashboard.
      isVerified: true,
      verifyToken: null,
      verifyTokenExpiresAt: null,
      lastActiveAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      createdAt: adminUserObj.createdAt,
      updatedAt: new Date().toISOString()
    });

    // Write log entry for audit log trail
    await db.logAudit(
      adminUserObj.id,
      adminUserObj.name,
      adminUserObj.email,
      'REGISTER',
      'System startup seeder created pre-configured default Admin user successfully.',
      undefined,
      '127.0.0.1'
    );

    console.log('\x1b[32m%s\x1b[0m', `✅ Admin user seeded successfully: ${emailLower}`);

  } catch (error: any) {
    console.log('\x1b[31m%s\x1b[0m', `❌ Admin seed failed: ${error?.message || error}`);
  }
}
