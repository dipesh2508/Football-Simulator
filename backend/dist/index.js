'use strict';

var dotenv = require('dotenv');
var express = require('express');
var cookieParser = require('cookie-parser');
var cors = require('cors');
var uuid = require('uuid');
var mongoose4 = require('mongoose');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var dotenv__default = /*#__PURE__*/_interopDefault(dotenv);
var express__default = /*#__PURE__*/_interopDefault(express);
var cookieParser__default = /*#__PURE__*/_interopDefault(cookieParser);
var cors__default = /*#__PURE__*/_interopDefault(cors);
var mongoose4__default = /*#__PURE__*/_interopDefault(mongoose4);

// src/index.ts
var GoalEventSchema = new mongoose4.Schema(
  {
    scorerName: String,
    scorerApiId: Number,
    assisterName: String,
    assisterApiId: Number,
    team: String,
    isPenalty: { type: Boolean, default: false }
  },
  { _id: false }
);
var CardEventSchema = new mongoose4.Schema(
  {
    playerName: String,
    playerApiId: Number,
    team: String,
    type: { type: String, enum: ["yellow", "red"] }
  },
  { _id: false }
);
var SubstitutionEventSchema = new mongoose4.Schema(
  {
    playerOffName: String,
    playerOffApiId: Number,
    playerOnName: String,
    playerOnApiId: Number,
    team: String,
    minute: Number
  },
  { _id: false }
);
var MatchAppearanceSchema = new mongoose4.Schema(
  {
    playerApiId: Number,
    playerName: String,
    club: String,
    position: String,
    positionGroup: { type: String, enum: ["GK", "DEF", "MID", "FWD"] }
  },
  { _id: false }
);
var MatchResultSchema = new mongoose4.Schema(
  {
    homeScore: Number,
    awayScore: Number,
    goals: [GoalEventSchema],
    cards: [CardEventSchema],
    substitutions: [SubstitutionEventSchema],
    homeAppearances: [MatchAppearanceSchema],
    awayAppearances: [MatchAppearanceSchema]
  },
  { _id: false }
);
var FixtureSchema = new mongoose4.Schema(
  {
    gameweek: { type: Number, required: true },
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    result: { type: MatchResultSchema, default: null }
  },
  { _id: false }
);
var StandingSchema = new mongoose4.Schema(
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
    points: { type: Number, default: 0 }
  },
  { _id: false }
);
var PlayerSeasonStatsSchema = new mongoose4.Schema(
  {
    playerId: String,
    playerApiId: Number,
    playerName: String,
    club: String,
    clubApiId: { type: Number, default: 0 },
    appearances: { type: Number, default: 0 },
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    cleanSheets: { type: Number, default: 0 },
    yellowCards: { type: Number, default: 0 },
    redCards: { type: Number, default: 0 }
  },
  { _id: false }
);
var TransferRecordSchema = new mongoose4.Schema(
  {
    playerId: String,
    playerName: String,
    fee: Number,
    window: { type: String, enum: ["summer", "january"] },
    type: { type: String, enum: ["buy", "sell"] },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);
var GameSessionSchema = new mongoose4.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    phase: {
      type: String,
      enum: ["team_selection", "summer_transfer", "season", "january_transfer", "season_end"],
      default: "team_selection"
    },
    userTeam: { type: String, default: "" },
    userTeamApiId: { type: Number, default: 0 },
    budget: { type: Number, default: 0 },
    squad: [{ type: mongoose4.Schema.Types.ObjectId, ref: "Player" }],
    standings: [StandingSchema],
    fixtures: [FixtureSchema],
    playerSeasonStats: [PlayerSeasonStatsSchema],
    transfers: [TransferRecordSchema],
    currentGameweek: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    formation: { type: String, default: "4-4-2" },
    startingXI: [
      {
        slotId: { type: String, required: true },
        label: { type: String, required: true },
        positionGroup: { type: String, required: true },
        playerId: { type: mongoose4.Schema.Types.ObjectId, ref: "Player", default: null },
        isAltPosition: { type: Boolean, default: false },
        _id: false
      }
    ],
    aiSquads: { type: Map, of: [{ type: mongoose4.Schema.Types.ObjectId, ref: "Player" }], default: {} }
  },
  { timestamps: true }
);
GameSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
GameSessionSchema.index({ sessionId: 1 });
var GameSession = mongoose4__default.default.model("GameSession", GameSessionSchema);
var ClubSchema = new mongoose4.Schema(
  {
    name: { type: String, required: true, unique: true },
    longName: { type: String, default: "" },
    shortName: { type: String, default: "" },
    apiId: { type: Number, default: 0 },
    league: { type: String, required: true },
    leagueApiId: { type: Number, required: true },
    reputation: { type: Number, required: true, min: 1, max: 10 },
    isPL: { type: Boolean, required: true },
    badgeUrl: { type: String, default: "" },
    lastSeasonFinish: { type: Number },
    budgetRange: { type: [Number] },
    promoted: { type: Boolean, default: false }
  },
  { timestamps: true }
);
ClubSchema.index({ isPL: 1 });
ClubSchema.index({ league: 1 });
ClubSchema.index({ reputation: -1 });
var Club = mongoose4__default.default.model("Club", ClubSchema);
var PlayerSchema = new mongoose4.Schema(
  {
    apiId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    shortName: { type: String, required: true },
    nationality: { type: String, default: "" },
    club: { type: String, required: true },
    clubApiId: { type: Number, default: 0 },
    league: { type: String, required: true },
    position: { type: String, required: true },
    positionGroup: { type: String, enum: ["GK", "DEF", "MID", "FWD"], required: true },
    altPositions: { type: [String], default: [] },
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
      physical: { type: Number, default: 60 }
    },
    photoUrl: { type: String, default: "" },
    affinityClubs: [{ type: String }],
    antiAffinityClubs: [{ type: String }],
    isFreeAgent: { type: Boolean, default: false },
    contractExpiry: { type: Number, default: 2027 }
  },
  { timestamps: true }
);
PlayerSchema.index({ club: 1 });
PlayerSchema.index({ league: 1 });
PlayerSchema.index({ positionGroup: 1 });
PlayerSchema.index({ "stats.overall": -1 });
PlayerSchema.index({ marketValue: -1 });
PlayerSchema.index({ wage: -1 });
var Player = mongoose4__default.default.model("Player", PlayerSchema);

// src/utils/fixtures.util.ts
function generateFixtures(teams) {
  if (teams.length !== 20) {
    throw new Error(`Expected 20 teams, got ${teams.length}`);
  }
  const fixtures = [];
  const n = teams.length;
  const rounds = n - 1;
  const perRound = n / 2;
  const rotatingTeams = [...teams];
  const pivot = rotatingTeams.shift();
  for (let round = 0; round < rounds; round++) {
    const roundTeams = [pivot, ...rotatingTeams];
    const gameweek = round + 1;
    for (let match = 0; match < perRound; match++) {
      const home = roundTeams[match];
      const away = roundTeams[n - 1 - match];
      fixtures.push({ gameweek, homeTeam: home, awayTeam: away });
    }
    rotatingTeams.unshift(rotatingTeams.pop());
  }
  const firstLeg = [...fixtures];
  firstLeg.forEach((f) => {
    fixtures.push({
      gameweek: f.gameweek + rounds,
      homeTeam: f.awayTeam,
      awayTeam: f.homeTeam
    });
  });
  return fixtures;
}

// src/controllers/session.controller.ts
var SESSION_TTL_DAYS = 7;
async function createSession(req, res) {
  const sessionId = uuid.v4();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1e3);
  const session = await GameSession.create({ sessionId, expiresAt });
  res.status(201).json({ sessionId: session.sessionId });
}
async function getSession(req, res) {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId }).populate("squad").lean();
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  res.json(session);
}
async function selectTeam(req, res) {
  const { teamName } = req.body;
  if (!teamName) {
    res.status(400).json({ error: "teamName is required" });
    return;
  }
  const session = await GameSession.findOne({ sessionId: req.params.sessionId });
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  if (session.phase !== "team_selection") {
    res.status(409).json({ error: "Team has already been selected for this session" });
    return;
  }
  const club = await Club.findOne({ name: teamName, isPL: true });
  if (!club) {
    res.status(404).json({ error: `PL club "${teamName}" not found` });
    return;
  }
  const [budgetMin, budgetMax] = club.budgetRange ?? [20, 50];
  const budget = Math.round(budgetMin + Math.random() * (budgetMax - budgetMin));
  const initialSquad = await Player.find({ club: teamName }).sort({ "stats.overall": -1 }).limit(25).select("_id");
  const plClubs = await Club.find({ isPL: true }).select("name apiId").lean();
  const teamNames = plClubs.map((c) => c.name);
  const fixtures = generateFixtures(teamNames);
  const standings = plClubs.map((c) => ({
    team: c.name,
    teamApiId: c.apiId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0
  }));
  session.userTeam = club.name;
  session.userTeamApiId = club.apiId;
  session.budget = budget;
  session.squad = initialSquad.map((p) => p._id);
  session.fixtures = fixtures;
  session.standings = standings;
  session.phase = "summer_transfer";
  await session.save();
  res.json({
    userTeam: session.userTeam,
    budget: session.budget,
    squadCount: session.squad.length,
    phase: session.phase
  });
}

