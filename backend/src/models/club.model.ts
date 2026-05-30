import mongoose, { Schema, Document } from 'mongoose';
import { League } from '@/types/game.types';

export interface IClub extends Document {
  name: string;
  longName: string;
  shortName: string;
  apiId: number;
  league: League;
  leagueApiId: number;
  reputation: number; // 1-10
  isPL: boolean;
  badgeUrl: string;
  lastSeasonFinish?: number; // 1-20, PL clubs only
  budgetRange?: [number, number]; // [min, max] millions GBP, PL clubs only
  promoted?: boolean; // True if promoted from Championship to PL this season
}

const ClubSchema = new Schema<IClub>(
  {
    name: { type: String, required: true, unique: true },
    longName: { type: String, default: '' },
    shortName: { type: String, default: '' },
    apiId: { type: Number, default: 0 },
    league: { type: String, required: true },
    leagueApiId: { type: Number, required: true },
    reputation: { type: Number, required: true, min: 1, max: 10 },
    isPL: { type: Boolean, required: true },
    badgeUrl: { type: String, default: '' },
    lastSeasonFinish: { type: Number },
    budgetRange: { type: [Number] },
    promoted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ClubSchema.index({ isPL: 1 });
ClubSchema.index({ league: 1 });
ClubSchema.index({ reputation: -1 });

export const Club = mongoose.model<IClub>('Club', ClubSchema);
