import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import axios from 'axios';

// Run the actual typed data layer using Node 24, without Vite or environment files.
const requests = [];
let respond;
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  requests.push(config);
  return { data: await respond(config), status: 200, statusText: 'OK', headers: {}, config };
};
const source = stripTypeScriptTypes(readFileSync(new URL('../src/app/portal.ts', import.meta.url), 'utf8'))
  .replace("from 'axios'", `from '${import.meta.resolve('axios')}'`)
  .replaceAll('import.meta.env', '({})');
const portal = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
axios.defaults.adapter = originalAdapter;

const profile = { applicant_id: 7, agency_id: 2 };
const application = { application_id: 91, applicant_id: 7 };
const signal = () => new AbortController().signal;

test('normal forecasting GET preserves backend simulation and normal forecast flags', async () => {
  for (const is_simulation of [true, false, undefined]) {
    const forecast = { application_id: 91, applicant_id: 7, agency_id: 2, is_simulation, record: null, limitations: [] };
    respond = () => forecast;
    assert.deepEqual(await portal.loadPortalForecast(91, profile, 'session-token', signal()), forecast);
    assert.equal(requests.at(-1).url, '/forecasting/application/91');
    assert.equal(requests.at(-1).method, 'get');
  }
});

test('profile and applications are requested without frontend ownership parameters', async () => {
  requests.length = 0;
  respond = config => config.url.endsWith('/applications') ? [application] : profile;
  assert.deepEqual(await portal.loadPortal('session-token', signal()), { profile, applications: [application] });
  assert.deepEqual(requests.map(r => r.url), ['/applicants/me', '/applicants/me/applications']);
  for (const request of requests) {
    assert.equal(request.headers.Authorization, 'Bearer session-token');
    assert.equal(request.params, undefined);
    assert.equal(request.method, 'get');
  }
});

test('forecast uses application 91, not applicant 7, and validates response ownership', async () => {
  requests.length = 0;
  respond = () => ({ application_id: 91, applicant_id: 7, agency_id: 2, record: null, limitations: [] });
  await portal.loadPortalForecast(91, profile, 'session-token', signal());
  assert.equal(requests[0].url, '/forecasting/application/91');
  respond = () => ({ application_id: 92, applicant_id: 7, agency_id: 2 });
  await assert.rejects(portal.loadPortalForecast(91, profile, 'session-token', signal()), /identity mismatch/);
});

test('invalid IDs and missing session cannot dispatch a request', async () => {
  requests.length = 0;
  for (const id of [null, undefined, '91', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(portal.loadPortalForecast(id, profile, 'session-token', signal()));
  }
  await assert.rejects(portal.loadPortal('' , signal()));
  assert.equal(requests.length, 0);
});

test('application response rejects wrong owner, duplicate IDs and malformed lists', () => {
  portal.validateApplications(profile, []);
  portal.validateApplications(profile, [application, { ...application, application_id: 92 }]);
  for (const rows of [null, {}, [application, application], [{ ...application, applicant_id: 8 }]]) {
    assert.throws(() => portal.validateApplications(profile, rows));
  }
});

test('forecast rejects foreign tenant and mismatched nested records', () => {
  const forecast = { application_id: 91, applicant_id: 7, agency_id: 2 };
  assert.throws(() => portal.validateForecast({ ...forecast, agency_id: 3 }, 91, profile));
  assert.throws(() => portal.validateForecast({ ...forecast, record: { ...forecast, applicant_id: 8 } }, 91, profile));
});

test('aborted requests cannot resolve after an application or account switch', async () => {
  let release;
  respond = () => new Promise(resolve => { release = resolve; });
  const controller = new AbortController();
  const pending = portal.loadPortalForecast(91, profile, 'session-token', controller.signal);
  controller.abort();
  release({ application_id: 91, applicant_id: 7, agency_id: 2 });
  await assert.rejects(pending, error => axios.isCancel(error));
});

test('terminal status uses backend evidence, never phase alone', () => {
  for (const application_status of ['Deployed', 'Completed', 'Contract Completed', 'Returned']) {
    assert.equal(portal.completedApplication({ application_status }), true);
  }
  assert.equal(portal.completedApplication({ actual_deployment_at: '2026-09-01' }), true);
  assert.equal(portal.completedApplication({ current_phase: 5, application_status: 'Processing' }), false);
});

test('HTTP failures produce actionable and distinct portal notices', () => {
  const error = status => ({ isAxiosError: true, response: { status } });
  assert.match(portal.portalError(error(401)), /session has expired/);
  assert.match(portal.portalError(error(403)), /account link/);
  assert.match(portal.portalError(error(404), true), /not found/);
  assert.match(portal.portalError(error(409), true), /not available/);
  assert.match(portal.portalError(error(503), true), /try again/);
});
