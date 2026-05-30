'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type GamePhase =
  | 'team_selection'
  | 'summer_transfer'
  | 'season'
  | 'january_transfer'
  | 'season_end';

interface GameState {
  sessionId: string | null;
  phase: GamePhase;
  userTeam: string | null;
  userTeamApiId: number | null;
  budget: number;
  squadCount: number;
  currentGameweek: number;
}

interface GameContextType extends GameState {
  setSession: (id: string) => void;
  setPhase: (phase: GamePhase) => void;
  setTeam: (team: string, apiId: number, budget: number, squadCount: number) => void;
  setBudget: (budget: number) => void;
  setGameweek: (gw: number) => void;
  clearSession: () => void;
  refreshFromServer: (data: Partial<GameState>) => void;
}

const DEFAULT_STATE: GameState = {
  sessionId: null,
  phase: 'team_selection',
  userTeam: null,
  userTeamApiId: null,
  budget: 0,
  squadCount: 0,
  currentGameweek: 0,
};

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(DEFAULT_STATE);

  // Rehydrate sessionId from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('fs_sessionId');
    if (stored) {
      setState((prev) => ({ ...prev, sessionId: stored }));
    }
  }, []);

  const setSession = (id: string) => {
    localStorage.setItem('fs_sessionId', id);
    setState((prev) => ({ ...prev, sessionId: id }));
  };

  const setPhase = (phase: GamePhase) =>
    setState((prev) => ({ ...prev, phase }));

  const setTeam = (team: string, apiId: number, budget: number, squadCount: number) =>
    setState((prev) => ({ ...prev, userTeam: team, userTeamApiId: apiId, budget, squadCount }));

  const setBudget = (budget: number) => setState((prev) => ({ ...prev, budget }));

  const setGameweek = (gw: number) => setState((prev) => ({ ...prev, currentGameweek: gw }));

  const clearSession = () => {
    localStorage.removeItem('fs_sessionId');
    setState(DEFAULT_STATE);
  };

  const refreshFromServer = (data: Partial<GameState>) =>
    setState((prev) => ({ ...prev, ...data }));

  return (
    <GameContext.Provider
      value={{
        ...state,
        setSession,
        setPhase,
        setTeam,
        setBudget,
        setGameweek,
        clearSession,
        refreshFromServer,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
