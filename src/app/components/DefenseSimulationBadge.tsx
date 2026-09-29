export default function DefenseSimulationBadge({ isSimulation }: { isSimulation?: boolean }) {
  return isSimulation === true ? <p className="inline-flex rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">Defense Simulation — Simulated Forecast</p> : null;
}
