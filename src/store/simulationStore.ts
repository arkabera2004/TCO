/**
 * Dependency audit (Next.js migration, design-system-retrofit branch):
 * kept on zustand rather than moving to React Context or local state.
 * This store is read by AppShell (every route, header + footer) and by
 * sibling route pages (/, /simulation, /tender, /bom, /scenarios,
 * /maintenance) that have no parent/child relationship — the state is
 * genuinely global and not prop-drillable from a single layout segment.
 * setParams also triggers a synchronous TCO recompute on every slider
 * tick; a plain Context provider would re-render every consumer
 * (including AppShell) on each tick, where zustand's store scopes
 * updates to the hook call sites that actually read the changed slice.
 */
import { create } from "zustand";
import {
  DEFAULT_PARAMS,
  runTCOSimulation,
  type SimParams,
  type SimResult,
} from "@/utils/simulationEngine";
import { PREDEFINED_SCENARIOS, type Scenario } from "@/data/syntheticData";

/** Annual duty cycle used to express the planning horizon as distance. */
export const HORIZON_ANNUAL_KM = 240000;

export type HorizonUnit = "years" | "km";

/** Format a year-count in whichever unit the header toggle is set to. */
export function formatHorizon(years: number, unit: HorizonUnit): string {
  if (unit === "years") return `${years}yr`;
  const km = years * HORIZON_ANNUAL_KM;
  return km >= 1e6 ? `${(km / 1e6).toFixed(1)}M km` : `${Math.round(km / 1000)}k km`;
}

interface SimulationStore {
  params: SimParams;
  result: SimResult;
  activeScenarioName: string;
  comparisonScenarios: Scenario[];
  selectedComponentId: string | null;
  /** Whether the horizon is displayed in years or kilometres. */
  horizonUnit: HorizonUnit;
  setHorizonUnit: (u: HorizonUnit) => void;
  setParams: (patch: Partial<SimParams>) => void;
  resetParams: () => void;
  setActiveScenario: (name: string) => void;
  addComparisonScenario: (s: Scenario) => void;
  removeComparisonScenario: (id: string) => void;
  setSelectedComponent: (id: string | null) => void;
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  params: DEFAULT_PARAMS,
  result: runTCOSimulation(DEFAULT_PARAMS),
  activeScenarioName: "Baseline",
  comparisonScenarios: [PREDEFINED_SCENARIOS[0], PREDEFINED_SCENARIOS[1]],
  selectedComponentId: null,
  horizonUnit: "years",
  setHorizonUnit: (horizonUnit) => set({ horizonUnit }),
  setParams: (patch) => {
    const params = { ...get().params, ...patch };
    set({ params, result: runTCOSimulation(params) });
  },
  resetParams: () => set({ params: DEFAULT_PARAMS, result: runTCOSimulation(DEFAULT_PARAMS) }),
  setActiveScenario: (name) => set({ activeScenarioName: name }),
  addComparisonScenario: (s) => {
    const cur = get().comparisonScenarios;
    if (cur.find((c) => c.id === s.id) || cur.length >= 3) return;
    set({ comparisonScenarios: [...cur, s] });
  },
  removeComparisonScenario: (id) =>
    set({ comparisonScenarios: get().comparisonScenarios.filter((c) => c.id !== id) }),
  setSelectedComponent: (id) => set({ selectedComponentId: id }),
}));
