'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import {
  api,
  Player,
  FormationName,
  LineupSlotData,
  LineupSlotSave,
  FORMATION_NAMES,
} from '@/lib/api';

/**
 * Maps each slot label to the player positions that are natively valid there.
 *
 * Primary: player.position is in this list   → shown without a badge.
 * Alt:     player has an altPosition in this list → shown with "ALT · <pos>" badge.
 * Note: 'LM' and 'RM' do not exist as Position types; LW/RW fill those slots natively.
 */
const SLOT_NATIVE_POSITIONS: Record<string, string[]> = {
  GK:  ['GK'],
  CB:  ['CB'],           // any defender can cover CB
  LB:  ['LB', 'RB'],
  RB:  ['RB', 'LB'],
  LWB: ['LB', 'LW'],          // wing-back: fullback, or winger
  RWB: ['RB', 'RW'],
  CDM: ['CDM', 'CM'],                 // holding mid accepts CM
  CM:  ['CM', 'CDM', 'CAM'],         // box-to-box mid
  CAM: ['CAM', 'CM'],
  LAM: ['CAM', 'LW', 'CM'],          // left attacking mid
  RAM: ['CAM', 'RW', 'CM'],
  LM:  ['LW'],          // wide mid — only LW (no LM Position type)
  RM:  ['RW'],          // wide mid — only RW (no RM Position type)
  LW:  ['LW'],
  RW:  ['RW'],
  SS:  ['CAM', 'ST', 'CF'],          // shadow striker
  ST:  ['ST', 'CF'],                 // strict: wingers excluded unless they have ST/CF as alt
  CF:  ['CF', 'ST'],
};

