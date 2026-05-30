import mongoose, { Schema, Document } from 'mongoose';
import { League, Position, PositionGroup, PlayerStats } from '@/types/game.types';

export interface IPlayer extends Document {
  apiId: number;
  name: string;
  nationality: string;
  club: string;
  clubApiId: number;
  league: League;
  position: Position;
  positionGroup: PositionGroup;
  age: number;
  marketValue: number; // millions GBP
  wage: number; // weekly GBP
  stats: PlayerStats;
  photoUrl: string;
  affinityClubs: string[];
  antiAffinityClubs: string[];
  isFreeAgent: boolean;
  contractExpiry: number; // year contract expires, e.g. 2028
}

const PlayerSchema = new Schema<IPlayer>(
  {
    apiId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    nationality: { type: String, default: '' },
    club: { type: String, required: true },
    clubApiId: { type: Number, default: 0 },
    league: { type: String, required: true },
    position: { type: String, required: true },
    positionGroup: { type: String, enum: ['GK', 'DEF', 'MID', 'FWD'], required: true },
    age: { type: Number, required: true },
    marketValue: { type: Number, default: 1 },
    wage: { type: Number, default: 0 },
    stats: {
      overall: { type: Number, default: 60 },
      pace: { type: Number, default: 60 },
      shooting: { type: Number, default: 60 },
      passing: { type: Number, default: 60 },
      dribbling: { type: Number, default: 60 },
      defending: { type: Number, default: 60 },
      physical: { type: Number, default: 60 },
    },
    photoUrl: { type: String, default: '' },
    affinityClubs: [{ type: String }],
    antiAffinityClubs: [{ type: String }],
    isFreeAgent: { type: Boolean, default: false },
    contractExpiry: { type: Number, default: 2027 },
  },
  { timestamps: true }
);

PlayerSchema.index({ club: 1 });
PlayerSchema.index({ league: 1 });
PlayerSchema.index({ positionGroup: 1 });
PlayerSchema.index({ 'stats.overall': -1 });
PlayerSchema.index({ marketValue: -1 });
PlayerSchema.index({ wage: -1 });

export const Player = mongoose.model<IPlayer>('Player', PlayerSchema);