// src/routers/session.router.ts
var router = express.Router();
router.post("/", createSession);
router.get("/:sessionId", getSession);
router.post("/:sessionId/team", selectTeam);
var session_router_default = router;

// src/utils/likelihood.util.ts
function calculateLikelihood(player, targetClub, allClubs) {
  const currentClub = allClubs.find((c) => c.name === player.club);
  const currentReputation = currentClub?.reputation ?? 5;
  const targetReputation = targetClub.reputation;
  let score = 50;
  const repGap = targetReputation - currentReputation;
  score += repGap * 8;
  if (player.age <= 21) {
    if (repGap < 1) score -= 20;
  } else if (player.age <= 24) {
    if (repGap < 0) score -= 12;
  } else if (player.age >= 31) {
    score += 10;
  } else if (player.age >= 34) {
    score += 18;
  }
  if (player.antiAffinityClubs.includes(targetClub.name)) {
    score -= 45;
  } else if (player.affinityClubs.includes(targetClub.name)) {
    score += 22;
  }
  if (targetClub.isPL && !currentClub?.isPL) {
    score += 10;
  }
  if (player.isFreeAgent) {
    score += 25;
  }
  const budgetCeiling = targetClub.budgetRange?.[1] ?? 200;
  if (player.marketValue > budgetCeiling * 1.5) {
    score -= 20;
  }
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: finalScore,
    label: scoreToLabel(finalScore)
  };
}
function scoreToLabel(score) {
  if (score >= 80) return "certain";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  if (score >= 15) return "low";
  return "impossible";
}
function rollTransferDice(likelihood) {
  const roll = Math.random() * 100;
  return roll <= likelihood;
}

// src/controllers/player.controller.ts
async function getTransferMarket(req, res) {
  const {
    sessionId,
    page = "1",
    limit = "20",
    position,
    league,
    minValue,
    maxValue,
    search
  } = req.query;
  if (!sessionId) {
    res.status(400).json({ error: "sessionId query param is required" });
    return;
  }
  const session = await GameSession.findOne({ sessionId }).select("squad userTeam budget").lean();
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  const filter = {
    _id: { $nin: session.squad }
  };
  if (position) filter.positionGroup = position;
  if (league) filter.league = league;
  const priceFilter = {};
  if (minValue) priceFilter.$gte = parseFloat(minValue);
  if (maxValue) priceFilter.$lte = parseFloat(maxValue);
  if (Object.keys(priceFilter).length > 0) filter.marketValue = priceFilter;
  if (search) filter.name = { $regex: search, $options: "i" };
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;
  const [players, total] = await Promise.all([
    Player.find(filter).sort({ "stats.overall": -1 }).skip(skip).limit(limitNum).lean(),
    Player.countDocuments(filter)
  ]);
  const [userClub, allClubs] = await Promise.all([
    Club.findOne({ name: session.userTeam }).lean(),
    Club.find({}).lean()
  ]);
  const playersWithLikelihood = players.map((p) => {
    let likelihood = null;
    if (userClub) {
      likelihood = calculateLikelihood(p, userClub, allClubs);
    }
    return { ...p, likelihood };
  });
  res.json({
    players: playersWithLikelihood,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  });
}
async function getPlayerById(req, res) {
  const player = await Player.findById(req.params.id).lean();
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  res.json(player);
}

// src/routers/player.router.ts
var router2 = express.Router();
router2.get("/market", getTransferMarket);
router2.get("/:id", getPlayerById);
var player_router_default = router2;

// src/utils/aiTransfer.util.ts
async function runAITransfers(session, plClubs, allClubs, availablePlayers) {
  const summaries = [];
  const clubBought = /* @__PURE__ */ new Map();
  let pool = [...availablePlayers];
  const userTeam = session.userTeam;
  for (const club of plClubs) {
    if (club.name === userTeam) continue;
    const budget = getAIBudget(club);
    let remainingBudget = budget;
    const bought = [];
    const boughtIds = [];
    const positionNeeds = { GK: 2, DEF: 5, MID: 6, FWD: 4 };
    for (const [posGroup, needed] of Object.entries(positionNeeds)) {
      let purchased = 0;
      const candidates = pool.filter((p) => p.positionGroup === posGroup && p.marketValue <= remainingBudget * 0.4).sort((a, b) => b.stats.overall - a.stats.overall);
      for (const candidate of candidates) {
        if (purchased >= needed) break;
        if (candidate.marketValue > remainingBudget) continue;
        const likelihood = calculateLikelihood(candidate, club, allClubs);
        if (!rollTransferDice(likelihood.score)) continue;
        remainingBudget -= candidate.marketValue;
        bought.push(candidate.shortName);
        boughtIds.push(candidate._id);
        purchased++;
        pool = pool.filter((p) => p.apiId !== candidate.apiId);
      }
    }
    summaries.push({ club: club.name, bought, soldFunds: budget - remainingBudget });
    if (boughtIds.length > 0) clubBought.set(club.name, boughtIds);
  }
  return { summaries, updatedAvailable: pool, clubBought };
}
function getAIBudget(club) {
  const [min, max] = club.budgetRange ?? [20, 50];
  return Math.round(min + Math.random() * (max - min));
}

// src/controllers/transfer.controller.ts
async function buyPlayer(req, res) {
  const { playerId } = req.body;
  if (!playerId) {
    res.status(400).json({ error: "playerId is required" });
    return;
  }
  const session = await GameSession.findOne({ sessionId: req.params.sessionId });
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  if (session.phase !== "summer_transfer" && session.phase !== "january_transfer") {
    res.status(409).json({ error: "Transfer window is not open" });
    return;
  }
  const player = await Player.findById(playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  const alreadyOwned = session.squad.some((id) => id.equals(playerId));
  if (alreadyOwned) {
    res.status(409).json({ error: "Player is already in your squad" });
    return;
  }
  if (player.marketValue > session.budget) {
    res.status(400).json({
      error: `Insufficient budget. Player costs \xA3${player.marketValue}m, you have \xA3${session.budget}m`
    });
    return;
  }
  const [userClub, allClubs] = await Promise.all([
    Club.findOne({ name: session.userTeam }),
    Club.find({})
  ]);
  if (!userClub) {
    res.status(500).json({ error: "Could not find your club data" });
    return;
  }
  const likelihood = calculateLikelihood(player, userClub, allClubs);
  const success = rollTransferDice(likelihood.score);
  if (!success) {
    res.status(200).json({
      success: false,
      message: `Deal failed \u2014 ${player.shortName} chose not to join ${session.userTeam}.`,
      likelihood
    });
    return;
  }
  const window = session.phase === "summer_transfer" ? "summer" : "january";
  session.budget = Math.round((session.budget - player.marketValue) * 10) / 10;
  session.squad.push(new mongoose4.Types.ObjectId(playerId));
  session.transfers.push({
    playerId: playerId.toString(),
    playerName: player.shortName,
    fee: player.marketValue,
    window,
    type: "buy",
    timestamp: /* @__PURE__ */ new Date()
  });
  await session.save();
  res.json({
    success: true,
    message: `${player.shortName} has joined ${session.userTeam}!`,
    budget: session.budget,
    likelihood,
    player: { name: player.shortName, position: player.position, overall: player.stats.overall }
  });
}
async function sellPlayer(req, res) {
  const { playerId } = req.body;
  if (!playerId) {
    res.status(400).json({ error: "playerId is required" });
    return;
  }
  const session = await GameSession.findOne({ sessionId: req.params.sessionId });
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  if (session.phase !== "summer_transfer" && session.phase !== "january_transfer") {
    res.status(409).json({ error: "Transfer window is not open" });
    return;
  }
  const squadIds = session.squad;
  const idx = squadIds.findIndex((id) => id.equals(playerId));
  if (idx === -1) {
    res.status(400).json({ error: "Player is not in your squad" });
    return;
  }
  const player = await Player.findById(playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  const sellFee = Math.round(player.marketValue * 0.8 * 10) / 10;
  const window = session.phase === "summer_transfer" ? "summer" : "january";
  squadIds.splice(idx, 1);
  session.budget = Math.round((session.budget + sellFee) * 10) / 10;
  session.transfers.push({
    playerId: playerId.toString(),
    playerName: player.shortName,
    fee: sellFee,
    window,
    type: "sell",
    timestamp: /* @__PURE__ */ new Date()
  });
  await session.save();
  res.json({
    success: true,
    message: `${player.shortName} sold for \xA3${sellFee}m`,
    budget: session.budget
  });
}
async function confirmTransferWindow(req, res) {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId });
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  if (session.phase !== "summer_transfer" && session.phase !== "january_transfer") {
    res.status(409).json({ error: "Transfer window is not currently open" });
    return;
  }
  const [plClubs, allClubs, allPlayers] = await Promise.all([
    Club.find({ isPL: true }),
    Club.find({}),
    Player.find({ _id: { $nin: session.squad } })
  ]);
  const { summaries, clubBought } = await runAITransfers(session, plClubs, allClubs, allPlayers);
  const allBoughtPlayerIds = /* @__PURE__ */ new Set();
  for (const ids of clubBought.values()) {
    ids.forEach((id) => allBoughtPlayerIds.add(id.toString()));
  }
  const claimedIds = [
    ...session.squad,
    ...[...allBoughtPlayerIds].map((id) => new mongoose4.Types.ObjectId(id))
  ];
  const userTeam = session.userTeam;
  for (const club of plClubs) {
    if (club.name === userTeam) continue;
    const boughtIds = clubBought.get(club.name) ?? [];
    const originalSquad = await Player.find({
      club: club.name,
      _id: { $nin: claimedIds }
    }).sort({ "stats.overall": -1 }).limit(20).select("_id");
    const originalIds = originalSquad.map((p) => p._id);
    const allIds = [...originalIds, ...boughtIds];
    session.aiSquads.set(club.name, allIds);
  }
  session.markModified("aiSquads");
  session.phase = "season";
  await session.save();
  res.json({
    message: "Transfer window closed",
    nextPhase: session.phase,
    aiActivity: summaries.map((s) => ({
      club: s.club,
      signings: s.bought.length,
      topSignings: s.bought.slice(0, 3)
    }))
  });
}