// ── Pitch coordinates (x%, y%) per slot per formation ────────────────────────
// y=0 is the attacking end (top of pitch), y=100 is the goalkeeper row
const FORMATION_COORDS: Record<FormationName, Record<string, { x: number; y: number }>> = {
  '4-4-2': {
    gk:  { x: 50, y: 88 },
    lb:  { x: 15, y: 70 }, cb1: { x: 37, y: 70 }, cb2: { x: 63, y: 70 }, rb: { x: 85, y: 70 },
    lm:  { x: 15, y: 48 }, cm1: { x: 37, y: 48 }, cm2: { x: 63, y: 48 }, rm: { x: 85, y: 48 },
    lst: { x: 35, y: 18 }, rst: { x: 65, y: 18 },
  },
  '4-3-3': {
    gk:  { x: 50, y: 88 },
    lb:  { x: 15, y: 70 }, cb1: { x: 37, y: 70 }, cb2: { x: 63, y: 70 }, rb: { x: 85, y: 70 },
    cm1: { x: 25, y: 50 }, cm2: { x: 50, y: 50 }, cam: { x: 75, y: 50 },
    lw:  { x: 15, y: 18 }, st:  { x: 50, y: 14 }, rw: { x: 85, y: 18 },
  },
  '4-2-3-1': {
    gk:   { x: 50, y: 88 },
    lb:   { x: 15, y: 72 }, cb1: { x: 37, y: 72 }, cb2: { x: 63, y: 72 }, rb: { x: 85, y: 72 },
    cdm1: { x: 35, y: 56 }, cdm2: { x: 65, y: 56 },
    lam:  { x: 18, y: 36 }, cam: { x: 50, y: 34 }, ram: { x: 82, y: 36 },
    st:   { x: 50, y: 14 },
  },
  '3-5-2': {
    gk:  { x: 50, y: 88 },
    cb1: { x: 25, y: 70 }, cb2: { x: 50, y: 70 }, cb3: { x: 75, y: 70 },
    lwb: { x: 10, y: 50 }, cm1: { x: 30, y: 50 }, cm2: { x: 50, y: 50 }, cm3: { x: 70, y: 50 }, rwb: { x: 90, y: 50 },
    lst: { x: 35, y: 18 }, rst: { x: 65, y: 18 },
  },
  '5-3-2': {
    gk:  { x: 50, y: 88 },
    lwb: { x: 10, y: 70 }, cb1: { x: 28, y: 72 }, cb2: { x: 50, y: 72 }, cb3: { x: 72, y: 72 }, rwb: { x: 90, y: 70 },
    cm1: { x: 25, y: 48 }, cm2: { x: 50, y: 48 }, cm3: { x: 75, y: 48 },
    lst: { x: 35, y: 18 }, rst: { x: 65, y: 18 },
  },
  '4-5-1': {
    gk:  { x: 50, y: 88 },
    lb:  { x: 15, y: 70 }, cb1: { x: 37, y: 70 }, cb2: { x: 63, y: 70 }, rb: { x: 85, y: 70 },
    lm:  { x: 10, y: 50 }, cm1: { x: 28, y: 50 }, cdm: { x: 50, y: 52 }, cm2: { x: 72, y: 50 }, rm: { x: 90, y: 50 },
    st:  { x: 50, y: 14 },
  },
  // Christmas Tree
  '4-3-2-1': {
    gk:  { x: 50, y: 88 },
    lb:  { x: 15, y: 70 }, cb1: { x: 37, y: 70 }, cb2: { x: 63, y: 70 }, rb: { x: 85, y: 70 },
    cm1: { x: 20, y: 52 }, cm2: { x: 50, y: 52 }, cm3: { x: 80, y: 52 },
    lam: { x: 30, y: 30 }, ram: { x: 70, y: 30 },
    st:  { x: 50, y: 12 },
  },
  // Second striker / shadow striker
  '4-4-1-1': {
    gk:  { x: 50, y: 88 },
    lb:  { x: 15, y: 70 }, cb1: { x: 37, y: 70 }, cb2: { x: 63, y: 70 }, rb: { x: 85, y: 70 },
    lm:  { x: 15, y: 50 }, cm1: { x: 37, y: 50 }, cm2: { x: 63, y: 50 }, rm: { x: 85, y: 50 },
    ss:  { x: 50, y: 30 },
    st:  { x: 50, y: 14 },
  },
  // Three at the back
  '3-4-3': {
    gk:  { x: 50, y: 88 },
    cb1: { x: 25, y: 70 }, cb2: { x: 50, y: 70 }, cb3: { x: 75, y: 70 },
    lm:  { x: 12, y: 50 }, cm1: { x: 37, y: 50 }, cm2: { x: 63, y: 50 }, rm: { x: 88, y: 50 },
    lw:  { x: 15, y: 20 }, st: { x: 50, y: 14 }, rw: { x: 85, y: 20 },
  },
  // Single pivot
  '4-1-4-1': {
    gk:  { x: 50, y: 88 },
    lb:  { x: 15, y: 70 }, cb1: { x: 37, y: 70 }, cb2: { x: 63, y: 70 }, rb: { x: 85, y: 70 },
    cdm: { x: 50, y: 58 },
    lm:  { x: 12, y: 42 }, cm1: { x: 35, y: 40 }, cm2: { x: 65, y: 40 }, rm: { x: 88, y: 42 },
    st:  { x: 50, y: 14 },
  },
  // Holding 4-3-3
  '4-3-3 hold': {
    gk:  { x: 50, y: 88 },
    lb:  { x: 15, y: 70 }, cb1: { x: 37, y: 70 }, cb2: { x: 63, y: 70 }, rb: { x: 85, y: 70 },
    cdm: { x: 50, y: 54 }, cm1: { x: 27, y: 50 }, cm2: { x: 73, y: 50 },
    lw:  { x: 15, y: 18 }, st: { x: 50, y: 14 }, rw: { x: 85, y: 18 },
  },
  // Wide 4-2-3-1
  '4-2-3-1 wide': {
    gk:   { x: 50, y: 88 },
    lb:   { x: 15, y: 72 }, cb1: { x: 37, y: 72 }, cb2: { x: 63, y: 72 }, rb: { x: 85, y: 72 },
    cdm1: { x: 35, y: 56 }, cdm2: { x: 65, y: 56 },
    cam:  { x: 50, y: 36 },
    lw:   { x: 12, y: 18 }, st: { x: 50, y: 12 }, rw: { x: 88, y: 18 },
  },
};

