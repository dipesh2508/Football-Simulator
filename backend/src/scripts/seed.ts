import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/config/db.config';
import { Club } from '@/models/club.model';
import seedData from '@/data/clubs.seed.json';

async function seed() {
  console.log('🌱 Starting club seed...');

  await connectToDatabase();

  const clubs = seedData.clubs;

  await Club.deleteMany({});
  console.log('🗑️  Cleared existing clubs');

  const result = await Club.insertMany(clubs as any[]);
  console.log(`✅ Inserted ${result.length} clubs`);

  const plClubs = result.filter((c) => c.isPL);
  console.log(`   ↳ ${plClubs.length} Premier League clubs`);
  console.log(`   ↳ ${result.length - plClubs.length} source clubs from other leagues`);

  await disconnectFromDatabase();
  console.log('✅ Club seed complete');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
