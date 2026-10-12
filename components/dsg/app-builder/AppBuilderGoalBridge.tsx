'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { DsgOutcomeIntake } from '@/lib/dsg/app-builder/outcome-intake';

export type AcceptedAppOutcome = {
  revision: number;
  goal: string;
  criteria: string[];
  intake: DsgOutcomeIntake;
};

type GoalBridge = {
  submitted: AcceptedAppOutcome | null;
  publish: (acceptedIntake: DsgOutcomeIntake) => void;
};

// This shares only user-entered intent between the outcome intake and the
// console. It does not manufacture a PRD, plan, job or production evidence.
const AppBuilderGoalContext = createContext<GoalBridge | null>(null);

export function AppBuilderGoalProvider({ children }: { children: ReactNode }) {
  const [submitted, setSubmitted] = useState<AcceptedAppOutcome | null>(null);

  function publish(acceptedIntake: DsgOutcomeIntake) {
    const normalized = acceptedIntake.goal.trim();
    if (!normalized) return;
    // Only consume the normalized response from the server's intake validator,
    // not mutable form state that can change while the POST is pending.
    setSubmitted(prev => ({
      revision: (prev?.revision ?? 0) + 1,
      goal: normalized,
      criteria: acceptedIntake.successOutcome ? [acceptedIntake.successOutcome] : [],
      intake: {
        ...acceptedIntake,
        targetUsers: [...acceptedIntake.targetUsers],
        availableData: [...acceptedIntake.availableData],
        requiredIntegrations: [...acceptedIntake.requiredIntegrations],
      },
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