// Mirrors backend FORMATIONS — keeps positionGroup in sync when formation changes
const FORMATION_SLOT_DEFS: Record<FormationName, { slotId: string; label: string; positionGroup: 'GK' | 'DEF' | 'MID' | 'FWD' }[]> = {
  '4-4-2': [
    { slotId: 'gk',  label: 'GK', positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB', positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB', positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB', positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB', positionGroup: 'DEF' },
    { slotId: 'lm',  label: 'LM', positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM', positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM', positionGroup: 'MID' },
    { slotId: 'rm',  label: 'RM', positionGroup: 'MID' },
    { slotId: 'lst', label: 'ST', positionGroup: 'FWD' },
    { slotId: 'rst', label: 'ST', positionGroup: 'FWD' },
  ],
  '4-3-3': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cam', label: 'CAM', positionGroup: 'MID' },
    { slotId: 'lw',  label: 'LW',  positionGroup: 'FWD' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rw',  label: 'RW',  positionGroup: 'FWD' },
  ],
  '4-2-3-1': [
    { slotId: 'gk',   label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',   label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1',  label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2',  label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',   label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cdm1', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'cdm2', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'lam',  label: 'LAM', positionGroup: 'MID' },
    { slotId: 'cam',  label: 'CAM', positionGroup: 'MID' },
    { slotId: 'ram',  label: 'RAM', positionGroup: 'MID' },
    { slotId: 'st',   label: 'ST',  positionGroup: 'FWD' },
  ],
  '3-5-2': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb3', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'lwb', label: 'LWB', positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm3', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'rwb', label: 'RWB', positionGroup: 'MID' },
    { slotId: 'lst', label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rst', label: 'ST',  positionGroup: 'FWD' },
  ],
  '5-3-2': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lwb', label: 'LWB', positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb3', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rwb', label: 'RWB', positionGroup: 'DEF' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm3', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'lst', label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rst', label: 'ST',  positionGroup: 'FWD' },
  ],
  '4-5-1': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'lm',  label: 'LM',  positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cdm', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'rm',  label: 'RM',  positionGroup: 'MID' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
  ],
  '4-3-2-1': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm3', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'lam', label: 'LAM', positionGroup: 'MID' },
    { slotId: 'ram', label: 'RAM', positionGroup: 'MID' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
  ],
  '4-4-1-1': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'lm',  label: 'LM',  positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'rm',  label: 'RM',  positionGroup: 'MID' },
    { slotId: 'ss',  label: 'SS',  positionGroup: 'MID' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
  ],
  '3-4-3': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb3', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'lm',  label: 'LM',  positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'rm',  label: 'RM',  positionGroup: 'MID' },
    { slotId: 'lw',  label: 'LW',  positionGroup: 'FWD' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rw',  label: 'RW',  positionGroup: 'FWD' },
  ],
  '4-1-4-1': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cdm', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'lm',  label: 'LM',  positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'rm',  label: 'RM',  positionGroup: 'MID' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
  ],
  '4-3-3 hold': [
    { slotId: 'gk',  label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',  label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2', label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',  label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cdm', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'cm1', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'cm2', label: 'CM',  positionGroup: 'MID' },
    { slotId: 'lw',  label: 'LW',  positionGroup: 'FWD' },
    { slotId: 'st',  label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rw',  label: 'RW',  positionGroup: 'FWD' },
  ],
  '4-2-3-1 wide': [
    { slotId: 'gk',   label: 'GK',  positionGroup: 'GK'  },
    { slotId: 'lb',   label: 'LB',  positionGroup: 'DEF' },
    { slotId: 'cb1',  label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'cb2',  label: 'CB',  positionGroup: 'DEF' },
    { slotId: 'rb',   label: 'RB',  positionGroup: 'DEF' },
    { slotId: 'cdm1', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'cdm2', label: 'CDM', positionGroup: 'MID' },
    { slotId: 'cam',  label: 'CAM', positionGroup: 'MID' },
    { slotId: 'lw',   label: 'LW',  positionGroup: 'FWD' },
    { slotId: 'st',   label: 'ST',  positionGroup: 'FWD' },
    { slotId: 'rw',   label: 'RW',  positionGroup: 'FWD' },
  ],
};

