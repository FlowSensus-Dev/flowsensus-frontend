import { api } from '../lib/api';
import type { ApplicationForecastResponse } from './types';

function simulationPath(applicationId: number) {
  if (!Number.isSafeInteger(applicationId) || applicationId <= 0) throw new Error('Enter a valid positive Application ID.');
  return `/forecasting/application/${applicationId}/simulation`;
}

export async function getApplicationForecast(applicationId: number): Promise<ApplicationForecastResponse> {
  if (!Number.isSafeInteger(applicationId) || applicationId <= 0) throw new Error('Enter a valid positive Application ID.');
  const { data } = await api.get(`/forecasting/application/${applicationId}`);
  if (data?.application_id !== applicationId) throw new Error('Forecast response does not match the requested application.');
  return data;
}

export async function getPipelineForecast(): Promise<any> {
  const { data } = await api.get('/forecasting/pipeline');
  return data;
}

export async function generateSimulation(applicationId: number, elapsedDays: number): Promise<ApplicationForecastResponse> {
  const path = simulationPath(applicationId);
  if (!Number.isFinite(elapsedDays) || elapsedDays < 0 || elapsedDays > 36500) throw new Error('Elapsed days must be between 0 and 36500.');
  const { data } = await api.post(path, { elapsed_days_override: elapsedDays });
  if (data?.application_id !== applicationId) throw new Error('Forecast response does not match the requested application.');
  return data;
}

export async function clearSimulation(applicationId: number): Promise<void> {
  await api.delete(simulationPath(applicationId));
}

export function simulationError(error: unknown): string {
  const err = error as { response?: { status?: number; data?: { detail?: unknown } } };
  if (err.response?.status === 401) return 'Your session has expired. Sign in again.';
  if (err.response?.status === 403) return 'Only an authorized Super Admin can manage defense simulations.';
  if (typeof err.response?.data?.detail === 'string') return err.response.data.detail;
  if (err.response?.status === 404) return 'Application or simulation not found. Check the Application ID.';
  if (err.response?.status === 422) return 'The backend rejected these values. Check the Application ID and elapsed days.';
  if (err.response?.status === 409) return 'This application is not eligible for simulation in its current workflow state.';
  return 'Simulation request failed. The server may have received it; refresh the Applicant forecast to check, then retry or clear the simulation.';
}
