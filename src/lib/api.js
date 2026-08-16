import axios from "axios";

const fallbackApiUrl = "https://flowsensus-backend.onrender.com";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || fallbackApiUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
