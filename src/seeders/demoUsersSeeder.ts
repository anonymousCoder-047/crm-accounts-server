import dotenv from 'dotenv'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '../models/User'
import Auth from '../models/Auth'
import connectDB from '../config/database'

// Load environment variables
dotenv.config()

const demoPassword = process.env.DEMO_USER_PASSWORD || 'Demo@123'

const demoUsers = [
  {
    name: 'Ahmed Al Mansoori',
    email: 'ahmed.mansoori@crm.com',
    username: 'ahmed.mansoori',
    role: 'admin',
    isActive: true,
    employeeId: 'EMP001',
    department: 'Management',
    position: 'Operations Manager',
    phone: '+971 50 123 4567',
    city: 'Dubai',
    country: 'UAE',
    hireDate: new Date('2023-01-15'),
  },
  {
    name: 'Fatima Al Zaabi',
    email: 'fatima.zaabi@crm.com',
    username: 'fatima.zaabi',
    role: 'manager',
    isActive: true,
    employeeId: 'EMP002',
    department: 'Sales',
    position: 'Sales Manager',
    phone: '+971 50 234 5678',
    city: 'Dubai',
    country: 'UAE',
    hireDate: new Date('2023-03-20'),
  },
  {
    name: 'Mohammed Al Shamsi',
    email: 'mohammed.shamsi@crm.com',
    username: 'mohammed.shamsi',
    role: 'user',
    isActive: true,
    employeeId: 'EMP003',
    department: 'Sales',
    position: 'Sales Representative',
    phone: '+971 50 345 6789',
    city: 'Dubai',
    country: 'UAE',
    hireDate: new Date('2023-06-10'),
  },
]

async function seedDemoUsers() {
  await connectDB()

  const salt = await bcrypt.genSalt(12)
  const hashed = await bcrypt.hash(demoPassword, salt)

  for (const u of demoUsers) {
    // Ensure user profile exists
    let profile = await User.findOne({ email: u.email })
    if (!profile) {
      const { username, ...profileData } = u
      profile = await User.create(profileData)
      console.log(`✅ Created user profile: ${u.email} (${u.role})`)
    } else {
      console.log(`ℹ️  User profile already exists: ${u.email}`)
    }

    // Ensure auth credentials exist and are linked
    let auth = await Auth.findOne({ user_profile: profile._id })
    if (!auth) {
      auth = await Auth.findOne({ email: u.email })
    }

    if (auth) {
      const needsLink =
        !auth.user_profile || auth.user_profile.toString() !== profile.id
      if (needsLink || !auth.active) {
        auth.user_profile = new mongoose.Types.ObjectId(profile.id)
        auth.active = true
        await auth.save()
        console.log(`✅ Linked/activated existing credentials: ${u.email}`)
      } else {
        console.log(`ℹ️  Credentials already exist: ${u.email}`)
      }
    } else {
      await Auth.create({
        username: u.username,
        email: u.email,
        password: hashed,
        user_profile: new mongoose.Types.ObjectId(profile.id),
        ip_address: '127.0.0.1',
        country: u.country,
        active: true,
        created_by: profile._id,
      } as any)
      console.log(`✅ Created demo credentials: ${u.email} (${u.role})`)
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅ Demo users ready — password: ${demoPassword}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await mongoose.disconnect()
  process.exit(0)
}

seedDemoUsers().catch((err) => {
  console.error('❌ Demo user seeding failed:', err)
  process.exit(1)
})
