import axios from "axios";
import { supabase } from "./supabase"; // <-- We import your Supabase client here

const fallbackApiUrl = "http://localhost:8000";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || fallbackApiUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

let cachedSessionToken = null;

// Listen to auth changes once and store the session locally
supabase.auth.onAuthStateChange((_event, session) => {
  cachedSessionToken = session?.access_token || null;
});

// Grab initial session immediately without blocking the interceptor
supabase.auth.getSession().then(({ data: { session } }) => {
  if (!cachedSessionToken && session?.access_token) {
    cachedSessionToken = session.access_token;
  }
}).catch(err => console.error("Error fetching initial Supabase session:", err));

// 🚀 THE INTERCEPTOR: Runs automatically before every single backend request
api.interceptors.request.use(
  (config) => {
    // We use the cached token directly (synchronous) instead of awaiting getSession()
    // This prevents cross-tab locking overhead and massive request latency.
    if (cachedSessionToken) {
      config.headers.Authorization = `Bearer ${cachedSessionToken}`;
    } else {
      config.headers.Authorization = `Bearer dev_token`;
    }

    return config;
  },
  (error) => {
    // If the request fails before leaving the frontend, reject it cleanly
    return Promise.reject(error);
  }
);

export default api;