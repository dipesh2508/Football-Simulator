/**
 * seedPlayersFromJson.ts
 *
 * Reads src/data/players.seed.json and upserts all players into MongoDB.
 * Run this after fetching + manually editing the JSON file.
 *
 * Usage:
 *   npm run seed-players
 *   npm run seed-players -- --clear   (delete all existing players first)
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/config/db.config';
import { Player } from '@/models/player.model';
import type { PlayerSeedEntry } from './fetchToJson';

const INPUT_FILE = path.join(__dirname, '../data/players.seed.json');

async function main() {
  const shouldClear = process.argv.includes('--clear');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ players.seed.json not found at ${INPUT_FILE}`);
    console.error('   Run "npm run fetch-to-json" first to generate it.');
    process.exit(1);
  }

  let players: PlayerSeedEntry[];
  try {
    players = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  } catch (err: any) {
    console.error('❌ Failed to parse players.seed.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(players) || players.length === 0) {
    console.error('❌ players.seed.json is empty or not an array.');
    process.exit(1);
  }

  console.log(`📂 Loaded ${players.length} players from players.seed.json`);

  await connectToDatabase();

  if (shouldClear) {
    const deleted = await Player.deleteMany({});
    console.log(`🗑️  Cleared ${deleted.deletedCount} existing players`);
  }

  // Batch upserts in chunks of 500 to avoid hitting BSON size limits
  const CHUNK_SIZE = 500;
  let totalUpserted = 0;

  for (let i = 0; i < players.length; i += CHUNK_SIZE) {
    const chunk = players.slice(i, i + CHUNK_SIZE);

    const bulkOps = chunk.map((p) => ({
      updateOne: {
        filter: { apiId: p.apiId },
        update: { $set: p },
        upsert: true,
      },
    }));

    const result = await Player.bulkWrite(bulkOps as any);
    totalUpserted += result.upsertedCount + result.modifiedCount;

    const end = Math.min(i + CHUNK_SIZE, players.length);
    console.log(`   ✅ Processed ${i + 1}–${end} / ${players.length}`);
  }

  const totalInDb = await Player.countDocuments();

  console.log('\n📊 Summary:');
  console.log(`   Players processed : ${players.length}`);
  console.log(`   Upserted/updated  : ${totalUpserted}`);
  console.log(`   Total in DB       : ${totalInDb}`);
  console.log('\n🎉 Player seeding complete!');

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
