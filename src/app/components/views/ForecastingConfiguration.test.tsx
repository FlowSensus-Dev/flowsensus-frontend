import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../lib/api', () => ({ api: {} }));
import ForecastingConfiguration from './ForecastingConfiguration';

describe('collapsible configuration structure', () => {
  it('uses native keyboard-operable details for the group and both subsections without unmounting their contents', () => {
    const html = renderToStaticMarkup(<ForecastingConfiguration canEdit={false} onAlphaSaved={async () => {}}
      reasons={[]} stages={[]} loading={false} error={null} refresh={async () => true} />);
    expect(html.match(/<details/g)).toHaveLength(3);
    expect(html.match(/<summary/g)).toHaveLength(3);
    expect(html).not.toContain('<details open');
    expect(html).toContain('Forecasting Configuration'); expect(html).toContain('Agency SES Settings');
    expect(html).toContain('Delay Reason Management'); expect(html).toContain('No delay reasons configured.');
    expect(html).toContain('SES Alpha Decision Guide');
    expect(html).not.toContain('Edit Alpha'); expect(html).not.toContain('+ Add Delay Reason');
  });
  it('adds a Manager-only PERT section and concise expandable guide while retaining existing sections', () => {
    const html = renderToStaticMarkup(<ForecastingConfiguration canEdit onAlphaSaved={async () => {}}
      reasons={[]} stages={[]} loading={false} error={null} refresh={async () => true} />);
    expect(html).toContain('PERT Configuration'); expect(html).toContain('PERT guide for Managers');
    expect(html).toContain('Program Evaluation and Review Technique'); expect(html).toContain('6 days');
    expect(html).toContain('cold-start'); expect(html).toContain('does not erase learned SES');
    expect(html).toContain('Agency SES Settings'); expect(html).toContain('SES Alpha Decision Guide');
    expect(html).toContain('Delay Reason Management'); expect(html).toContain('No delay reasons configured.');
    expect(html.match(/<details/g)).toHaveLength(5);
    expect(html).not.toContain('<details open');
  });
});
