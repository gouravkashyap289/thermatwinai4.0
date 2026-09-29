export type Phase = "INJECTION" | "SOAKING" | "PRODUCTION" | "COOLING";

export type Well = {
  well_id: string;
  reservoir_temperature: number;
  reservoir_pressure: number;
  oil_viscosity: number;
  oil_rate: number;
  water_rate: number;
  water_cut: number;
  steam_volume: number;
  steam_pressure: number;
  steam_temperature: number;
  soak_time: number;
  css_phase: Phase;
  spm: number;
  stroke_length: number;
  vfd_frequency: number;
  motor_current: number;
  rod_load_min: number;
  rod_load_max: number;
  pump_fillage: number;
  pump_efficiency: number;
  energy_consumption: number;
  steam_oil_ratio: number;
  failure_risk: number;
  rod_floating_risk: number;
  heated_radius: number;
  status: string;
};

const phases: Phase[] = ["PRODUCTION", "COOLING", "INJECTION", "SOAKING"];

export const seedWell = (id = "BW-07", index = 7): Well => {
  const special = id === "BW-07";
  const temperature = special ? 62 : 55 + ((index * 11) % 42);
  const viscosity = 1650 * Math.exp(-0.035 * (temperature - 32));
  const spm = special ? 7.1 : 4.8 + ((index * 7) % 24) / 10;
  const fillage = special ? 0.61 : 0.62 + ((index * 9) % 28) / 100;
  const efficiency = Math.max(0.3, Math.min(0.9, 0.91 - viscosity / 2600 - Math.abs(spm - 5.8) * 0.035 + (fillage - 0.65) * 0.24));
  const oilRate = 118 * Math.max(0.42, Math.min(1.8, 900 / viscosity)) * efficiency * 0.86;
  const rodRisk = Math.min(0.96, 0.05 + Math.max(0, spm - 5.5) * 0.105 + Math.max(0, 0.72 - fillage) * 0.9 + viscosity / 3100);
  const failureRisk = Math.min(0.94, 0.06 + rodRisk * 0.58 + Math.max(0, 0.55 - efficiency) * 0.55);
  return {
    well_id: id,
    reservoir_temperature: temperature,
    reservoir_pressure: 74 + ((index * 5) % 21),
    oil_viscosity: viscosity,
    oil_rate: oilRate,
    water_rate: oilRate * 0.36,
    water_cut: 0.265,
    steam_volume: 240 + ((index * 17) % 140),
    steam_pressure: 72,
    steam_temperature: 290,
    soak_time: 36,
    css_phase: special ? "COOLING" : phases[index % phases.length],
    spm,
    stroke_length: 2.4,
    vfd_frequency: 46,
    motor_current: 21 + spm * 1.65 + viscosity / 115 + (1 - fillage) * 9,
    rod_load_min: 18,
    rod_load_max: special ? 65 : 54 + (index % 12),
    pump_fillage: fillage,
    pump_efficiency: efficiency,
    energy_consumption: 14.2 + (1 - efficiency) * 18,
    steam_oil_ratio: 240 / Math.max(oilRate * 5.2, 1),
    rod_floating_risk: rodRisk,
    failure_risk: failureRisk,
    heated_radius: Math.max(4, 4 + (temperature - 32) * 0.28),
    status: failureRisk > 0.72 ? "CRITICAL" : failureRisk > 0.42 ? "ATTENTION" : "NORMAL",
  };
};

export const seedWells = Array.from({ length: 20 }, (_, index) => seedWell(`BW-${String(index + 1).padStart(2, "0")}`, index + 1));

export function recalculate(well: Well, changes: Partial<Well>): Well {
  const next = { ...well, ...changes };
  const viscosity = 1650 * Math.exp(-0.035 * (next.reservoir_temperature - 32));
  const efficiency = Math.max(0.28, Math.min(0.91, 0.91 - viscosity / 2600 - Math.abs(next.spm - 5.8) * 0.035 + (next.pump_fillage - 0.65) * 0.24));
  const oilRate = 118 * Math.max(0.42, Math.min(1.8, 900 / viscosity)) * efficiency * Math.max(0.55, Math.min(1.25, next.reservoir_pressure / 82)) * (1 - 0.45 * next.water_cut);
  const motor = 21 + next.spm * 1.65 + viscosity / 115 + (1 - next.pump_fillage) * 9;
  const rodRisk = Math.min(0.99, Math.max(0.02, 0.05 + Math.max(0, next.spm - 5.5) * 0.105 + Math.max(0, 0.72 - next.pump_fillage) * 0.9 + viscosity / 3100 + Math.max(0, next.rod_load_max - next.rod_load_min - 40) * 0.012));
  const failureRisk = Math.min(0.98, 0.06 + rodRisk * 0.58 + Math.max(0, motor - 42) * 0.018 + Math.max(0, 0.55 - efficiency) * 0.55);
  return {
    ...next,
    oil_viscosity: viscosity,
    pump_efficiency: efficiency,
    oil_rate: oilRate,
    motor_current: motor,
    energy_consumption: motor * next.vfd_frequency * 0.0105 / Math.max(oilRate / 24, 0.5),
    steam_oil_ratio: next.steam_volume / Math.max(oilRate * 5.2, 1),
    rod_floating_risk: rodRisk,
    failure_risk: failureRisk,
    heated_radius: Math.max(4, Math.min(28, 4 + (next.reservoir_temperature - 32) * 0.28 + next.steam_volume * 0.012)),
    status: failureRisk >= 0.72 ? "CRITICAL" : failureRisk >= 0.42 ? "ATTENTION" : "NORMAL",
  };
}

export function optimizeLocal(well: Well): Well {
  let best = well;
  let bestScore = -Infinity;
  for (let spm = 4.2; spm <= 7.5; spm += 0.3) {
    for (let frequency = 36; frequency <= 52; frequency += 2) {
      const candidate = recalculate(well, { spm, vfd_frequency: frequency });
      const score = candidate.oil_rate + candidate.pump_efficiency * 45 - candidate.energy_consumption * 1.8 - candidate.rod_floating_risk * 55;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
  }
  return best;
}
