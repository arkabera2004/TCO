import { describe, expect, it } from "vitest";
import type { Part } from "@/data/bomData";
import {
  DEFAULT_DUTY,
  DEFAULT_LABOR_PCT,
  companyBuffer,
  eventPartsCost,
  eventTotalCost,
  failureTrend,
  fleetTCO,
  formatInterval,
  intervalYears,
  laborFor,
  maintenanceEvents,
  partIntervalYears,
  partTCO,
} from "@/utils/tcoEngine";

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: "part-test",
    componentId: "comp-test",
    name: "Test Part",
    partNumber: "TP-0001",
    pnVerified: false,
    vendor: "Test Vendor",
    partClass: "Consumable",
    procurementType: "new",
    repairable: false,
    qtyPerComponent: 1,
    uom: "ea",
    unitPriceNew: 1000,
    unitPriceReman: 0,
    coreCredit: 0,
    scrapValue: 0,
    lifeYears: 10,
    lifeHours: null,
    lifeKm: null,
    leadTimeWeeks: 2,
    replacementIntervalYears: 2,
    laborHoursPerReplacement: 1,
    criticality: "Essential",
    failureImpact: "Reduced performance",
    vedClass: "E",
    maintIntervalValue: 2,
    maintIntervalUnit: "months",
    maintQty: 1,
    warrantyYears: 1,
    warrantyKm: 50000,
    failureProbabilityPct: 10,
    usefulLifeYears: 10,
    depreciationMethod: "straight-line",
    capitalized: false,
    onHandQty: 10,
    minStock: 1,
    maxStock: 20,
    reorderPoint: 5,
    safetyStock: 2,
    annualUsageQty: 6,
    ...overrides,
  };
}

describe("intervalYears", () => {
  it("converts hours using the duty cycle's annual hours", () => {
    expect(intervalYears(5500, "hrs", DEFAULT_DUTY)).toBeCloseTo(1, 5);
  });

  it("converts km using the duty cycle's annual km", () => {
    expect(intervalYears(240000, "km", DEFAULT_DUTY)).toBeCloseTo(1, 5);
  });

  it("converts months to years", () => {
    expect(intervalYears(24, "months")).toBeCloseTo(2, 5);
  });

  it("treats a non-positive interval as never-due", () => {
    expect(intervalYears(0, "months")).toBe(Infinity);
    expect(intervalYears(-5, "hrs")).toBe(Infinity);
  });
});

describe("partIntervalYears", () => {
  it("delegates to intervalYears using the part's own interval fields", () => {
    const part = makePart({ maintIntervalValue: 12, maintIntervalUnit: "months" });
    expect(partIntervalYears(part)).toBeCloseTo(1, 5);
  });
});

describe("formatInterval", () => {
  it("renders the value and unit with locale thousands separators", () => {
    const part = makePart({ maintIntervalValue: 40000, maintIntervalUnit: "hrs" });
    expect(formatInterval(part)).toBe("40,000 hrs");
  });
});

describe("eventPartsCost / laborFor / eventTotalCost", () => {
  it("multiplies quantity by unit price for parts cost", () => {
    const part = makePart({ maintQty: 3, unitPriceNew: 100 });
    expect(eventPartsCost(part)).toBe(300);
  });

  it("derives labour as a percentage of parts cost, never entered directly", () => {
    expect(laborFor(1000, 18)).toBe(180);
    expect(laborFor(1000)).toBe((1000 * DEFAULT_LABOR_PCT) / 100);
  });

  it("sums parts and derived labour for one event", () => {
    const part = makePart({ maintQty: 2, unitPriceNew: 500 });
    // parts = 1000, labour @ 18% = 180
    expect(eventTotalCost(part, 18)).toBe(1180);
  });
});

describe("companyBuffer", () => {
  it("is the replacement cost weighted by failure probability", () => {
    const part = makePart({ maintQty: 1, unitPriceNew: 2000, failureProbabilityPct: 25 });
    expect(companyBuffer(part)).toBe(500);
  });
});

