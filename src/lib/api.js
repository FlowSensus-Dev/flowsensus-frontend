import axios from "axios";
import { supabase } from "./supabase"; // <-- We import your Supabase client here

const fallbackApiUrl = "https://flowsensus-backend.onrender.com";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || fallbackApiUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🚀 THE INTERCEPTOR: Runs automatically before every single backend request
api.interceptors.request.use(
  async (config) => {
    // 1. Ask Supabase if there is a currently logged-in user
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.error("Error fetching Supabase session:", error.message);
    }

    // 2. If a user is logged in, grab their secure token and attach it to the request
    if (session && session.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }

    return config;
  },
  (error) => {
    // If the request fails before leaving the frontend, reject it cleanly
    return Promise.reject(error);
  }
);

export default api;