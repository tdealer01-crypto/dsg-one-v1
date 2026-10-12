'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type AcceptedAppOutcome = {
  revision: number;
  goal: string;
  criteria: string[];
};

type GoalBridge = {
  submitted: AcceptedAppOutcome | null;
  publish: (goal: string, criteria: string[]) => void;
};

// This shares only user-entered intent between the outcome intake and the
// console. It does not manufacture a PRD, plan, job or production evidence.
const AppBuilderGoalContext = createContext<GoalBridge | null>(null);

export function AppBuilderGoalProvider({ children }: { children: ReactNode }) {
  const [submitted, setSubmitted] = useState<AcceptedAppOutcome | null>(null);

  function publish(goal: string, criteria: string[]) {
    const normalized = goal.trim();
    if (!normalized) return;
    setSubmitted(prev => ({
      revision: (prev?.revision ?? 0) + 1,
      goal: normalized,
      criteria: criteria.map(item => item.trim()).filter(Boolean),
    }));
  }

  return (
    <AppBuilderGoalContext.Provider value={{ submitted, publish }}>
      {children}
    </AppBuilderGoalContext.Provider>
  );
}

export function useAppBuilderGoalBridge() {
  return useContext(AppBuilderGoalContext);
}