// src/routers/transfer.router.ts
var router3 = express.Router();
router3.post("/:sessionId/buy", buyPlayer);
router3.post("/:sessionId/sell", sellPlayer);
router3.post("/:sessionId/transfers/confirm", confirmTransferWindow);
var transfer_router_default = router3;

// src/types/game.types.ts
var FORMATIONS = {
  "4-4-2": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "lb", label: "LB", positionGroup: "DEF" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "rb", label: "RB", positionGroup: "DEF" },
    { slotId: "lm", label: "LM", positionGroup: "MID" },
    { slotId: "cm1", label: "CM", positionGroup: "MID" },
    { slotId: "cm2", label: "CM", positionGroup: "MID" },
    { slotId: "rm", label: "RM", positionGroup: "MID" },
    { slotId: "lst", label: "ST", positionGroup: "FWD" },
    { slotId: "rst", label: "ST", positionGroup: "FWD" }
  ],
  "4-3-3": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "lb", label: "LB", positionGroup: "DEF" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "rb", label: "RB", positionGroup: "DEF" },
    { slotId: "cm1", label: "CM", positionGroup: "MID" },
    { slotId: "cm2", label: "CM", positionGroup: "MID" },
    { slotId: "cam", label: "CAM", positionGroup: "MID" },
    { slotId: "lw", label: "LW", positionGroup: "FWD" },
    { slotId: "st", label: "ST", positionGroup: "FWD" },
    { slotId: "rw", label: "RW", positionGroup: "FWD" }
  ],
  "4-2-3-1": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "lb", label: "LB", positionGroup: "DEF" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "rb", label: "RB", positionGroup: "DEF" },
    { slotId: "cdm1", label: "CDM", positionGroup: "MID" },
    { slotId: "cdm2", label: "CDM", positionGroup: "MID" },
    { slotId: "lam", label: "LAM", positionGroup: "MID" },
    { slotId: "cam", label: "CAM", positionGroup: "MID" },
    { slotId: "ram", label: "RAM", positionGroup: "MID" },
    { slotId: "st", label: "ST", positionGroup: "FWD" }
  ],
  "3-5-2": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "cb3", label: "CB", positionGroup: "DEF" },
    { slotId: "lwb", label: "LWB", positionGroup: "MID" },
    { slotId: "cm1", label: "CM", positionGroup: "MID" },
    { slotId: "cm2", label: "CM", positionGroup: "MID" },
    { slotId: "cm3", label: "CM", positionGroup: "MID" },
    { slotId: "rwb", label: "RWB", positionGroup: "MID" },
    { slotId: "lst", label: "ST", positionGroup: "FWD" },
    { slotId: "rst", label: "ST", positionGroup: "FWD" }
  ],
  "5-3-2": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "lwb", label: "LWB", positionGroup: "DEF" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "cb3", label: "CB", positionGroup: "DEF" },
    { slotId: "rwb", label: "RWB", positionGroup: "DEF" },
    { slotId: "cm1", label: "CM", positionGroup: "MID" },
    { slotId: "cm2", label: "CM", positionGroup: "MID" },
    { slotId: "cm3", label: "CM", positionGroup: "MID" },
    { slotId: "lst", label: "ST", positionGroup: "FWD" },
    { slotId: "rst", label: "ST", positionGroup: "FWD" }
  ],
  "4-5-1": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "lb", label: "LB", positionGroup: "DEF" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "rb", label: "RB", positionGroup: "DEF" },
    { slotId: "lm", label: "LM", positionGroup: "MID" },
    { slotId: "cm1", label: "CM", positionGroup: "MID" },
    { slotId: "cdm", label: "CDM", positionGroup: "MID" },
    { slotId: "cm2", label: "CM", positionGroup: "MID" },
    { slotId: "rm", label: "RM", positionGroup: "MID" },
    { slotId: "st", label: "ST", positionGroup: "FWD" }
  ],
  // Christmas Tree: 4 DEF · 3 CM · 2 CAM · 1 ST
  "4-3-2-1": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "lb", label: "LB", positionGroup: "DEF" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "rb", label: "RB", positionGroup: "DEF" },
    { slotId: "cm1", label: "CM", positionGroup: "MID" },
    { slotId: "cm2", label: "CM", positionGroup: "MID" },
    { slotId: "cm3", label: "CM", positionGroup: "MID" },
    { slotId: "lam", label: "LAM", positionGroup: "MID" },
    { slotId: "ram", label: "RAM", positionGroup: "MID" },
    { slotId: "st", label: "ST", positionGroup: "FWD" }
  ],
  // Second striker/shadow striker behind lone ST
  "4-4-1-1": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "lb", label: "LB", positionGroup: "DEF" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "rb", label: "RB", positionGroup: "DEF" },
    { slotId: "lm", label: "LM", positionGroup: "MID" },
    { slotId: "cm1", label: "CM", positionGroup: "MID" },
    { slotId: "cm2", label: "CM", positionGroup: "MID" },
    { slotId: "rm", label: "RM", positionGroup: "MID" },
    { slotId: "ss", label: "SS", positionGroup: "MID" },
    { slotId: "st", label: "ST", positionGroup: "FWD" }
  ],
  // Three at the back with attacking wide midfielders
  "3-4-3": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "cb3", label: "CB", positionGroup: "DEF" },
    { slotId: "lm", label: "LM", positionGroup: "MID" },
    { slotId: "cm1", label: "CM", positionGroup: "MID" },
    { slotId: "cm2", label: "CM", positionGroup: "MID" },
    { slotId: "rm", label: "RM", positionGroup: "MID" },
    { slotId: "lw", label: "LW", positionGroup: "FWD" },
    { slotId: "st", label: "ST", positionGroup: "FWD" },
    { slotId: "rw", label: "RW", positionGroup: "FWD" }
  ],
  // Single pivot CDM with four attack-minded mids
  "4-1-4-1": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "lb", label: "LB", positionGroup: "DEF" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "rb", label: "RB", positionGroup: "DEF" },
    { slotId: "cdm", label: "CDM", positionGroup: "MID" },
    { slotId: "lm", label: "LM", positionGroup: "MID" },
    { slotId: "cm1", label: "CM", positionGroup: "MID" },
    { slotId: "cm2", label: "CM", positionGroup: "MID" },
    { slotId: "rm", label: "RM", positionGroup: "MID" },
    { slotId: "st", label: "ST", positionGroup: "FWD" }
  ],
  // Holding 4-3-3: CDM + 2 CMs shields the defence while LW/ST/RW attack
  "4-3-3 hold": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "lb", label: "LB", positionGroup: "DEF" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "rb", label: "RB", positionGroup: "DEF" },
    { slotId: "cdm", label: "CDM", positionGroup: "MID" },
    { slotId: "cm1", label: "CM", positionGroup: "MID" },
    { slotId: "cm2", label: "CM", positionGroup: "MID" },
    { slotId: "lw", label: "LW", positionGroup: "FWD" },
    { slotId: "st", label: "ST", positionGroup: "FWD" },
    { slotId: "rw", label: "RW", positionGroup: "FWD" }
  ],
  // Wide 4-2-3-1: true wingers (FWD group) flank a central CAM behind the ST
  "4-2-3-1 wide": [
    { slotId: "gk", label: "GK", positionGroup: "GK" },
    { slotId: "lb", label: "LB", positionGroup: "DEF" },
    { slotId: "cb1", label: "CB", positionGroup: "DEF" },
    { slotId: "cb2", label: "CB", positionGroup: "DEF" },
    { slotId: "rb", label: "RB", positionGroup: "DEF" },
    { slotId: "cdm1", label: "CDM", positionGroup: "MID" },
    { slotId: "cdm2", label: "CDM", positionGroup: "MID" },
    { slotId: "cam", label: "CAM", positionGroup: "MID" },
    { slotId: "lw", label: "LW", positionGroup: "FWD" },
    { slotId: "st", label: "ST", positionGroup: "FWD" },
    { slotId: "rw", label: "RW", positionGroup: "FWD" }
  ]
};

