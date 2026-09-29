import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { transform } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const clientUrl = url('export const calls = []; export let response; export function respond(value) { response = value; } export const api = { post: async (...args) => { calls.push(["post", ...args]); return response; }, delete: async (...args) => { calls.push(["delete", ...args]); return response; } };');
const client = await import(clientUrl);
const apiUrl = url(stripTypeScriptTypes(read('../src/app/defenseSimulation.ts')).replace("'../lib/api'", JSON.stringify(clientUrl)));
const simulator = await import(apiUrl);
async function component(path, replacements = {}) {
  let { code } = await transform(read(path), { loader: 'tsx', jsx: 'automatic', format: 'esm' });
  for (const [name, target] of Object.entries({ react: import.meta.resolve('react'), 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), ...replacements })) code = code.replaceAll(JSON.stringify(name), JSON.stringify(target));
  return url(code);
}
const badgeUrl = await component('../src/app/components/DefenseSimulationBadge.tsx');
const { default: Badge } = await import(badgeUrl);
const { default: Simulator, SimulationResult } = await import(await component('../src/app/components/ForecastingDefenseSimulator.tsx', {
  '../defenseSimulation': apiUrl, './DefenseSimulationBadge': badgeUrl,
}));
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const forecast = { application_id: 91, agency_id: 2, is_simulation: true, current_stage: 'Medical', days_spent_in_current_stage: 3,
  stage_breakdown: {}, limitations: ['Demo estimate'], record: { estimated_remaining_days: 17, estimated_deployment_date: '2026-10-17' } };

test('POST sends only elapsed_days_override and returns the backend forecast', async () => {
  client.calls.length = 0;
  client.respond({ data: forecast });
  assert.deepEqual(await simulator.generateSimulation(91, 3), forecast);
  assert.deepEqual(client.calls, [['post', '/forecasting/application/91/simulation', { elapsed_days_override: 3 }]]);
});
test('accepts elapsed-day boundaries; rejects invalid values and IDs before dispatch', async () => {
  client.respond({ data: forecast });
  await simulator.generateSimulation(91, 0);
  await simulator.generateSimulation(91, 36500);
  client.calls.length = 0;
  for (const id of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(simulator.generateSimulation(id, 3));
    await assert.rejects(simulator.clearSimulation(id));
  }
  for (const days of [-1, 36501, NaN, Infinity]) await assert.rejects(simulator.generateSimulation(91, days));
  assert.equal(client.calls.length, 0);
});
test('rejects a response for a different application', async () => {
  client.respond({ data: { ...forecast, application_id: 92 } });
  await assert.rejects(simulator.generateSimulation(91, 3), /does not match/);
});
test('DELETE handles 204 without parsing a body', async () => {
  client.calls.length = 0;
  client.respond({ status: 204, data: '' });
  assert.equal(await simulator.clearSimulation(91), undefined);
  assert.deepEqual(client.calls, [['delete', '/forecasting/application/91/simulation']]);
});
test('authorization and eligibility failures have actionable messages', () => {
  for (const [status, pattern] of [[401, /expired/], [403, /Super Admin/], [404, /not found/], [409, /not eligible/], [422, /rejected/]]) {
    assert.match(simulator.simulationError({ response: { status } }), pattern);
  }
});
test('renders returned simulation values and limitations', () => {
  const html = render(SimulationResult, { result: forecast });
  for (const text of ['Defense Simulation', 'Application #91', 'Medical', '17 days', '2026-10-17', 'Demo estimate']) assert.ok(html.includes(text), text);
});
test('normal and legacy forecasts have no simulation badge', () => {
  assert.equal(render(Badge, { isSimulation: false }), '');
  assert.equal(render(Badge, {}), '');
  assert.match(render(Badge, { isSimulation: true }), /Defense Simulation/);
  assert.match(read('../src/app/components/ApplicantPortal.tsx'), /<DefenseSimulationBadge isSimulation=\{result\?\.is_simulation\} \/>/);
});
test('empty simulator has explicit ID entry and disabled actions', () => {
  const html = render(Simulator, { applicants: [] });
  for (const text of ['Temporary defense/demo tool', 'Application ID', 'Elapsed Days Override']) assert.ok(html.includes(text));
  assert.ok(!html.includes('Returned forecast'));
  assert.equal(html.match(/<button[^>]*disabled/g).length, 2);
});
test('selector uses real application IDs, deduplicates, and omits missing IDs', () => {
  const html = render(Simulator, { applicants: [{ id: '7', applicationId: 91, name: 'Test applicant', role: 'Welder' }, { id: '7', applicationId: 91 }, { id: '8', name: 'Missing ID' }] });
  assert.equal(html.match(/value="91"/g).length, 1);
  assert.ok(!html.includes('Missing ID'));
});


test('renders forecast basis from PERT and SES', () => {
  const mockPipeline = {
    alpha_used: 0.35,
    stages: [
      { stage_name: 'Medical', pert_baseline: 12.0, current_forecast: 14.5, observation_count: 5, is_fallback: false },
      { stage_name: 'CV & Endorsement', pert_baseline: 6.33, current_forecast: 6.33, observation_count: 0, is_fallback: true },
      { stage_name: 'Under Employer Review', pert_baseline: 16.5, current_forecast: 16.5, observation_count: 0, is_fallback: true },
      { stage_name: 'Final Deployment', pert_baseline: 14.33, current_forecast: 14.33, observation_count: 0, is_fallback: true },
    ]
  };

  const mockResult = {
    application_id: 5,
    current_stage: 'CV & Endorsement',
    days_spent_in_current_stage: 3,
    stage_breakdown: {},
    record: { estimated_remaining_days: 34.16 }
  };

  const html = render(SimulationResult, { result: mockResult, pipeline: mockPipeline });

  // Renders the calculation details
  assert.ok(html.includes('How this forecast was calculated'));
  assert.ok(html.includes('CV &amp; Endorsement'));

  // 6.33 - 3 = 3.33
  assert.ok(html.includes('3.33'));
  assert.ok(html.includes('16.50'));
  assert.ok(html.includes('14.33'));
  assert.ok(html.includes('= 34.16'));
});

test('clamps current stage remaining to zero if elapsed exceeds forecast', () => {
  const mockPipeline = {
    alpha_used: 0.35,
    stages: [
      { stage_name: 'CV & Endorsement', pert_baseline: 6.33, current_forecast: 6.33, observation_count: 0, is_fallback: true },
      { stage_name: 'Under Employer Review', pert_baseline: 16.5, current_forecast: 16.5, observation_count: 0, is_fallback: true }
    ]
  };

  const mockResult = {
    application_id: 5,
    current_stage: 'CV & Endorsement',
    days_spent_in_current_stage: 30, // Exceeds 6.33
    stage_breakdown: {},
    record: { estimated_remaining_days: 16.5 } // Authoritative ETA: 0 + 16.5
  };

  const html = render(SimulationResult, { result: mockResult, pipeline: mockPipeline });

  // Clamps to 0
  assert.ok(html.includes('max(6.33 - 30.00, 0) = 0.00'));

  // Renders the overdue buffer explanation
  assert.ok(html.includes('manager-review escalation buffer'));
  assert.ok(html.includes('+7.00 d'));

  // Backend forecast remains authoritative (does not contain + 7.00 in the main string)
  assert.ok(html.includes('Backend Forecast Remaining'));
  assert.ok(html.includes('0.00 + 16.50'));
  assert.ok(html.includes('= 16.50'));

  // Illustrative projection includes the buffer
  assert.ok(html.includes('Illustrative Buffered Projection'));
  assert.ok(html.includes('= 23.50 d'));
});
