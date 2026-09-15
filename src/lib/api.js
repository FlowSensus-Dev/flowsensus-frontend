import axios from "axios";
import { supabase } from "./supabase"; // <-- We import your Supabase client here

const fallbackApiUrl = "http://localhost:8000";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || fallbackApiUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🚀 THE INTERCEPTOR: Runs automatically before every single backend request
api.interceptors.request.use(
  async (config) => {
    try {
      // 1. Ask Supabase if there is a currently logged-in user
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Error fetching Supabase session:", error.message);
      }

      // 2. If session exists and is expired or close to expiry (within 60s), refresh it
      let activeToken = session?.access_token;
      if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) {
        try {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed?.session?.access_token) {
            activeToken = refreshed.session.access_token;
          }
        } catch (re) {
          console.warn("Could not proactively refresh token:", re);
        }
      }

      // 3. Attach secure token if available, otherwise attach dev_token fallback
      if (activeToken) {
        config.headers.Authorization = `Bearer ${activeToken}`;
      } else {
        config.headers.Authorization = `Bearer dev_token`;
      }
    } catch (err) {
      console.warn("Session interceptor fallback:", err);
      config.headers.Authorization = `Bearer dev_token`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 🔄 RESPONSE INTERCEPTOR: Automatically recovers from 401s so data retrieval never breaks
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData?.session?.access_token) {
          originalRequest.headers.Authorization = `Bearer ${refreshData.session.access_token}`;
          return api(originalRequest);
        }
      } catch (e) {
        console.warn("Session refresh after 401 failed:", e);
      }

      // Fallback to dev_token on 401 so the UI stays operational in dev
      originalRequest.headers.Authorization = `Bearer dev_token`;
      return api(originalRequest);
    }
    return Promise.reject(error);
  }
);

export default api;