// src/utils/matchSimulation.util.ts
var HOME_ADVANTAGE = 1.12;
var BASE_EXPECTED_GOALS = 1.35;
var STRENGTH_BASELINE = 52;
var ALT_POSITION_PENALTY = 0.88;
var PENALTY_GOAL_RATE = 0.18;
function poissonRandom(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}
function weightedPick(items, weightFn) {
  const weights = items.map(weightFn);
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return items[i];
  }
  return items[items.length - 1];
}
function topN(arr, n, scoreFn) {
  return [...arr].sort((a, b) => scoreFn(b) - scoreFn(a)).slice(0, n);
}
function parseFormationCounts(formation) {
  const baseName = formation.split(" ")[0];
  const parts = baseName.split("-").map(Number);
  if (parts.every((n) => !isNaN(n))) {
    if (parts.length === 3) {
      return { GK: 1, DEF: parts[0], MID: parts[1], FWD: parts[2] };
    }
    if (parts.length === 4) {
      return { GK: 1, DEF: parts[0], MID: parts[1] + parts[2], FWD: parts[3] };
    }
  }
  return { GK: 1, DEF: 4, MID: 4, FWD: 2 };
}
function positionToGroup(pos) {
  if (pos === "GK") return "GK";
  if (pos === "CB" || pos === "LB" || pos === "RB") return "DEF";
  if (pos === "CDM" || pos === "CM" || pos === "CAM") return "MID";
  return "FWD";
}
function selectBestXI(players, formation = "4-4-2") {
  return selectBestXITagged(players, formation).map((t) => t.player);
}
function selectBestXIWithSlots(players, formation = "4-4-2") {
  const tagged = selectBestXITagged(players, formation);
  const formationKey = formation in FORMATIONS ? formation : "4-4-2";
  const slots = FORMATIONS[formationKey];
  return tagged.map((t, i) => ({
    player: t.player,
    slotLabel: slots[i]?.label ?? t.player.positionGroup
  }));
}
var ALL_FORMATIONS = [
  "4-4-2",
  "4-3-3",
  "4-2-3-1",
  "3-5-2",
  "5-3-2",
  "4-5-1",
  "4-3-2-1",
  "4-4-1-1",
  "3-4-3",
  "4-1-4-1",
  "4-3-3 hold",
  "4-2-3-1 wide"
];
function detectBestFormation(players) {
  if (players.length === 0) return "4-4-2";
  let best = "4-4-2";
  let bestScore = -1;
  for (const f of ALL_FORMATIONS) {
    const score = calculateTeamStrengthScore(players, f).overall;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}
function selectBestXITagged(players, formation = "4-4-2") {
  const counts = parseFormationCounts(formation);
  const selected = [];
  const usedIds = /* @__PURE__ */ new Set();
  const pickGroup = (group, needed, scoreFn) => {
    const primary = players.filter((p) => p.positionGroup === group && !usedIds.has(String(p._id))).sort((a, b) => scoreFn(b) - scoreFn(a)).slice(0, needed);
    primary.forEach((p) => {
      selected.push({ player: p, isAltPosition: false });
      usedIds.add(String(p._id));
    });
    let remaining = needed - primary.length;
    if (remaining <= 0) return;
    const altCandidates = players.filter((p) => !usedIds.has(String(p._id)) && p.altPositions?.some((ap) => positionToGroup(ap) === group)).sort((a, b) => scoreFn(b) - scoreFn(a)).slice(0, remaining);
    altCandidates.forEach((p) => {
      selected.push({ player: p, isAltPosition: true });
      usedIds.add(String(p._id));
    });
    remaining -= altCandidates.length;
    if (remaining <= 0) return;
    const fallbacks = players.filter((p) => !usedIds.has(String(p._id))).sort((a, b) => b.stats.overall - a.stats.overall).slice(0, remaining);
    fallbacks.forEach((p) => {
      selected.push({ player: p, isAltPosition: true });
      usedIds.add(String(p._id));
    });
  };
  pickGroup("GK", counts.GK, (p) => p.stats.overall);
  pickGroup("DEF", counts.DEF, (p) => p.stats.defending * 0.7 + p.stats.overall * 0.3);
  pickGroup("MID", counts.MID, (p) => p.stats.passing * 0.35 + p.stats.overall * 0.5 + p.stats.shooting * 0.15);
  pickGroup("FWD", counts.FWD, (p) => p.stats.shooting * 0.6 + p.stats.dribbling * 0.2 + p.stats.overall * 0.2);
  if (selected.length < 11) {
    players.filter((p) => !usedIds.has(String(p._id))).sort((a, b) => b.stats.overall - a.stats.overall).slice(0, 11 - selected.length).forEach((p) => {
      selected.push({ player: p, isAltPosition: true });
      usedIds.add(String(p._id));
    });
  }
  return selected.slice(0, 11);
}
function calculateTeamStrengthScore(players, formation = "4-4-2") {
  if (players.length === 0) return { attack: 72, midfield: 72, defence: 72, overall: 72 };
  const tagged = players.length <= 11 ? players.map((p) => ({ player: p, isAltPosition: false })) : selectBestXITagged(players, formation);
  const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 72;
  const pen = (tagged2, val) => tagged2.isAltPosition ? val * ALT_POSITION_PENALTY : val;
  const gkTagged = tagged.filter((t) => t.player.positionGroup === "GK");
  tagged.filter((t) => t.player.positionGroup === "DEF" || t.isAltPosition && t.player.altPositions?.some((p) => positionToGroup(p) === "DEF"));
  tagged.filter((t) => t.player.positionGroup === "MID" || t.isAltPosition && t.player.altPositions?.some((p) => positionToGroup(p) === "MID"));
  tagged.filter((t) => t.player.positionGroup === "FWD" || t.isAltPosition && t.player.altPositions?.some((p) => positionToGroup(p) === "FWD"));
  const gks = tagged.filter((t) => gkTagged.some((g) => String(g.player._id) === String(t.player._id)));
  const defs = tagged.filter((t) => !gks.includes(t) && (t.player.positionGroup === "DEF" || t.isAltPosition));
  const mids = tagged.filter((t) => !gks.includes(t) && !defs.includes(t) && t.player.positionGroup === "MID");
  tagged.filter((t) => !gks.includes(t) && !defs.includes(t) && !mids.includes(t));
  const counts = parseFormationCounts(formation);
  const slots = [[], [], [], []];
  const groupOrder = ["GK", "DEF", "MID", "FWD"];
  let idx = 0;
  for (let g = 0; g < 4; g++) {
    for (let s = 0; s < counts[groupOrder[g]]; s++) {
      if (tagged[idx]) slots[g].push(tagged[idx++]);
    }
  }
  while (idx < tagged.length) slots[3].push(tagged[idx++]);
  const gkSlots = slots[0];
  const defSlots = slots[1];
  const midSlots = slots[2];
  const fwdSlots = slots[3];
  const fwdAttack = avg(fwdSlots.map((t) => pen(t, t.player.stats.shooting * 0.6 + t.player.stats.pace * 0.2 + t.player.stats.dribbling * 0.2)));
  const midAttack = avg(midSlots.map((t) => pen(t, t.player.stats.shooting * 0.3 + t.player.stats.passing * 0.4 + t.player.stats.overall * 0.3)));
  const attack = fwdSlots.length > 0 ? Math.max(40, fwdAttack * 0.65 + midAttack * 0.35) : Math.max(40, midAttack);
  const midfield = Math.max(40, avg(midSlots.map((t) => pen(t, t.player.stats.passing * 0.4 + t.player.stats.dribbling * 0.25 + t.player.stats.overall * 0.35))));
  const defRating = avg(defSlots.map((t) => pen(t, t.player.stats.defending * 0.7 + t.player.stats.overall * 0.3)));
  const midDef = avg(midSlots.map((t) => pen(t, t.player.stats.defending * 0.5 + t.player.stats.overall * 0.5)));
  const gkRating = gkSlots.length > 0 ? gkSlots[0].player.stats.overall : 72;
  const defence = defSlots.length > 0 ? Math.max(40, defRating * 0.65 + midDef * 0.15 + gkRating * 0.2) : Math.max(40, midDef * 0.5 + gkRating * 0.5);
  const overall = Math.round((attack + midfield + defence) / 3);
  return {
    attack: Math.round(attack),
    midfield: Math.round(midfield),
    defence: Math.round(defence),
    overall
  };
}
function teamStrength(players, formation = "4-4-2") {
  const score = calculateTeamStrengthScore(players, formation);
  return { attack: score.attack, defense: score.defence };
}
function simulateMatch(homeTeamName, awayTeamName, homePlayers, awayPlayers, homeFormation = "4-4-2", awayFormation = "4-4-2", homeFullSquad, awayFullSquad) {
  const homeStrength = teamStrength(homePlayers, homeFormation);
  const awayStrength = teamStrength(awayPlayers, awayFormation);
  const effHomeAtk = Math.max(homeStrength.attack - STRENGTH_BASELINE, 5);
  const effAwayDef = Math.max(awayStrength.defense - STRENGTH_BASELINE, 5);
  const effAwayAtk = Math.max(awayStrength.attack - STRENGTH_BASELINE, 5);
  const effHomeDef = Math.max(homeStrength.defense - STRENGTH_BASELINE, 5);
  const homePerf = 0.87 + Math.random() * 0.26;
  const awayPerf = 0.87 + Math.random() * 0.26;
  const homeLambda = effHomeAtk / effAwayDef * HOME_ADVANTAGE * BASE_EXPECTED_GOALS * homePerf;
  const awayLambda = effAwayAtk / effHomeDef * BASE_EXPECTED_GOALS * awayPerf;
  const homeScore = poissonRandom(Math.max(0.25, Math.min(homeLambda, 5.5)));
  const awayScore = poissonRandom(Math.max(0.15, Math.min(awayLambda, 4.5)));
  const homeXI = homePlayers.length <= 11 ? homePlayers : selectBestXI(homePlayers, homeFormation);
  const awayXI = awayPlayers.length <= 11 ? awayPlayers : selectBestXI(awayPlayers, awayFormation);
  const homeBench = homeFullSquad ?? homePlayers;
  const awayBench = awayFullSquad ?? awayPlayers;
  const goals = [];
  const cards = [];
  const substitutions = [];
  const homeAppearances = [];
  const awayAppearances = [];
  homeXI.forEach((p) => homeAppearances.push(p));
  awayXI.forEach((p) => awayAppearances.push(p));
  const homeSubbedOffMap = /* @__PURE__ */ new Map();
  const awaySubbedOffMap = /* @__PURE__ */ new Map();
  const simulateSubstitutions = (teamName, xi, fullSquad, appearances, subbedOffMap) => {
    const bench = fullSquad.filter((p) => !xi.some((s) => String(s._id) === String(p._id)));
    if (bench.length === 0) return;
    const numSubs = 2 + Math.floor(Math.random() * 2);
    const xiPool = [...xi].filter((p) => p.positionGroup !== "GK");
    const usedBench = /* @__PURE__ */ new Set();
    const usedOff = /* @__PURE__ */ new Set();
    for (let i = 0; i < numSubs && bench.length > 0; i++) {
      const minute = 55 + Math.floor(Math.random() * 31);
      const offCandidates = xiPool.filter((p) => !usedOff.has(String(p._id)));
      if (offCandidates.length === 0) break;
      const playerOff = offCandidates[Math.floor(Math.random() * offCandidates.length)];
      usedOff.add(String(playerOff._id));
      const samePosGroup = bench.filter(
        (p) => p.positionGroup === playerOff.positionGroup && !usedBench.has(String(p._id))
      );
      const subPool = samePosGroup.length > 0 ? samePosGroup : bench.filter((p) => !usedBench.has(String(p._id)));
      if (subPool.length === 0) break;
      const playerOn = topN(subPool, 1, (p) => p.stats.overall)[0];
      usedBench.add(String(playerOn._id));
      subbedOffMap.set(playerOff.apiId, minute);
      substitutions.push({
        playerOffName: playerOff.shortName,
        playerOffApiId: playerOff.apiId,
        playerOnName: playerOn.shortName,
        playerOnApiId: playerOn.apiId,
        team: teamName,
        minute
      });
      if (!appearances.some((p) => String(p._id) === String(playerOn._id))) {
        appearances.push(playerOn);
      }
    }
  };
  simulateSubstitutions(homeTeamName, homeXI, homeBench, homeAppearances, homeSubbedOffMap);
  simulateSubstitutions(awayTeamName, awayXI, awayBench, awayAppearances, awaySubbedOffMap);
  const assignGoalsForTeam = (teamName, numGoals, xi, subbedOffMap) => {
    const scoringCandidates = xi.filter((p) => p.positionGroup !== "GK");
    if (scoringCandidates.length === 0) return;
    const goalMinutes = /* @__PURE__ */ new Set();
    for (let i = 0; i < numGoals; i++) {
      let minute;
      do {
        minute = Math.random() < 0.7 ? 45 + Math.floor(Math.random() * 46) : 1 + Math.floor(Math.random() * 44);
      } while (goalMinutes.has(minute) && goalMinutes.size < 90);
      goalMinutes.add(minute);
    }
    const sortedMinutes = Array.from(goalMinutes).sort((a, b) => a - b);
    for (let i = 0; i < numGoals; i++) {
      const goalMinute = sortedMinutes[i];
      const isPenalty = Math.random() < PENALTY_GOAL_RATE;
      const availableScorers = scoringCandidates.filter(
        (p) => !subbedOffMap.has(p.apiId) || subbedOffMap.get(p.apiId) > goalMinute
      );
      if (availableScorers.length === 0) continue;
      let scorer;
      if (isPenalty) {
        const penaltyCandidates = availableScorers.filter(
          (p) => p.positionGroup === "FWD" || p.position === "CAM"
        );
        const pool = penaltyCandidates.length > 0 ? penaltyCandidates : availableScorers;
        scorer = weightedPick(pool, (p) => p.stats.shooting / 100);
      } else {
        scorer = weightedPick(availableScorers, (p) => {
          const posWeight = p.positionGroup === "FWD" ? 5 : p.positionGroup === "MID" ? 2 : 0.5;
          return p.stats.shooting / 100 * posWeight;
        });
      }
      const availableAssisters = scoringCandidates.filter(
        (p) => p.apiId !== scorer.apiId && (!subbedOffMap.has(p.apiId) || subbedOffMap.get(p.apiId) > goalMinute)
      );
      let assister;
      const assistChance = isPenalty ? 0.01 : 0.75;
      if (availableAssisters.length > 0 && Math.random() < assistChance) {
        assister = weightedPick(availableAssisters, (p) => p.stats.passing / 100);
      }
      goals.push({
        scorerName: scorer.shortName,
        scorerApiId: scorer.apiId,
        assisterName: assister?.shortName,
        assisterApiId: assister?.apiId,
        team: teamName,
        isPenalty,
        minute: goalMinute
      });
    }
  };
  assignGoalsForTeam(homeTeamName, homeScore, homeXI, homeSubbedOffMap);
  assignGoalsForTeam(awayTeamName, awayScore, awayXI, awaySubbedOffMap);
  const assignCardsForTeam = (teamName, xi) => {
    xi.forEach((p) => {
      const yellowProb = 0.05 + p.stats.physical / 100 * 0.06;
      if (Math.random() < yellowProb) {
        cards.push({ playerName: p.name, playerApiId: p.apiId, team: teamName, type: "yellow" });
        if (Math.random() < 0.04) {
          cards.push({ playerName: p.name, playerApiId: p.apiId, team: teamName, type: "red" });
        }
      }
    });
  };
  assignCardsForTeam(homeTeamName, homeXI);
  assignCardsForTeam(awayTeamName, awayXI);
  return {
    homeScore,
    awayScore,
    result: {
      homeScore,
      awayScore,
      goals,
      cards,
      substitutions,
      homeAppearances: homeAppearances.map((p) => ({
        playerApiId: p.apiId,
        playerName: p.shortName,
        club: homeTeamName,
        position: p.position,
        positionGroup: p.positionGroup
      })),
      awayAppearances: awayAppearances.map((p) => ({
        playerApiId: p.apiId,
        playerName: p.shortName,
        club: awayTeamName,
        position: p.position,
        positionGroup: p.positionGroup
      }))
    },
    homeAppearances,
    awayAppearances
  };
}

// src/controllers/season.controller.ts
function applyResult(standings, homeTeam, awayTeam, homeScore, awayScore) {
  const homeEntry = standings.find((s) => s.team === homeTeam);
  const awayEntry = standings.find((s) => s.team === awayTeam);
  if (!homeEntry || !awayEntry) return;
  homeEntry.played++;
  awayEntry.played++;
  homeEntry.gf += homeScore;
  homeEntry.ga += awayScore;
  homeEntry.gd = homeEntry.gf - homeEntry.ga;
  awayEntry.gf += awayScore;
  awayEntry.ga += homeScore;
  awayEntry.gd = awayEntry.gf - awayEntry.ga;
  if (homeScore > awayScore) {
    homeEntry.won++;
    homeEntry.points += 3;
    awayEntry.lost++;
  } else if (awayScore > homeScore) {
    awayEntry.won++;
    awayEntry.points += 3;
    homeEntry.lost++;
  } else {
    homeEntry.drawn++;
    homeEntry.points++;
    awayEntry.drawn++;
    awayEntry.points++;
  }
}
function getOrCreateStatEntry(statsArr, player, club) {
  let entry = statsArr.find((s) => s.playerApiId === player.apiId && s.club === club);
  if (!entry) {
    entry = {
      playerId: player._id.toString(),
      playerApiId: player.apiId,
      playerName: player.shortName,
      club,
      clubApiId: player.clubApiId,
      appearances: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0
    };
    statsArr.push(entry);
  }
  return entry;
}
function cloneBlankStat(player) {
  return {
    playerId: player._id.toString(),
    playerApiId: player.apiId,
    playerName: player.shortName,
    club: player.club,
    clubApiId: player.clubApiId,
    appearances: 0,
    goals: 0,
    assists: 0,
    cleanSheets: 0,
    yellowCards: 0,
    redCards: 0
  };
}
function aggregatePlayerTotals(stats) {
  const totals = /* @__PURE__ */ new Map();
  for (const stat of stats) {
    const existing = totals.get(stat.playerApiId);
    if (!existing) {
      totals.set(stat.playerApiId, { ...stat });
      continue;
    }
    const shouldReplaceIdentity = stat.appearances >= existing.appearances;
    existing.appearances += stat.appearances;
    existing.goals += stat.goals;
    existing.assists += stat.assists;
    existing.cleanSheets += stat.cleanSheets;
    existing.yellowCards += stat.yellowCards;
    existing.redCards += stat.redCards;
    if (shouldReplaceIdentity) {
      existing.playerId = stat.playerId;
      existing.playerName = stat.playerName;
      existing.club = stat.club;
      existing.clubApiId = stat.clubApiId;
    }
  }
  return [...totals.values()].sort(
    (a, b) => b.appearances - a.appearances || b.goals - a.goals || b.assists - a.assists || a.playerName.localeCompare(b.playerName)
  );
}
function groupStatsByClub(stats) {
  const clubMap = /* @__PURE__ */ new Map();
  for (const stat of stats) {
    const clubStats = clubMap.get(stat.club) ?? [];
    clubStats.push(stat);
    clubMap.set(stat.club, clubStats);
  }
  return [...clubMap.entries()].map(([club, players]) => ({
    club,
    players: players.sort(
      (a, b) => b.appearances - a.appearances || b.goals - a.goals || b.assists - a.assists || a.playerName.localeCompare(b.playerName)
    )
  })).sort((a, b) => a.club.localeCompare(b.club));
}
async function getAISquad(clubName, session) {
  const aiSquads = session.aiSquads;
  if (aiSquads) {
    const ids = aiSquads.get(clubName);
    if (ids && ids.length > 0) {
      return Player.find({ _id: { $in: ids } }).sort({ "stats.overall": -1 }).limit(20);
    }
  }
  return Player.find({ club: clubName }).sort({ "stats.overall": -1 }).limit(20);
}
function getUserMatchPlayers(session) {
  const squad = session.squad;
  const xi = session.startingXI;
  if (xi && xi.length > 0) {
    const xiPlayers = xi.map((slot) => slot.playerId).filter((p) => p && typeof p === "object" && "stats" in p);
    if (xiPlayers.length === 11) return xiPlayers;
    if (xiPlayers.length >= 7) {
      const filledIds = new Set(xiPlayers.map((p) => String(p._id)));
      const available = squad.filter((p) => !filledIds.has(String(p._id)));
      const result = [...xiPlayers];
      const emptySlots = xi.filter(
        (slot) => !(slot.playerId && typeof slot.playerId === "object" && "stats" in slot.playerId)
      );
      for (const slot of emptySlots) {
        const group = slot.positionGroup;
        const best = available.filter((p) => p.positionGroup === group).sort((a, b) => b.stats.overall - a.stats.overall)[0] ?? available.sort((a, b) => b.stats.overall - a.stats.overall)[0];
        if (best) {
          result.push(best);
          available.splice(available.indexOf(best), 1);
        }
      }
      if (result.length === 11) return result;
    }
  }
  return selectBestXI(squad, session.formation || "4-4-2");
}
function getUserFullSquad(session) {
  return session.squad;
}
async function simulateGameweek(req, res) {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId }).populate("squad").populate("startingXI.playerId");
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  if (session.phase !== "season") {
    res.status(409).json({ error: "Season is not currently in progress" });
    return;
  }
  const nextGW = session.currentGameweek + 1;
  if (nextGW > 38) {
    res.status(409).json({ error: "All 38 gameweeks have been simulated" });
    return;
  }
  const gwFixtures = session.fixtures.filter((f) => f.gameweek === nextGW && !f.result);
  if (gwFixtures.length === 0) {
    res.status(409).json({ error: `No unplayed fixtures found for GW${nextGW}` });
    return;
  }
  const userMatchPlayers = getUserMatchPlayers(session);
  const userFullSquad = getUserFullSquad(session);
  const userFormation = session.formation || "4-4-2";
  const matchResults = [];
  for (const fixture of gwFixtures) {
    const isUserHome = fixture.homeTeam === session.userTeam;
    const isUserAway = fixture.awayTeam === session.userTeam;
    const homePlayers = isUserHome ? userMatchPlayers : await getAISquad(fixture.homeTeam, session);
    const awayPlayers = isUserAway ? userMatchPlayers : await getAISquad(fixture.awayTeam, session);
    const homeFullSquad = isUserHome ? userFullSquad : void 0;
    const awayFullSquad = isUserAway ? userFullSquad : void 0;
    const homeFormation = isUserHome ? userFormation : detectBestFormation(homePlayers);
    const awayFormation = isUserAway ? userFormation : detectBestFormation(awayPlayers);
    const sim = simulateMatch(
      fixture.homeTeam,
      fixture.awayTeam,
      homePlayers,
      awayPlayers,
      homeFormation,
      awayFormation,
      homeFullSquad,
      awayFullSquad
    );
    fixture.result = sim.result;
    applyResult(
      session.standings,
      fixture.homeTeam,
      fixture.awayTeam,
      sim.homeScore,
      sim.awayScore
    );
    const statsArr = session.playerSeasonStats;
    sim.homeAppearances.forEach((p) => {
      getOrCreateStatEntry(statsArr, p, fixture.homeTeam).appearances++;
    });
    sim.awayAppearances.forEach((p) => {
      getOrCreateStatEntry(statsArr, p, fixture.awayTeam).appearances++;
    });
    sim.result.goals.forEach((goal) => {
      const allAppearances = [...sim.homeAppearances, ...sim.awayAppearances];
      const scorer = allAppearances.find((p) => p.apiId === goal.scorerApiId);
      if (scorer) getOrCreateStatEntry(statsArr, scorer, goal.team).goals++;
      if (goal.assisterApiId) {
        const assister = allAppearances.find((p) => p.apiId === goal.assisterApiId);
        if (assister) getOrCreateStatEntry(statsArr, assister, goal.team).assists++;
      }
    });
    sim.result.cards.forEach((card) => {
      const allAppearances = [...sim.homeAppearances, ...sim.awayAppearances];
      const player = allAppearances.find((p) => p.apiId === card.playerApiId);
      if (player) {
        const entry = getOrCreateStatEntry(statsArr, player, card.team);
        if (card.type === "yellow") entry.yellowCards++;
        else entry.redCards++;
      }
    });
    const homeXI = sim.homeAppearances.slice(0, 11);
    const awayXI = sim.awayAppearances.slice(0, 11);
    if (sim.homeScore === 0) {
      awayXI.filter((p) => p.positionGroup === "GK" || p.positionGroup === "DEF").forEach((p) => {
        getOrCreateStatEntry(statsArr, p, fixture.awayTeam).cleanSheets++;
      });
    }
    if (sim.awayScore === 0) {
      homeXI.filter((p) => p.positionGroup === "GK" || p.positionGroup === "DEF").forEach((p) => {
        getOrCreateStatEntry(statsArr, p, fixture.homeTeam).cleanSheets++;
      });
    }
    matchResults.push({
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      homeScore: sim.homeScore,
      awayScore: sim.awayScore,
      goals: sim.result.goals,
      substitutions: sim.result.substitutions
    });
  }
  session.currentGameweek = nextGW;
  if (nextGW === 19) {
    session.phase = "january_transfer";
  } else if (nextGW === 38) {
    session.phase = "season_end";
  }
  session.standings.sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf
  );
  session.markModified("fixtures");
  session.markModified("standings");
  session.markModified("playerSeasonStats");
  await session.save();
  res.json({
    gameweek: nextGW,
    phase: session.phase,
    matches: matchResults,
    userStanding: session.standings.findIndex(
      (s) => s.team === session.userTeam
    ) + 1
  });
}
async function simulateAll(req, res) {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId }).populate("squad").populate("startingXI.playerId");
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  if (session.phase !== "season") {
    res.status(409).json({ error: "Season is not currently in progress" });
    return;
  }
  const startGW = session.currentGameweek + 1;
  const endGW = 38;
  if (startGW > endGW) {
    res.status(409).json({ error: "All gameweeks already simulated" });
    return;
  }
  const userMatchPlayers = getUserMatchPlayers(session);
  const userFullSquad = getUserFullSquad(session);
  const userFormation = session.formation || "4-4-2";
  for (let gw = startGW; gw <= endGW; gw++) {
    const gwFixtures = session.fixtures.filter((f) => f.gameweek === gw && !f.result);
    for (const fixture of gwFixtures) {
      const isUserHome = fixture.homeTeam === session.userTeam;
      const isUserAway = fixture.awayTeam === session.userTeam;
      const homePlayers = isUserHome ? userMatchPlayers : await getAISquad(fixture.homeTeam, session);
      const awayPlayers = isUserAway ? userMatchPlayers : await getAISquad(fixture.awayTeam, session);
      const homeFullSquad = isUserHome ? userFullSquad : void 0;
      const awayFullSquad = isUserAway ? userFullSquad : void 0;
      const homeFormation = isUserHome ? userFormation : detectBestFormation(homePlayers);
      const awayFormation = isUserAway ? userFormation : detectBestFormation(awayPlayers);
      const sim = simulateMatch(
        fixture.homeTeam,
        fixture.awayTeam,
        homePlayers,
        awayPlayers,
        homeFormation,
        awayFormation,
        homeFullSquad,
        awayFullSquad
      );
      fixture.result = sim.result;
      applyResult(
        session.standings,
        fixture.homeTeam,
        fixture.awayTeam,
        sim.homeScore,
        sim.awayScore
      );
      const statsArr = session.playerSeasonStats;
      sim.homeAppearances.forEach((p) => {
        getOrCreateStatEntry(statsArr, p, fixture.homeTeam).appearances++;
      });
      sim.awayAppearances.forEach((p) => {
        getOrCreateStatEntry(statsArr, p, fixture.awayTeam).appearances++;
      });
      sim.result.goals.forEach((goal) => {
        const allAppearances = [...sim.homeAppearances, ...sim.awayAppearances];
        const scorer = allAppearances.find((p) => p.apiId === goal.scorerApiId);
        if (scorer) getOrCreateStatEntry(statsArr, scorer, goal.team).goals++;
        if (goal.assisterApiId) {
          const assister = allAppearances.find((p) => p.apiId === goal.assisterApiId);
          if (assister) getOrCreateStatEntry(statsArr, assister, goal.team).assists++;
        }
      });
      sim.result.cards.forEach((card) => {
        const allAppearances = [...sim.homeAppearances, ...sim.awayAppearances];
        const p = allAppearances.find((pl) => pl.apiId === card.playerApiId);
        if (p) {
          const entry = getOrCreateStatEntry(statsArr, p, card.team);
          if (card.type === "yellow") entry.yellowCards++;
          else entry.redCards++;
        }
      });
      const homeXI = sim.homeAppearances.slice(0, 11);
      const awayXI = sim.awayAppearances.slice(0, 11);
      if (sim.homeScore === 0) {
        awayXI.filter((p) => p.positionGroup === "GK" || p.positionGroup === "DEF").forEach((p) => {
          getOrCreateStatEntry(statsArr, p, fixture.awayTeam).cleanSheets++;
        });
      }
      if (sim.awayScore === 0) {
        homeXI.filter((p) => p.positionGroup === "GK" || p.positionGroup === "DEF").forEach((p) => {
          getOrCreateStatEntry(statsArr, p, fixture.homeTeam).cleanSheets++;
        });
      }
    }
    session.currentGameweek = gw;
    if (gw === 19 && session.phase === "season") {
      session.phase = "january_transfer";
      break;
    }
  }
  if (session.currentGameweek === 38) {
    session.phase = "season_end";
  }
  session.standings.sort(
    (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf
  );
  session.markModified("fixtures");
  session.markModified("standings");
  session.markModified("playerSeasonStats");
  await session.save();
  res.json({
    simulatedUpTo: session.currentGameweek,
    phase: session.phase,
    message: session.phase === "january_transfer" ? "Simulated up to GW19. January transfer window is now open." : "Season complete!"
  });
}
async function getStandings(req, res) {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId }).select("standings userTeam currentGameweek phase").lean();
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  res.json({
    standings: session.standings,
    userTeam: session.userTeam,
    currentGameweek: session.currentGameweek,
    phase: session.phase
  });
}
async function getSeasonStats(req, res) {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId }).select("playerSeasonStats userTeam currentGameweek squad userTeamApiId").populate("squad").lean();
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  const stats = session.playerSeasonStats;
  const playerTotals = aggregatePlayerTotals(stats);
  const statsByPlayerApiId = /* @__PURE__ */ new Map();
  for (const stat of playerTotals) {
    statsByPlayerApiId.set(stat.playerApiId, stat);
  }
  const squadPlayers = session.squad ?? [];
  for (const player of squadPlayers) {
    if (!statsByPlayerApiId.has(player.apiId)) {
      const blankStat = cloneBlankStat(player);
      statsByPlayerApiId.set(player.apiId, blankStat);
      playerTotals.push(blankStat);
    }
  }
  [...playerTotals].sort((a, b) => b.goals - a.goals || b.appearances - a.appearances).slice(0, 10);
  [...playerTotals].sort((a, b) => b.assists - a.assists || b.appearances - a.appearances).slice(0, 10);
  [...playerTotals].filter((s) => s.cleanSheets > 0).sort((a, b) => b.cleanSheets - a.cleanSheets).slice(0, 5);
  const allPlayers = await Player.find({ league: "Premier League" }).select("_id apiId shortName club clubApiId").lean();
  const plClubNames = new Set(allPlayers.map((player) => player.club));
  plClubNames.add(session.userTeam ?? "");
  const squadPlayerIds = new Set(squadPlayers.map((player) => player.apiId));
  const visiblePlayerStats = [];
  for (const stat of playerTotals) {
    if (plClubNames.has(stat.club) && !squadPlayerIds.has(stat.playerApiId)) {
      visiblePlayerStats.push(stat);
    }
  }
  for (const player of squadPlayers) {
    const seeded = statsByPlayerApiId.get(player.apiId) ?? cloneBlankStat(player);
    visiblePlayerStats.push({
      ...seeded,
      club: session.userTeam,
      clubApiId: session.userTeamApiId ?? seeded.clubApiId
    });
  }
  const clubStats = groupStatsByClub(visiblePlayerStats).filter((entry) => plClubNames.has(entry.club));
  const visibleTotals = visiblePlayerStats.filter((stat) => plClubNames.has(stat.club) || squadPlayerIds.has(stat.playerApiId));
  res.json({
    topScorers: [...visibleTotals].sort((a, b) => b.goals - a.goals || b.appearances - a.appearances).slice(0, 10),
    topAssists: [...visibleTotals].sort((a, b) => b.assists - a.assists || b.appearances - a.appearances).slice(0, 10),
    topCleanSheets: [...visibleTotals].filter((s) => s.cleanSheets > 0).sort((a, b) => b.cleanSheets - a.cleanSheets).slice(0, 5),
    playerStats: visibleTotals,
    clubStats,
    userTeam: session.userTeam,
    currentGameweek: session.currentGameweek
  });
}
async function getTeamsSquads(req, res) {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId }).populate("squad").populate("startingXI.playerId").select("userTeam userTeamApiId aiSquads squad formation startingXI phase");
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  const plClubs = await Club.find({ isPL: true }).lean();
  const teams = await Promise.all(
    plClubs.map(async (club) => {
      const isUserClub = club.name === session.userTeam;
      let squad;
      if (isUserClub) {
        squad = session.squad;
      } else {
        squad = await getAISquad(club.name, session);
      }
      const formation = isUserClub ? session.formation || "4-4-2" : detectBestFormation(squad);
      let xiPlayers = null;
      if (isUserClub) {
        const xi = session.startingXI;
        if (xi && xi.length > 0) {
          const filled = xi.filter((s) => s.playerId && typeof s.playerId === "object" && "stats" in s.playerId);
          if (filled.length === 11) {
            xiPlayers = filled.map((s) => s.playerId);
          }
        }
      }
      const strengthScore = calculateTeamStrengthScore(xiPlayers ?? squad, formation);
      let lineupPlayers;
      if (isUserClub && xiPlayers) {
        const xi = session.startingXI;
        lineupPlayers = xi.filter((s) => s.playerId && typeof s.playerId === "object" && "stats" in s.playerId).map((s) => ({
          name: s.playerId.shortName,
          position: s.playerId.position,
          positionGroup: s.playerId.positionGroup,
          overall: s.playerId.stats.overall,
          slotLabel: s.label,
          photoUrl: s.playerId.photoUrl
        }));
      } else {
        lineupPlayers = selectBestXIWithSlots(squad, formation).map(({ player: p, slotLabel }) => ({
          name: p.shortName,
          position: p.position,
          positionGroup: p.positionGroup,
          overall: p.stats.overall,
          slotLabel,
          photoUrl: p.photoUrl
        }));
      }
      return {
        clubName: club.name,
        clubApiId: club.apiId,
        logoUrl: club.logoUrl ?? "",
        isUserClub,
        promoted: club.promoted ?? false,
        strengthScore,
        formation,
        lineupSaved: isUserClub && !!xiPlayers,
        bestXI: lineupPlayers,
        squadSize: squad.length
      };
    })
  );
  teams.sort((a, b) => {
    if (a.isUserClub) return -1;
    if (b.isUserClub) return 1;
    return b.strengthScore.overall - a.strengthScore.overall;
  });
  res.json({ teams, userTeam: session.userTeam, phase: session.phase });
}

