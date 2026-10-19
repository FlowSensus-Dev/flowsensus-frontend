import React, { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const guidance = [
  {
    label: 'Low Alpha', range: '0.1–0.2',
    description: 'More stable; responds slowly to new observations.',
    detail: 'Useful when agency operations are stable and a few applicant processing durations fluctuate unusually. An isolated long or short processing time should not drastically alter the forecast.',
  },
  {
    label: 'Moderate Alpha', range: '0.3–0.5',
    description: 'Balances historical forecasts with recent observations.',
    detail: 'Useful during normal recruitment operations where processing durations fluctuate but no major sustained operational change has occurred.',
  },
  {
    label: 'High Alpha', range: '0.6–0.7',
    description: 'Responds faster to sustained operational changes.',
    detail: 'Hypothetical example: a prolonged DMW or passport-processing disruption consistently changes actual durations. Higher alpha adapts subsequent forecasts faster as newly completed cases are recorded. Alpha cannot predict an outage before observations arrive. Represent a one-day disruption with a specific Delay Reason.',
  },
  {
    label: 'Very High Alpha', range: '0.8–1.0',
    description: 'Extremely responsive, but sensitive to unusual cases.',
    detail: 'At alpha 0.9, the newest observation has 90% weight and the previous forecast has 10%. At alpha 1.0, SES follows the newest observation entirely. An unusual newest case can cause sharp fluctuations; higher alpha is not universally better or more accurate.',
  },
];

export function AlphaGuideInfo({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Tooltip open={open} onOpenChange={setOpen}>
    <TooltipTrigger asChild>
      <button type="button" aria-label={`About ${label.toLowerCase()}`} onClick={(event) => {
        // Radix normally closes on click; allow mouse, touch and keyboard activation to toggle instead.
        event.preventDefault();
        setOpen(!open);
      }} className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-semibold text-slate-500 hover:border-sky-500 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
        <span aria-hidden="true">i</span>
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" sideOffset={6} collisionPadding={12}
      className="max-w-[min(20rem,calc(100vw-1.5rem))] max-h-[70vh] overflow-y-auto bg-slate-900 text-white text-left text-xs leading-relaxed">
      {children}
    </TooltipContent>
  </Tooltip>;
}

export default function SesAlphaDecisionGuide({ alpha }: { alpha: number | null }) {
  const savedAlpha = typeof alpha === 'number' && Number.isFinite(alpha) && alpha > 0 && alpha <= 1 ? alpha : null;
  return <aside aria-label="SES Alpha Decision Guide" className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
    <h4 className="font-bold text-sm text-slate-900">SES Alpha Decision Guide</h4>
    <div className="space-y-2">
      <div className="flex justify-between gap-4 text-[11px] font-medium text-slate-600">
        <span>Prioritizes Previous Forecast</span><span className="text-right">Prioritizes New Observation</span>
      </div>
      <div role="img" aria-label={savedAlpha === null ? 'Alpha priority: previous forecast to new observation. Saved alpha unavailable.' : `Alpha priority: previous forecast to new observation. Saved alpha ${String(savedAlpha)}.`}>
        <div className="relative mx-1 h-1.5 rounded-full bg-gradient-to-r from-slate-300 to-sky-500" aria-hidden="true">
          {savedAlpha !== null && <span data-saved-alpha={String(savedAlpha)} style={{ left: `${savedAlpha * 100}%` }} className="absolute -top-1 h-3.5 w-1.5 -translate-x-1/2 rounded-full border border-white bg-slate-800" />}
        </div>
      </div>
      <div className="flex justify-between gap-4 text-[11px] text-slate-500"><span>More Stable</span><span>More Responsive</span></div>
    </div>
    <div className="divide-y divide-slate-200">
      {guidance.map((item) => <div key={item.label} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-semibold text-slate-800">{item.label} <span className="font-mono font-normal text-slate-500">({item.range})</span></p>
          <p className="text-slate-500 mt-0.5">{item.description}</p>
        </div>
        <AlphaGuideInfo label={item.label}>{item.detail}</AlphaGuideInfo>
      </div>)}
    </div>
    <p className="text-[11px] text-slate-500">Illustrative guidance, not fixed allowed settings. Supported alpha: greater than 0 and at most 1.</p>
    <div className="border-t border-slate-200 pt-2 space-y-1 text-[11px] text-slate-600">
      <p>New Forecast = Alpha × New Actual Duration + (1 − Alpha) × Previous Forecast</p>
      <p>Hypothetical: previous 5 days, newest 2 days.</p>
      <p className="font-mono">α 0.3 → 4.1 days · α 0.7 → 2.9 days · α 1.0 → 2.0 days</p>
    </div>
  </aside>;
}
