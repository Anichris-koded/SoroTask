import { create } from "zustand";

export interface GasFeeTier {
  tier: "fast" | "standard" | "safe-low";
  baseFeeXlm: number;
  multiplier: number;
  etaSeconds: number;
}

export interface SimulationResult {
  txHash?: string;
  status: "success" | "failure";
  gasConsumed: number;
  feePaidXlm: number;
  eventsCount: number;
  errorMessage?: string;
}

export interface BatchOpportunity {
  id: string;
  contractId: string;
  methodsCount: number;
  potentialSavingXlm: number;
}

export interface HourlyGasSample {
  day: number;
  hour: number;
  feeXlm: number;
}

function createWeeklyHistory(): HourlyGasSample[] {
  return Array.from({ length: 7 * 24 }, (_, index) => {
    const day = Math.floor(index / 24);
    const hour = index % 24;
    const dailyPeak = hour >= 14 && hour <= 19 ? 0.055 : 0;
    const overnightRelief = hour >= 1 && hour <= 6 ? -0.025 : 0;
    const dayVariation = ((day * 17 + hour * 7) % 13) / 1000;
    return { day, hour, feeXlm: Math.max(0.015, 0.08 + dailyPeak + overnightRelief + dayVariation) };
  });
}

interface GasOptimizationStoreState {
  // Gas Metrics
  congestionLevel: "low" | "medium" | "high";
  baseFee: number; // in XLM
  activeTxCount: number;
  feeTiers: GasFeeTier[];
  
  // Optimization suggestions
  bestHourUtc: number;
  potentialOffpeakSavingsPercent: number;
  hourlyHistory: HourlyGasSample[];
  scheduledHourUtc: number | null;
  batchOpportunities: BatchOpportunity[];

  // Simulation Status
  isSimulating: boolean;
  simulationResult: SimulationResult | null;

  // Actions
  refreshMetrics: () => void;
  optimizeSchedule: () => void;
  runSimulation: (contractId: string, method: string) => Promise<void>;
  applyBatching: (opportunityId: string) => void;
}

const mockTiers: GasFeeTier[] = [
  { tier: "fast", baseFeeXlm: 0.12, multiplier: 1.5, etaSeconds: 5 },
  { tier: "standard", baseFeeXlm: 0.08, multiplier: 1.0, etaSeconds: 15 },
  { tier: "safe-low", baseFeeXlm: 0.05, multiplier: 0.8, etaSeconds: 45 },
];

const mockBatchOpportunities: BatchOpportunity[] = [
  { id: "batch-1", contractId: "C1...X90", methodsCount: 3, potentialSavingXlm: 0.15 },
  { id: "batch-2", contractId: "C4...K12", methodsCount: 2, potentialSavingXlm: 0.07 },
];

export const useGasOptimizationStore = create<GasOptimizationStoreState>((set, get) => ({
  congestionLevel: "medium",
  baseFee: 0.08,
  activeTxCount: 242,
  feeTiers: mockTiers,
  bestHourUtc: 3, // 3 AM UTC is off-peak
  potentialOffpeakSavingsPercent: 42,
  hourlyHistory: createWeeklyHistory(),
  scheduledHourUtc: null,
  batchOpportunities: mockBatchOpportunities,
  isSimulating: false,
  simulationResult: null,

  refreshMetrics: () => {
    // Simulate real-time fluctuated fee updates
    const levels: ("low" | "medium" | "high")[] = ["low", "medium", "high"];
    const level = levels[Math.floor(Math.random() * levels.length)] || "medium";
    
    let baseMultiplier = 1.0;
    if (level === "low") baseMultiplier = 0.6;
    if (level === "high") baseMultiplier = 1.8;

    const updatedTiers = mockTiers.map((t) => ({
      ...t,
      baseFeeXlm: parseFloat((t.baseFeeXlm * baseMultiplier).toFixed(3)),
    }));

    set({
      congestionLevel: level,
      baseFee: parseFloat((0.08 * baseMultiplier).toFixed(3)),
      activeTxCount: Math.floor(Math.random() * 400) + 50,
      feeTiers: updatedTiers,
    });
  },

  optimizeSchedule: () => {
    const averages = Array.from({ length: 24 }, (_, hour) => {
      const samples = get().hourlyHistory.filter((sample) => sample.hour === hour);
      return { hour, fee: samples.reduce((sum, sample) => sum + sample.feeXlm, 0) / samples.length };
    });
    const best = averages.reduce((lowest, current) => current.fee < lowest.fee ? current : lowest);
    const savings = Math.max(0, (get().baseFee - best.fee) / get().baseFee * 100);
    set({ bestHourUtc: best.hour, potentialOffpeakSavingsPercent: Math.round(savings), scheduledHourUtc: best.hour });
  },

  runSimulation: async (contractId, method) => {
    set({ isSimulating: true, simulationResult: null });

    // Mock processing lag
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Force error if contractId contains "fail" for testing robustness
    if (contractId.toLowerCase().includes("fail")) {
      set({
        isSimulating: false,
        simulationResult: {
          status: "failure",
          gasConsumed: 1200,
          feePaidXlm: 0.01,
          eventsCount: 0,
          errorMessage: "ContractExecutionError: assertion failed in lib.rs:142",
        },
      });
      return;
    }

    set({
      isSimulating: false,
      simulationResult: {
        txHash: "tx_" + Math.random().toString(36).substring(2, 10),
        status: "success",
        gasConsumed: Math.floor(Math.random() * 45000) + 5000,
        feePaidXlm: parseFloat((get().baseFee * 1.2).toFixed(3)),
        eventsCount: 2,
      },
    });
  },

  applyBatching: (id) => {
    set((state) => ({
      batchOpportunities: state.batchOpportunities.filter((o) => o.id !== id),
    }));
  },
}));