// src/routers/season.router.ts
var router4 = express.Router();
router4.post("/:sessionId/simulate", simulateGameweek);
router4.post("/:sessionId/simulate-all", simulateAll);
router4.get("/:sessionId/standings", getStandings);
router4.get("/:sessionId/stats", getSeasonStats);
router4.get("/:sessionId/teams", getTeamsSquads);
var season_router_default = router4;

// src/controllers/club.controller.ts
async function getClubs(_req, res) {
  const clubs = await Club.find({ isPL: true }).select("name shortName reputation lastSeasonFinish budgetRange promoted").sort({ lastSeasonFinish: 1 }).lean();
  res.json({ clubs });
}

// src/routers/club.router.ts
var router5 = express.Router();
router5.get("/", getClubs);
var club_router_default = router5;
var VALID_FORMATIONS = Object.keys(FORMATIONS);
function positionToGroup2(pos) {
  if (pos === "GK") return "GK";
  if (pos === "CB" || pos === "LB" || pos === "RB") return "DEF";
  if (pos === "CDM" || pos === "CM" || pos === "CAM") return "MID";
  return "FWD";
}
function canPlayInSlot(player, slotGroup) {
  if (player.positionGroup === slotGroup) return { allowed: true, isAltPosition: false };
  const hasAlt = (player.altPositions ?? []).some((ap) => positionToGroup2(ap) === slotGroup);
  return { allowed: hasAlt, isAltPosition: hasAlt };
}
async function getLineup(req, res) {
  const session = await GameSession.findOne({ sessionId: req.params.sessionId }).populate("startingXI.playerId").select("formation startingXI userTeam phase");
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  const formation = session.formation || "4-4-2";
  const slotDefs = FORMATIONS[formation] ?? FORMATIONS["4-4-2"];
  const startingXI = slotDefs.map((def) => {
    const saved = session.startingXI.find((s) => s.slotId === def.slotId);
    const player = saved?.playerId && typeof saved.playerId === "object" ? saved.playerId : null;
    return {
      slotId: def.slotId,
      label: def.label,
      positionGroup: def.positionGroup,
      player,
      isAltPosition: saved?.isAltPosition ?? false
    };
  });
  res.json({ formation, startingXI });
}
async function saveLineup(req, res) {
  const { formation, slots } = req.body;
  if (!formation || !VALID_FORMATIONS.includes(formation)) {
    res.status(400).json({ error: `Invalid formation. Must be one of: ${VALID_FORMATIONS.join(", ")}` });
    return;
  }
  const session = await GameSession.findOne({ sessionId: req.params.sessionId }).populate("squad");
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }
  const squadIds = new Set(
    session.squad.map((p) => String(p._id ?? p))
  );
  const slotDefs = FORMATIONS[formation];
  if (!slots || !Array.isArray(slots)) {
    res.status(400).json({ error: "slots must be an array" });
    return;
  }
  const assignedPlayerIds = slots.map((s) => s.playerId).filter((id) => !!id);
  const uniqueAssigned = new Set(assignedPlayerIds);
  if (uniqueAssigned.size !== assignedPlayerIds.length) {
    res.status(400).json({ error: "A player cannot be assigned to more than one slot" });
    return;
  }
  for (const playerId of assignedPlayerIds) {
    if (!squadIds.has(playerId)) {
      res.status(400).json({ error: `Player ${playerId} is not in your squad` });
      return;
    }
  }
  const squadPlayers = session.squad;
  const playerMap = new Map(
    squadPlayers.map((p) => [String(p._id), p])
  );
  for (const slot of slots) {
    if (!slot.playerId) continue;
    const slotDef = slotDefs.find((d) => d.slotId === slot.slotId);
    if (!slotDef) continue;
    const player = playerMap.get(slot.playerId);
    if (!player) continue;
    const { allowed } = canPlayInSlot(player, slotDef.positionGroup);
    if (!allowed) {
      res.status(400).json({
        error: `${player.shortName} cannot play in the ${slotDef.label} slot (position: ${player.position}, alt positions: ${(player.altPositions ?? []).join(", ") || "none"})`
      });
      return;
    }
  }
  const startingXI = slotDefs.map((def) => {
    const provided = slots.find((s) => s.slotId === def.slotId);
    const player = provided?.playerId ? playerMap.get(provided.playerId) : void 0;
    const isAltPosition = player ? canPlayInSlot(player, def.positionGroup).isAltPosition : false;
    return {
      slotId: def.slotId,
      label: def.label,
      positionGroup: def.positionGroup,
      playerId: provided?.playerId ? new mongoose4.Types.ObjectId(provided.playerId) : null,
      isAltPosition
    };
  });
  session.formation = formation;
  session.startingXI = startingXI;
  session.markModified("startingXI");
  await session.save();
  res.json({ success: true, formation, slotsAssigned: assignedPlayerIds.length });
}

