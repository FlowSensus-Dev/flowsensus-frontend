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
});
