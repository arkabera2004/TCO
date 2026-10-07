/**
 * Dependency audit (Next.js migration, design-system-retrofit branch):
 * kept on zustand for the same reason as simulationStore — the parts
 * list and labor % are edited on /bom and /library, then consumed by
 * sibling pages (/, /maintenance, MaintenanceAnalytics) with no shared
 * parent beyond the root layout. Genuinely global, cross-route state.
 */
import { create } from "zustand";
import { PARTS, type Part, type MaintIntervalUnit } from "@/data/bomData";
import { DEFAULT_LABOR_PCT } from "@/utils/tcoEngine";

/** The fields a user fills in when adding a part through the UI. */
export interface NewPartInput {
  name: string;
  componentId: string;
  maintIntervalValue: number;
  maintIntervalUnit: MaintIntervalUnit;
  maintQty: number;
  uom: string;
  unitPriceNew: number;
  warrantyYears: number;
  warrantyKm: number;
  failureProbabilityPct: number;
}

interface PartsStore {
  parts: Part[];
  /** Labour as a percentage of parts spend — 18% by default, editable. */
  laborPct: number;
  addPart: (input: NewPartInput) => Part;
  updatePart: (id: string, patch: Partial<Part>) => void;
  removePart: (id: string) => void;
  setLaborPct: (pct: number) => void;
  resetParts: () => void;
}

let userPartSeq = 0;

/**
 * A user-added part only supplies maintenance-relevant fields; everything the
 * BOM/inventory views need is filled with conservative defaults so the new part
 * renders everywhere without special-casing.
 */
function buildPart(input: NewPartInput): Part {
  userPartSeq += 1;
  const qty = Math.max(1, input.maintQty);
  return {
    id: `prt-user-${String(userPartSeq).padStart(3, "0")}`,
    componentId: input.componentId,
    name: input.name,
    partNumber: `USR-${String(userPartSeq).padStart(4, "0")}`,
    pnVerified: false,
    vendor: "User-defined",
    partClass: "User Added",
    procurementType: "new",
    repairable: false,

    qtyPerComponent: qty,
    uom: input.uom,

    unitPriceNew: input.unitPriceNew,
    unitPriceReman: 0,
    coreCredit: 0,
    scrapValue: 0,

    lifeYears: Math.max(0.5, input.warrantyYears),
    lifeHours: input.maintIntervalUnit === "hrs" ? input.maintIntervalValue : null,
    lifeKm: input.maintIntervalUnit === "km" ? input.maintIntervalValue : null,
    leadTimeWeeks: 4,

    replacementIntervalYears: Math.max(0.5, input.warrantyYears),
    laborHoursPerReplacement: 1,
    criticality: "Essential",
    failureImpact: "User-defined part",
    vedClass: "E",

    maintIntervalValue: input.maintIntervalValue,
    maintIntervalUnit: input.maintIntervalUnit,
    maintQty: qty,
    warrantyYears: input.warrantyYears,
    warrantyKm: input.warrantyKm,
    failureProbabilityPct: input.failureProbabilityPct,

    usefulLifeYears: Math.max(1, input.warrantyYears),
    depreciationMethod: "straight-line",
    capitalized: input.unitPriceNew >= 1000,

    onHandQty: qty,
    minStock: 1,
    maxStock: qty * 3,
    reorderPoint: Math.max(1, qty),
    safetyStock: 1,
    annualUsageQty: qty,
  };
}

export const usePartsStore = create<PartsStore>((set, get) => ({
  parts: PARTS,
  laborPct: DEFAULT_LABOR_PCT,

  addPart: (input) => {
    const part = buildPart(input);
    set({ parts: [...get().parts, part] });
    return part;
  },

  updatePart: (id, patch) =>
    set({ parts: get().parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }),

  removePart: (id) => set({ parts: get().parts.filter((p) => p.id !== id) }),

  setLaborPct: (pct) => set({ laborPct: Math.max(0, Math.min(100, pct)) }),

  resetParts: () => set({ parts: PARTS, laborPct: DEFAULT_LABOR_PCT }),
}));