const POS_GROUP_COLOUR: Record<string, string> = {
  GK:  'bg-yellow-400 text-yellow-900 border-yellow-500',
  DEF: 'bg-blue-500  text-white       border-blue-600',
  MID: 'bg-green-500 text-white       border-green-600',
  FWD: 'bg-red-500   text-white       border-red-600',
};

const POS_GROUP_PICKER: Record<string, string> = {
  GK:  'border-yellow-400 text-yellow-700',
  DEF: 'border-blue-400   text-blue-700',
  MID: 'border-green-400  text-green-700',
  FWD: 'border-red-400    text-red-700',
};

export default function LineupPage() {
  const router = useRouter();
  const { sessionId, phase } = useGame();

  const [formation, setFormation] = useState<FormationName>('4-4-2');
  const [slots, setSlots] = useState<LineupSlotData[]>([]);
  const [squad, setSquad] = useState<Player[]>([]);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // Load existing lineup + squad
  const loadData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      // Use allSettled so squad always loads even if the lineup endpoint errors
      const [lineupResult, sessionResult] = await Promise.allSettled([
        api.getLineup(sessionId),
        api.getSession(sessionId),
      ]);

      if (sessionResult.status === 'fulfilled') {
        setSquad(sessionResult.value.squad as Player[]);
      }

      if (lineupResult.status === 'fulfilled') {
        const lineupRes = lineupResult.value;
        setFormation(lineupRes.formation as FormationName);
        setSlots(lineupRes.startingXI);
      } else {
        // Lineup endpoint unavailable — fall back to default formation
        const defaultDefs = FORMATION_SLOT_DEFS['4-4-2'];
        setFormation('4-4-2');
        setSlots(defaultDefs.map((def) => ({ ...def, player: null })));
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) { router.replace('/'); return; }
    if (phase === 'team_selection') { router.replace('/select-team'); return; }
    loadData();
  }, [sessionId, phase, router, loadData]);

  // When formation changes, reset all slot assignments using authoritative slot definitions
  function handleFormationChange(f: FormationName) {
    setFormation(f);
    setActiveSlot(null);
    const defs = FORMATION_SLOT_DEFS[f];
    const newSlots: LineupSlotData[] = defs.map((def) => ({
      slotId: def.slotId,
      label: def.label,
      positionGroup: def.positionGroup,
      player: null,
    }));
    setSlots(newSlots);
  }

  function assignPlayer(player: Player) {
    if (!activeSlot) return;
    setSlots((prev) =>
      prev.map((s) => {
        // Remove the player from any other slot they were in
        if (s.player?._id === player._id) return { ...s, player: null };
        if (s.slotId === activeSlot) return { ...s, player };
        return s;
      })
    );
    setActiveSlot(null);
  }

  function removePlayer(slotId: string) {
    setSlots((prev) => prev.map((s) => (s.slotId === slotId ? { ...s, player: null } : s)));
    setActiveSlot(null);
  }

  function autoFill() {
    const scoreFn: Record<string, (p: Player) => number> = {
      GK:  (p) => p.stats.overall,
      DEF: (p) => p.stats.defending * 0.7 + p.stats.overall * 0.3,
      MID: (p) => p.stats.passing * 0.35 + p.stats.overall * 0.5 + p.stats.shooting * 0.15,
      FWD: (p) => p.stats.shooting * 0.6 + p.stats.dribbling * 0.2 + p.stats.overall * 0.2,
    };
    const used = new Set<string>();
    const newSlots = slots.map((slot) => {
      if (slot.player) { used.add(slot.player._id); return slot; }
      const native = SLOT_NATIVE_POSITIONS[slot.label] ?? [];
      const group  = slot.positionGroup;
      const score  = scoreFn[group];
      // Primary: player's position is natively valid for this slot
      const primary = squad
        .filter((p) => !used.has(p._id) && (native.length > 0 ? native.includes(p.position) : p.positionGroup === group))
        .sort((a, b) => score(b) - score(a));
      if (primary.length > 0) { used.add(primary[0]._id); return { ...slot, player: primary[0] }; }
      // Alt: player has an alt position that is natively valid for this slot
      const alt = squad
        .filter((p) => !used.has(p._id) && (p.altPositions ?? []).some((ap) => native.includes(ap)))
        .sort((a, b) => score(b) - score(a));
      if (alt.length > 0) { used.add(alt[0]._id); return { ...slot, player: alt[0] }; }
      return slot;
    });
    setSlots(newSlots);
  }

  async function handleSave() {
    if (!sessionId) return;
    setSaving(true);
    try {
      const saveSlots: LineupSlotSave[] = slots.map((s) => ({
        slotId: s.slotId,
        playerId: s.player?._id ?? null,
      }));
      await api.saveLineup(sessionId, formation, saveSlots);
      showToast('Lineup saved!', true);
    } catch (e: any) {
      showToast(e.message ?? 'Failed to save', false);
    } finally {
      setSaving(false);
    }
  }

  const activeSlotData = slots.find((s) => s.slotId === activeSlot);
  const assignedIds = new Set(slots.map((s) => s.player?._id).filter(Boolean));

  // Build picker list scoped to the slot's native positions.
  // Primary players (position in native list) come first, alt-eligible players after.
  const pickerPlayers: Array<{ player: Player; matchingAlts: string[] }> = (() => {
    if (!activeSlotData) return [];
    const native = SLOT_NATIVE_POSITIONS[activeSlotData.label] ?? [];
    if (native.length === 0) {
      // Fallback: positionGroup match (no per-position restriction for unknown labels)
      return squad
        .filter((p) => p.positionGroup === activeSlotData.positionGroup)
        .sort((a, b) => b.stats.overall - a.stats.overall)
        .map((player) => ({ player, matchingAlts: [] }));
    }
    const primary: Array<{ player: Player; matchingAlts: string[] }> = [];
    const alt:     Array<{ player: Player; matchingAlts: string[] }> = [];
    for (const p of squad) {
      if (native.includes(p.position)) {
        primary.push({ player: p, matchingAlts: [] });
      } else {
        const matched = (p.altPositions ?? []).filter((ap) => native.includes(ap));
        if (matched.length > 0) alt.push({ player: p, matchingAlts: matched });
      }
    }
    primary.sort((a, b) => b.player.stats.overall - a.player.stats.overall);
    alt.sort((a, b) => b.player.stats.overall - a.player.stats.overall);
    return [...primary, ...alt];
  })();

  const coords = FORMATION_COORDS[formation] ?? {};
  const filledCount = slots.filter((s) => s.player).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400">
        Loading lineup…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 rounded-xl px-5 py-3 text-sm font-semibold shadow-lg ${
            toast.ok ? 'bg-green-600 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Manage Lineup</h1>
          <p className="text-sm text-zinc-500">{filledCount}/11 players assigned</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Formation selector */}
          <select
            value={formation}
            onChange={(e) => handleFormationChange(e.target.value as FormationName)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {FORMATION_NAMES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <button
            onClick={autoFill}
            className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
          >
            Auto-fill
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {saving ? 'Saving…' : 'Save Lineup'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Pitch ──────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          {/* Pitch container */}
          <div
            className="relative w-full rounded-2xl overflow-hidden border-2 border-green-700"
            style={{
              background: 'repeating-linear-gradient(180deg, #2d6a2d 0px, #2d6a2d 40px, #286428 40px, #286428 80px)',
              aspectRatio: '9 / 13',
            }}
          >
            {/* Pitch markings */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Centre circle */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[18%] aspect-square rounded-full border border-white/30" />
              {/* Centre line */}
              <div className="absolute left-0 right-0 top-1/2 border-t border-white/30" />
              {/* Penalty boxes */}
              <div className="absolute left-[20%] right-[20%] top-[2%] h-[12%] border border-white/30" />
              <div className="absolute left-[20%] right-[20%] bottom-[2%] h-[12%] border border-white/30" />
            </div>

            {/* Slot buttons */}
            {slots.map((slot) => {
              const pos = coords[slot.slotId];
              if (!pos) return null;
              const isActive = activeSlot === slot.slotId;
              const colorClass = POS_GROUP_COLOUR[slot.positionGroup] ?? 'bg-zinc-500 text-white border-zinc-600';

              return (
                <button
                  key={slot.slotId}
                  onClick={() => setActiveSlot(isActive ? null : slot.slotId)}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                  className={`absolute flex flex-col items-center gap-0.5 group`}
                >
                  {/* Player disc */}
                  <div
                    className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-[10px] font-bold leading-tight transition
                      ${colorClass}
                      ${isActive ? 'ring-2 ring-white ring-offset-1 ring-offset-transparent scale-110' : 'hover:scale-105'}
                    `}
                  >
                    {slot.player ? (
                      <span className="text-center px-0.5 leading-none">
                        {slot.player.shortName.slice(0, 8)}
                      </span>
                    ) : (
                      <span className="text-lg opacity-60">+</span>
                    )}
                  </div>
                  {/* Slot label + overall + ALT badge */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-0.5">
                      <span className="text-[9px] font-bold text-white/90 leading-none">{slot.label}</span>
                      {slot.player && !(SLOT_NATIVE_POSITIONS[slot.label] ?? []).includes(slot.player.position) && (
                        <span className="text-[8px] bg-orange-500/80 text-white font-bold px-0.5 rounded leading-none ml-0.5">ALT</span>
                      )}
                    </div>
                    {slot.player && (
                      <span className="text-[9px] text-white/70 leading-none">{slot.player.stats.overall}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-3 flex-wrap mt-2 text-xs font-medium">
            {Object.entries(POS_GROUP_COLOUR).map(([group, cls]) => (
              <span key={group} className={`rounded-full px-2.5 py-0.5 ${cls}`}>{group}</span>
            ))}
            <span className="text-zinc-400">Click a slot to assign a player</span>
          </div>
        </div>

        {/* ── Player picker / instructions ───────────────────────────────── */}
        <div className="space-y-3">
          {activeSlot && activeSlotData ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className={`text-sm font-bold uppercase tracking-wide ${POS_GROUP_PICKER[activeSlotData.positionGroup]}`}>
                  {activeSlotData.label} — Pick {activeSlotData.positionGroup}
                </h2>
                <button
                  onClick={() => setActiveSlot(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                >
                  ✕ Close
                </button>
              </div>

              {/* Remove button if assigned */}
              {activeSlotData.player && (
                <button
                  onClick={() => removePlayer(activeSlot)}
                  className="w-full rounded-lg border border-red-300 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 transition"
                >
                  Remove {activeSlotData.player.shortName}
                </button>
              )}

              <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
                {pickerPlayers.length === 0 ? (
                  <p className="text-sm text-zinc-400">No eligible players in squad</p>
                ) : (
                  pickerPlayers.map(({ player: p, matchingAlts }) => {
                    const isAssigned = assignedIds.has(p._id);
                    const isCurrent = activeSlotData.player?._id === p._id;
                    const isAlt = matchingAlts.length > 0;
                    return (
                      <button
                        key={p._id}
                        disabled={isAssigned && !isCurrent}
                        onClick={() => assignPlayer(p)}
                        className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition
                          ${isCurrent
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                            : isAssigned
                            ? 'border-zinc-200 bg-zinc-50 opacity-40 cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-800/30'
                            : 'border-zinc-200 hover:border-blue-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                          }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5 leading-tight flex-wrap">
                            <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                              {p.name}
                            </p>
                            {isAlt && (
                              <span className="text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-300 px-1 py-0.5 rounded dark:bg-orange-900/30 dark:text-orange-400 whitespace-nowrap">
                                ALT · {matchingAlts.join(', ')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">{p.position} · {p.club}</p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-base font-bold text-zinc-900 dark:text-white">{p.stats.overall}</p>
                          <p className="text-[10px] text-zinc-400">{p.positionGroup}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center space-y-2">
              <p className="text-zinc-500 text-sm">Click any position on the pitch to assign a player.</p>
              <p className="text-zinc-400 text-xs">Use <strong>Auto-fill</strong> to fill all positions with the best available player automatically.</p>
              {filledCount > 0 && (
                <div className="pt-2 text-left max-h-[55vh] overflow-y-auto space-y-1">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1">Current lineup</p>
                  {slots
                    .filter((s) => s.player)
                    .map((s) => (
                      <div key={s.slotId} className="flex justify-between text-xs px-2 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                        <span className="text-zinc-500 w-10">{s.label}</span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 flex-1 truncate">{s.player!.name}</span>
                        <span className="text-zinc-400 ml-1">{s.player!.stats.overall}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