// src/routers/lineup.router.ts
var lineupRouter = express.Router({ mergeParams: true });
lineupRouter.get("/", getLineup);
lineupRouter.put("/", saveLineup);
var lineup_router_default = lineupRouter;

// src/api.router.ts
var apiRouter = express.Router();
apiRouter.use("/clubs", club_router_default);
apiRouter.use("/sessions", session_router_default);
apiRouter.use("/players", player_router_default);
apiRouter.use("/sessions", transfer_router_default);
apiRouter.use("/sessions", season_router_default);
apiRouter.use("/sessions/:sessionId/lineup", lineup_router_default);
var api_router_default = apiRouter;

// src/middleware/errorHandler.middleware.ts
var errorHandler = (err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong"
    // Hide details in production
  });
};

// src/app.ts
var app = express__default.default();
app.use(express__default.default.json());
app.use(cookieParser__default.default());
app.use(
  cors__default.default({
    origin: process.env.CLIENT_URL || "http://localhost:3001",
    // Allow requests only from configured client
    credentials: true,
    // Enable cookies and authorization headers
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
    maxAge: 86400
    // CORS preflight cache time (24 hour)
  })
);
app.use("/api", api_router_default);
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Football Simulator API" });
});
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});
app.use(errorHandler);
var app_default = app;
var connectToDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/football-simulator";
    await mongoose4__default.default.connect(mongoUri);
    console.log("\u{1F4E6} Connected to MongoDB database");
  } catch (error) {
    console.error("\u274C MongoDB connection error:", error);
    process.exit(1);
  }
};
var disconnectFromDatabase = async () => {
  try {
    await mongoose4__default.default.disconnect();
    console.log("\u{1F4E6} Disconnected from MongoDB database");
  } catch (error) {
    console.error("\u274C MongoDB disconnection error:", error);
    process.exit(1);
  }
};

// src/index.ts
dotenv__default.default.config();
var port = process.env.PORT || 8080;
app_default.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
connectToDatabase().then(() => {
  console.log("MongoDB connected successfully");
}).catch((err) => {
  console.error("MongoDB connection error:", err.message);
  console.log("Server running without database connection");
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Promise Rejection at:", promise, "reason:", reason);
});
process.on("SIGINT", async () => {
  console.log("Shutting down the app");
  disconnectFromDatabase();
  process.exit(0);
});
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map