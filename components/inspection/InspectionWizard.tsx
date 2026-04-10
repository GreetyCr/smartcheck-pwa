"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createEmptyInspectionDraft,
  type InspectionDraft,
} from "@/types/inspection-draft";

type InspectionWizardContextValue = {
  draft: InspectionDraft;
  setDraft: (patch: Partial<InspectionDraft>) => void;
  replaceDraft: (next: InspectionDraft) => void;
};

const InspectionWizardContext =
  createContext<InspectionWizardContextValue | null>(null);

export function InspectionWizardProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<InspectionDraft>(() =>
    createEmptyInspectionDraft(),
  );

  const setDraft = useCallback((patch: Partial<InspectionDraft>) => {
    setDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  const replaceDraft = useCallback((next: InspectionDraft) => {
    setDraftState(next);
  }, []);

  const value = useMemo(
    () => ({ draft, setDraft, replaceDraft }),
    [draft, setDraft, replaceDraft],
  );

  return (
    <InspectionWizardContext.Provider value={value}>
      {children}
    </InspectionWizardContext.Provider>
  );
}

export function useInspectionWizard() {
  const ctx = useContext(InspectionWizardContext);
  if (!ctx) {
    throw new Error(
      "useInspectionWizard debe usarse dentro de InspectionWizardProvider",
    );
  }
  return ctx;
}
