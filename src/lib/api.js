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
  async (config) => {
    // Prefer cached token (fast path). If not yet populated, fetch the session
    // once rather than sending a fake token that will 401 in production.
    let token = cachedSessionToken;
    if (!token) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || null;
        if (token) cachedSessionToken = token;
      } catch {
        // getSession() failed (network blip, client not ready, etc.)
        // Fall through with no token — backend will return a clean 401.
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // If still no token, send the request without Authorization.
    // The backend will return a proper 401 the app can handle.

    return config;
  },
  (error) => {
    // If the request fails before leaving the frontend, reject it cleanly
    return Promise.reject(error);
  }
);

export default api;
