export function computeCB(targetGPerMJ: number, actualGPerMJ: number, fuelConsumptionT: number) {
  const ENERGY_PER_T = 41000; // MJ per tonne
  const energyMJ = fuelConsumptionT * ENERGY_PER_T;
  const cbG = (targetGPerMJ - actualGPerMJ) * energyMJ; // grams CO2e
  const cbTonnes = cbG / 1_000_000;
  return { energyMJ, cbG, cbTonnes };
}