describe("maintenanceEvents", () => {
  it("returns no events when the interval never completes", () => {
    const part = makePart({ maintIntervalValue: 0, maintIntervalUnit: "months" });
    expect(maintenanceEvents(part, 20)).toEqual([]);
  });

  it("generates one event per interval within the horizon, not beyond it", () => {
    // Every 5 years, 20yr horizon -> occurrences at 5, 10, 15, 20 (exactly 20 included)
    const part = makePart({ maintIntervalValue: 5 * 12, maintIntervalUnit: "months" });
    const events = maintenanceEvents(part, 20);
    expect(events.map((e) => e.atYear)).toEqual([5, 10, 15, 20]);
  });

  it("excludes an event that would land exactly past the horizon", () => {
    const part = makePart({ maintIntervalValue: 6 * 12, maintIntervalUnit: "months" });
    const events = maintenanceEvents(part, 20);
    // Every 6 years -> 6, 12, 18 ; the next at 24 exceeds a 20yr horizon
    expect(events.map((e) => e.atYear)).toEqual([6, 12, 18]);
  });

  it("marks an event under warranty only when both the year and km limits hold", () => {
    const part = makePart({
      maintIntervalValue: 12,
      maintIntervalUnit: "months",
      warrantyYears: 2,
      warrantyKm: 1_000_000, // effectively non-binding
    });
    const events = maintenanceEvents(part, 3);
    expect(events.map((e) => e.underWarranty)).toEqual([true, true, false]);
  });

  it("drops out of warranty once the km limit is exceeded even if years remain", () => {
    const part = makePart({
      maintIntervalValue: 12,
      maintIntervalUnit: "months",
      warrantyYears: 10, // non-binding
      warrantyKm: 300_000, // binds after ~1.25 years at DEFAULT_DUTY.annualKm
    });
    const events = maintenanceEvents(part, 3, DEFAULT_LABOR_PCT, DEFAULT_DUTY);
    // Year 1 -> 240,000 km (within 300k); Year 2 -> 480,000 km (exceeds 300k)
    expect(events[0].underWarranty).toBe(true);
    expect(events[1].underWarranty).toBe(false);
  });

  it("computes parts/labour/total cost consistently per event", () => {
    const part = makePart({
      maintQty: 2,
      unitPriceNew: 100,
      maintIntervalValue: 12,
      maintIntervalUnit: "months",
    });
    const [event] = maintenanceEvents(part, 1, 20);
    expect(event.partsCost).toBe(200);
    expect(event.laborCost).toBe(40);
    expect(event.totalCost).toBe(240);
  });
});

describe("partTCO", () => {
  it("splits total cost into customer vs company portions at the warranty boundary", () => {
    const part = makePart({
      maintIntervalValue: 12,
      maintIntervalUnit: "months",
      maintQty: 1,
      unitPriceNew: 1000,
      warrantyYears: 1,
      warrantyKm: 1_000_000,
      failureProbabilityPct: 10,
    });
    const result = partTCO(part, 3, 18);

    // 3 events (years 1, 2, 3); only year 1 is under warranty.
    expect(result.eventCount).toBe(3);
    const perEventTotal = 1000 + 1000 * 0.18; // 1180
    expect(result.totalCost).toBeCloseTo(perEventTotal * 3, 5);
    expect(result.warrantyCoveredCost).toBeCloseTo(perEventTotal, 5);
    expect(result.customerCost).toBeCloseTo(perEventTotal * 2, 5);
    expect(result.companyCost).toBeCloseTo(perEventTotal + companyBuffer(part), 5);
  });

  it("returns zeroed totals when the part never comes due", () => {
    const part = makePart({ maintIntervalValue: 0, maintIntervalUnit: "months" });
    const result = partTCO(part, 20);
    expect(result.eventCount).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.customerCost).toBe(0);
  });

  it("averages total cost evenly across the horizon", () => {
    const part = makePart({
      maintIntervalValue: 10 * 12,
      maintIntervalUnit: "months",
      maintQty: 1,
      unitPriceNew: 1000,
    });
    const result = partTCO(part, 10, 0); // one event at year 10, no labour
    expect(result.totalCost).toBe(1000);
    expect(result.avgAnnualCost).toBe(100);
  });
});

describe("fleetTCO", () => {
  it("sums part-level results across the fleet", () => {
    const partA = makePart({
      id: "a",
      maintIntervalValue: 12,
      maintIntervalUnit: "months",
      maintQty: 1,
      unitPriceNew: 100,
      warrantyYears: 0,
      warrantyKm: 0,
    });
    const partB = makePart({
      id: "b",
      maintIntervalValue: 12,
      maintIntervalUnit: "months",
      maintQty: 1,
      unitPriceNew: 200,
      warrantyYears: 0,
      warrantyKm: 0,
    });

    const fleet = fleetTCO([partA, partB], 1, 0); // no labour, one event each
    expect(fleet.totalCost).toBe(300);
    expect(fleet.customerTCO).toBe(300); // nothing under warranty
    expect(fleet.rows).toHaveLength(2);
  });

  it("handles an empty fleet without dividing by zero", () => {
    const fleet = fleetTCO([], 10);
    expect(fleet.totalCost).toBe(0);
    expect(fleet.avgAnnualCost).toBe(0);
  });
});

describe("failureTrend", () => {
  it("starts at year zero with zero wear-adjusted probability", () => {
    const part = makePart({ failureProbabilityPct: 20, replacementIntervalYears: 5 });
    const trend = failureTrend(part, 10);
    expect(trend[0]).toEqual({ year: 0, probability: 0 });
  });

  it("is monotonically non-decreasing as years accumulate", () => {
    const part = makePart({ failureProbabilityPct: 15, replacementIntervalYears: 4 });
    const trend = failureTrend(part, 20);
    for (let i = 1; i < trend.length; i++) {
      expect(trend[i].probability).toBeGreaterThanOrEqual(trend[i - 1].probability);
    }
  });

  it("never exceeds 100%", () => {
    const part = makePart({ failureProbabilityPct: 90, replacementIntervalYears: 1 });
    const trend = failureTrend(part, 30);
    for (const point of trend) {
      expect(point.probability).toBeLessThanOrEqual(100);
    }
  });
});
