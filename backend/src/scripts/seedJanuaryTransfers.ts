/**
 * seedJanuaryTransfers.ts
 *
 * Imports January transfer data and matches players using fuzzy string matching.
 * Handles name variations and creates a transfer history record.
 *
 * Usage:
 *   npm run seed-january-transfers
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/config/db.config';
import { Player } from '@/models/player.model';

// Normalize names: remove accents and special characters for matching
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s]/g, ''); // Remove special characters
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const aLower = normalizeName(a);
  const bLower = normalizeName(b);
  
  if (aLower === bLower) return 0;
  
  const matrix: number[][] = [];
  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      if (bLower[i - 1] === aLower[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[bLower.length][aLower.length];
}

// Fuzzy match with threshold
function fuzzyMatch(playerName: string, candidateName: string, threshold = 2): boolean {
  const distance = levenshteinDistance(playerName, candidateName);
  return distance <= threshold;
}

// Transfer data for January 2026 - using full FC26 database names for better matching
const JANUARY_TRANSFERS = [
  // Arsenal
  { Club: 'Arsenal', Player: 'Oleksandr Volodymyrovych Zinchenko', Direction: 'Out', Destination: 'Ajax', Type: 'Permanent' },
  { Club: 'Arsenal', Player: 'Ethan Chidiebere Nwaneri', Direction: 'Out', Destination: 'Marseille', Type: 'Loan' },
  { Club: 'Arsenal', Player: 'Maldini Kacurri', Direction: 'Out', Destination: 'Grimsby Town', Type: 'Permanent' },
  
  // Aston Villa
  { Club: 'Aston Villa', Player: 'Kevin Oghenetega Tamaraebi Bakumo-Abraham', Direction: 'In', Destination: 'Beşiktaş', Type: 'Permanent' },
  { Club: 'Aston Villa', Player: 'Douglas Luiz Soares de Paulo', Direction: 'In', Destination: 'Juventus', Type: 'Loan' },
  { Club: 'Aston Villa', Player: 'Brian Djomeni Madjo', Direction: 'In', Destination: 'Metz', Type: 'Permanent' },
  { Club: 'Aston Villa', Player: 'Alysson Edward da Silva Santos', Direction: 'In', Destination: 'Grêmio', Type: 'Permanent' },
  { Club: 'Aston Villa', Player: 'Donyell Malen', Direction: 'Out', Destination: 'Roma', Type: 'Loan (with Obligation)' },
  { Club: 'Aston Villa', Player: 'Evann Guessand', Direction: 'Out', Destination: 'Crystal Palace', Type: 'Loan' },
  { Club: 'Aston Villa', Player: 'Louie Barry', Direction: 'Out', Destination: 'Stockport County', Type: 'Loan' },
  
  // Bournemouth
  { Club: 'Bournemouth', Player: 'Rayan Vitor Simplício Rocha', Direction: 'In', Destination: 'Vasco da Gama', Type: 'Permanent' },
  { Club: 'Bournemouth', Player: 'Alex Tóth', Direction: 'In', Destination: 'Ferencváros', Type: 'Permanent' },
  { Club: 'Bournemouth', Player: 'Fraser Gerard Forster', Direction: 'In', Destination: 'Free Agent', Type: 'Permanent' },
  { Club: 'Bournemouth', Player: 'Christos Mandas', Direction: 'In', Destination: 'Lazio', Type: 'Loan' },
  { Club: 'Bournemouth', Player: 'Antoine Serlom Semenyo', Direction: 'Out', Destination: 'Manchester City', Type: 'Permanent' },
  { Club: 'Bournemouth', Player: 'Julian Vicente Araujo Zuniga', Direction: 'Out', Destination: 'Celtic', Type: 'Loan' },
  
  // Brentford
  { Club: 'Brentford', Player: 'Kaye Furo', Direction: 'In', Destination: 'Club Brugge', Type: 'Permanent' },
  { Club: 'Brentford', Player: 'Frank Ogochukwu Onyeka', Direction: 'Out', Destination: 'Coventry City', Type: 'Loan' },
  { Club: 'Brentford', Player: 'Gustavo Nunes Fernandes Gomes', Direction: 'Out', Destination: 'Swansea City', Type: 'Loan' },
  { Club: 'Brentford', Player: 'Myles Peart-Harris', Direction: 'Out', Destination: 'Oxford United', Type: 'Permanent' },
  
  // Brighton & Hove Albion
  { Club: 'Brighton & Hove Albion', Player: 'Pascal Groß', Direction: 'In', Destination: 'Borussia Dortmund', Type: 'Permanent' },
  { Club: 'Brighton & Hove Albion', Player: 'Brajan Gruda', Direction: 'Out', Destination: 'RB Leipzig', Type: 'Loan' },
  { Club: 'Brighton & Hove Albion', Player: 'Jeremy Leonel Sarmiento Morante', Direction: 'Out', Destination: 'Middlesbrough', Type: 'Loan' },
  { Club: 'Brighton & Hove Albion', Player: 'Simon Adingra', Direction: 'Out', Destination: 'Monaco', Type: 'Loan' },
  
  // Chelsea
  { Club: 'Chelsea', Player: 'Yisa Marcus Alao', Direction: 'In', Destination: 'Sheffield Wednesday', Type: 'Permanent' },
  { Club: 'Chelsea', Player: 'Axel Arthur Disasi', Direction: 'Out', Destination: 'West Ham United', Type: 'Loan' },
  { Club: 'Chelsea', Player: 'Tyrique George', Direction: 'Out', Destination: 'Everton', Type: 'Loan' },
  { Club: 'Chelsea', Player: 'Raheem Shaquille Sterling', Direction: 'Out', Destination: 'None', Type: 'Released' },
  
  // Crystal Palace
  { Club: 'Crystal Palace', Player: 'Jørgen Strand Larsen', Direction: 'In', Destination: 'Wolves', Type: 'Permanent' },
  { Club: 'Crystal Palace', Player: 'Brennan Price Johnson', Direction: 'In', Destination: 'Tottenham Hotspur', Type: 'Permanent' },
  { Club: 'Crystal Palace', Player: 'Evann Guessand', Direction: 'In', Destination: 'Aston Villa', Type: 'Loan' },
  { Club: 'Crystal Palace', Player: 'Addji Keaninkin Marc-Israel Guéhi', Direction: 'Out', Destination: 'Manchester City', Type: 'Permanent' },
  { Club: 'Crystal Palace', Player: 'Naouirou Ahamada', Direction: 'Out', Destination: 'AJ Auxerre', Type: 'Permanent' },
  { Club: 'Crystal Palace', Player: 'Jesurun Rak-Sakyi', Direction: 'Out', Destination: 'Stoke City', Type: 'Loan' },
  { Club: 'Crystal Palace', Player: 'Romain Esse', Direction: 'Out', Destination: 'Coventry City', Type: 'Loan' },
  
  // Everton
  { Club: 'Everton', Player: 'Tyrique George', Direction: 'In', Destination: 'Chelsea', Type: 'Loan' },
  { Club: 'Everton', Player: 'Harry Tyrer', Direction: 'Out', Destination: 'Cardiff City', Type: 'Permanent' },
  { Club: 'Everton', Player: 'Elijah Campbell', Direction: 'Out', Destination: 'Port Vale', Type: 'Loan' },
  
  // Fulham
  { Club: 'Fulham', Player: 'Oscar Bobb', Direction: 'In', Destination: 'Manchester City', Type: 'Permanent' },
  { Club: 'Fulham', Player: 'Adama Traoré Diarra', Direction: 'Out', Destination: 'West Ham United', Type: 'Permanent' },
  { Club: 'Fulham', Player: 'Steven Benda', Direction: 'Out', Destination: 'Feyenoord', Type: 'Loan' },
  { Club: 'Fulham', Player: 'Luke Harris', Direction: 'Out', Destination: 'Wycombe Wanderers', Type: 'Loan' },
  
  // Leeds United
  { Club: 'Leeds United', Player: 'Facundo Buonanotte', Direction: 'In', Destination: 'Brighton & Hove Albion', Type: 'Loan' },
  { Club: 'Leeds United', Player: 'Jack Harrison', Direction: 'Out', Destination: 'Fiorentina', Type: 'Loan' },
  { Club: 'Leeds United', Player: 'Harry Gray', Direction: 'Out', Destination: 'Rotherham United', Type: 'Loan' },
  
  // Liverpool
  { Club: 'Liverpool', Player: 'Calum Scanlon', Direction: 'Out', Destination: 'Cardiff City', Type: 'Loan' },
  { Club: 'Liverpool', Player: 'James Norris', Direction: 'Out', Destination: 'Shelbourne', Type: 'Permanent' },
  
  // Manchester City
  { Club: 'Manchester City', Player: 'Antoine Serlom Semenyo', Direction: 'In', Destination: 'Bournemouth', Type: 'Permanent' },
  { Club: 'Manchester City', Player: 'Addji Keaninkin Marc-Israel Guéhi', Direction: 'In', Destination: 'Crystal Palace', Type: 'Permanent' },
  { Club: 'Manchester City', Player: 'Oscar Bobb', Direction: 'Out', Destination: 'Fulham', Type: 'Permanent' },
  { Club: 'Manchester City', Player: 'Stefan Ortega Moreno', Direction: 'Out', Destination: 'Nottingham Forest', Type: 'Permanent' },
  { Club: 'Manchester City', Player: 'Claudio Jeremías Echeverri', Direction: 'Out', Destination: 'Girona', Type: 'Loan' },
  { Club: 'Manchester City', Player: 'Jahmai Simpson-Pusey', Direction: 'Out', Destination: 'FC Köln', Type: 'Loan' },
  
  // Manchester United
  { Club: 'Manchester United', Player: 'Harry Amass', Direction: 'Out', Destination: 'Norwich City', Type: 'Loan' },
  { Club: 'Manchester United', Player: 'Toby Collyer', Direction: 'Out', Destination: 'Hull City', Type: 'Loan' },
  { Club: 'Manchester United', Player: 'Ethan Wheatley', Direction: 'Out', Destination: 'Bradford City', Type: 'Loan' },
  
  // Newcastle United
  { Club: 'Newcastle United', Player: 'Harrison Ashby', Direction: 'Out', Destination: 'Bradford City', Type: 'Loan' },
  { Club: 'Newcastle United', Player: 'Ben Parkinson', Direction: 'Out', Destination: 'Falkirk', Type: 'Permanent' },
  
  // Nottingham Forest
  { Club: 'Nottingham Forest', Player: 'Luca Netz', Direction: 'In', Destination: 'Borussia Mönchengladbach', Type: 'Permanent' },
  { Club: 'Nottingham Forest', Player: 'Lorenzo Lucca', Direction: 'In', Destination: 'Napoli', Type: 'Loan' },
  { Club: 'Nottingham Forest', Player: 'Stefan Ortega Moreno', Direction: 'In', Destination: 'Manchester City', Type: 'Permanent' },
  { Club: 'Nottingham Forest', Player: 'Arnaud Kalimuendo Muinga', Direction: 'Out', Destination: 'Eintracht Frankfurt', Type: 'Loan' },
  { Club: 'Nottingham Forest', Player: 'Jamie McDonnell', Direction: 'Out', Destination: 'Oxford United', Type: 'Permanent' },
  
  // Sunderland
  { Club: 'Sunderland', Player: 'Nilson David Angulo Ramírez', Direction: 'In', Destination: 'Anderlecht', Type: 'Permanent' },
  { Club: 'Sunderland', Player: 'Jocelin Ta Bi', Direction: 'In', Destination: 'Maccabi Netanya', Type: 'Permanent' },
  { Club: 'Sunderland', Player: 'Dan Neil', Direction: 'Out', Destination: 'Ipswich Town', Type: 'Loan' },
  { Club: 'Sunderland', Player: 'Anthony Patterson', Direction: 'Out', Destination: 'Millwall', Type: 'Loan' },
  { Club: 'Sunderland', Player: 'Aji Alese', Direction: 'Out', Destination: 'Portsmouth', Type: 'Loan' },
  
  // Tottenham Hotspur
  { Club: 'Tottenham Hotspur', Player: 'Conor John Gallagher', Direction: 'In', Destination: 'Atletico Madrid', Type: 'Permanent' },
  { Club: 'Tottenham Hotspur', Player: 'João Victor de Souza Menezes', Direction: 'In', Destination: 'Santos', Type: 'Permanent' },
  { Club: 'Tottenham Hotspur', Player: 'Mason Melia', Direction: 'In', Destination: "St. Patrick's Athletic", Type: 'Permanent' },
  { Club: 'Tottenham Hotspur', Player: 'Brennan Price Johnson', Direction: 'Out', Destination: 'Crystal Palace', Type: 'Permanent' },
  { Club: 'Tottenham Hotspur', Player: 'Kota Takai', Direction: 'Out', Destination: 'Borussia Mönchengladbach', Type: 'Loan' },
  
  // West Ham United
  { Club: 'West Ham United', Player: 'Valentín Mariano José Castellanos Giménez', Direction: 'In', Destination: 'Lazio', Type: 'Permanent' },
  { Club: 'West Ham United', Player: 'Pablo Felipe Pereira de Jesus', Direction: 'In', Destination: 'Gil Vicente', Type: 'Permanent' },
  { Club: 'West Ham United', Player: 'Adama Traoré Diarra', Direction: 'In', Destination: 'Fulham', Type: 'Permanent' },
  { Club: 'West Ham United', Player: 'Axel Arthur Disasi', Direction: 'In', Destination: 'Chelsea', Type: 'Loan' },
  { Club: 'West Ham United', Player: 'Keiber Lamadrid', Direction: 'In', Destination: 'Deportivo La Guaira', Type: 'Loan' },
  { Club: 'West Ham United', Player: 'Niclas Füllkrug', Direction: 'Out', Destination: 'AC Milan', Type: 'Loan' },
  { Club: 'West Ham United', Player: 'James Ward-Prowse', Direction: 'Out', Destination: 'Burnley', Type: 'Loan' },
];

async function main() {
  console.log('\n📋 January Transfer Data Importer');
  console.log('==================================\n');

  await connectToDatabase();

  const matched: { transferData: typeof JANUARY_TRANSFERS[0]; player: any }[] = [];
  const unmatched: typeof JANUARY_TRANSFERS = [];

  // Try to match each transfer record to a player
  for (const transfer of JANUARY_TRANSFERS) {
    // Determine which club to search based on direction
    // Direction "In" = buying (player is at Destination)
    // Direction "Out" = selling (player is at Club)
    const searchClub = transfer.Direction === 'In' ? transfer.Destination : transfer.Club;
    
    const candidates = await Player.find({
      club: searchClub,
    });

    let bestMatch: any = null;
    let bestDistance = Infinity;

    // Pass 1: Find tight fuzzy match within the club (distance <= 2)
    for (const candidate of candidates) {
      const distance = levenshteinDistance(transfer.Player, candidate.name);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = candidate;
      }
    }

    // Pass 2: If no tight match, try loose match within club (distance <= 5)
    if (!bestMatch || bestDistance > 2) {
      bestMatch = null;
      bestDistance = Infinity;
      for (const candidate of candidates) {
        const distance = levenshteinDistance(transfer.Player, candidate.name);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = candidate;
        }
      }
      if (bestDistance > 5) {
        bestMatch = null;
      }
    }

    if (bestMatch) {
      matched.push({ transferData: transfer, player: bestMatch });
      console.log(`✓ ${transfer.Player.padEnd(40)} → ${bestMatch.name} @ ${searchClub} (distance: ${bestDistance})`);
    } else {
      unmatched.push(transfer);
      console.log(`✗ ${transfer.Player.padEnd(40)} [No match found in ${searchClub}]`);
    }
  }

  console.log('\n📊 Summary');
  console.log(`   Total transfers   : ${JANUARY_TRANSFERS.length}`);
  console.log(`   Matched           : ${matched.length}`);
  console.log(`   Unmatched         : ${unmatched.length}`);
  console.log(`   Match rate        : ${((matched.length / JANUARY_TRANSFERS.length) * 100).toFixed(1)}%`);

  if (unmatched.length > 0) {
    console.log('\n⚠️  Unmatched transfers:');
    for (const transfer of unmatched) {
      console.log(`   - ${transfer.Player} (${transfer.Club})`);
    }
  }

  // Apply transfers to database (only for "Out" direction - outgoing transfers)
  console.log('\n🔄 Applying transfers to database...');
  let appliedCount = 0;
  for (const { transferData, player } of matched) {
    if (transferData.Direction === 'Out') {
      try {
        await Player.findByIdAndUpdate(player._id, {
          club: transferData.Destination,
        });
        appliedCount++;
        console.log(`   ✓ ${player.name}: ${transferData.Club} → ${transferData.Destination}`);
      } catch (err) {
        console.error(`   ✗ Failed to update ${player.name}:`, err);
      }
    }
  }

  console.log(`\n✅ Applied ${appliedCount} transfers to database!`);
  console.log('   Players have been moved to their new clubs');

  await disconnectFromDatabase();
}

main().catch((err) => {
  console.error('❌ Import failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
