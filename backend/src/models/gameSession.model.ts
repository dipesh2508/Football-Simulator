import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  GamePhase,
  Fixture,
  MatchResult,
  GoalEvent,
  CardEvent,
  PlayerSeasonStats,
  TransferRecord,
  StandingEntry,
  LineupSlot,
} from '@/types/game.types';

export interface IGameSession extends Document {
  sessionId: string;
  phase: GamePhase;
  userTeam: string;
  userTeamApiId: number;
  budget: number; // millions GBP
  squad: Types.ObjectId[];
  standings: StandingEntry[];
  fixtures: Fixture[];
  playerSeasonStats: PlayerSeasonStats[];
  transfers: TransferRecord[];
  currentGameweek: number;
  expiresAt: Date;
  formation: string;
  startingXI: LineupSlot[];
}

const GoalEventSchema = new Schema<GoalEvent>(
  {
    scorerName: String,
    scorerApiId: Number,
    assisterName: String,
    assisterApiId: Number,
    team: String,
  },
  { _id: false }
);

const CardEventSchema = new Schema<CardEvent>(
  {
    playerName: String,
    playerApiId: Number,
    team: String,
    type: { type: String, enum: ['yellow', 'red'] },
  },
  { _id: false }
);

const MatchResultSchema = new Schema<MatchResult>(
  {
    homeScore: Number,
    awayScore: Number,
    goals: [GoalEventSchema],
    cards: [CardEventSchema],
  },
  { _id: false }
);

const FixtureSchema = new Schema<Fixture>(
  {
    gameweek: { type: Number, required: true },
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    result: { type: MatchResultSchema, default: null },
  },
  { _id: false }
);

const StandingSchema = new Schema<StandingEntry>(
  {
    team: String,
    teamApiId: Number,
    played: { type: Number, default: 0 },
    won: { type: Number, default: 0 },
    drawn: { type: Number, default: 0 },
    lost: { type: Number, default: 0 },
    gf: { type: Number, default: 0 },
    ga: { type: Number, default: 0 },
    gd: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
  },
  { _id: false }
);

const PlayerSeasonStatsSchema = new Schema<PlayerSeasonStats>(
  {
    playerId: String,
    playerApiId: Number,
    playerName: String,
    club: String,
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    cleanSheets: { type: Number, default: 0 },
    yellowCards: { type: Number, default: 0 },
    redCards: { type: Number, default: 0 },
  },
  { _id: false }
);

const TransferRecordSchema = new Schema<TransferRecord>(
  {
    playerId: String,
    playerName: String,
    fee: Number,
    window: { type: String, enum: ['summer', 'january'] },
    type: { type: String, enum: ['buy', 'sell'] },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const GameSessionSchema = new Schema<IGameSession>(
  {
    sessionId: { type: String, required: true, unique: true },
    phase: {
      type: String,
      enum: ['team_selection', 'summer_transfer', 'season', 'january_transfer', 'season_end'],
      default: 'team_selection',
    },
    userTeam: { type: String, default: '' },
    userTeamApiId: { type: Number, default: 0 },
    budget: { type: Number, default: 0 },
    squad: [{ type: Schema.Types.ObjectId, ref: 'Player' }],
    standings: [StandingSchema],
    fixtures: [FixtureSchema],
    playerSeasonStats: [PlayerSeasonStatsSchema],
    transfers: [TransferRecordSchema],
    currentGameweek: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    formation: { type: String, default: '4-4-2' },
    startingXI: [
      {
        slotId: { type: String, required: true },
        label: { type: String, required: true },
        positionGroup: { type: String, required: true },
        playerId: { type: Schema.Types.ObjectId, ref: 'Player', default: null },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

// TTL index: MongoDB auto-deletes documents when expiresAt is reached
GameSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
GameSessionSchema.index({ sessionId: 1 });

export const GameSession = mongoose.model<IGameSession>('GameSession', GameSessionSchema);
