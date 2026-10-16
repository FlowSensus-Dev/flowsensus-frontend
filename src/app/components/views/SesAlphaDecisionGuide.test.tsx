import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SesAlphaDecisionGuide from './SesAlphaDecisionGuide';

describe('SES Alpha Decision Guide', () => {
  it('renders four illustrative ranges with four accessible information buttons', () => {
    const html = renderToStaticMarkup(<SesAlphaDecisionGuide alpha={0.42} />);
    for (const range of ['0.1–0.2', '0.3–0.5', '0.6–0.7', '0.8–1.0']) expect(html).toContain(range);
    for (const label of ['low alpha', 'moderate alpha', 'high alpha', 'very high alpha']) expect(html).toContain(`aria-label="About ${label}"`);
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html).toContain('Illustrative guidance, not fixed allowed settings');
    expect(html).not.toMatch(/Your current setting|role="slider"|type="range"/i);
    expect(html).toContain('Prioritizes Previous Forecast'); expect(html).toContain('Prioritizes New Observation');
    expect(html).toContain('More Stable'); expect(html).toContain('More Responsive');
    expect(html).toContain('Hypothetical: previous 5 days, newest 2 days.');
    expect(html).toContain('α 0.3 → 4.1 days'); expect(html).toContain('α 0.7 → 2.9 days'); expect(html).toContain('α 1.0 → 2.0 days');
  });
  it.each([0.0001, 0.99999, 1])('labels the noninteractive marker with exact saved alpha %s', (alpha) => {
    const html = renderToStaticMarkup(<SesAlphaDecisionGuide alpha={alpha} />);
    expect(html).toContain(`Saved alpha ${alpha}.`);
    expect(html).toContain(`data-saved-alpha="${alpha}"`);
    expect(html).toContain(`left:${alpha * 100}%`);
    expect(html).not.toContain('aria-valuenow');
  });
  it('does not invent a current alpha while settings are unavailable', () => {
    const html = renderToStaticMarkup(<SesAlphaDecisionGuide alpha={null} />);
    expect(html).toContain('Saved alpha unavailable'); expect(html).not.toContain('data-saved-alpha');
  });
});
