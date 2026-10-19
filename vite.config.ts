import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // Raise warning threshold to 1200kB (suitable for enterprise dashboard with PDF export & charts)
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // ── Vendor: PDF Generation (jspdf, html2canvas, etc.) ─────────────
          if (
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/html2canvas') ||
            id.includes('node_modules/canvg') ||
            id.includes('node_modules/fflate')
          ) {
            return 'vendor-pdf';
          }
          // ── Vendor: Material UI & Emotion ─────────────────────────────────
          if (id.includes('node_modules/@mui/') || id.includes('node_modules/@emotion/')) {
            return 'vendor-mui';
          }
          // ── Vendor: Radix UI primitives ───────────────────────────────────
          if (id.includes('node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          // ── Vendor: Motion / Animations ───────────────────────────────────
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          // ── Vendor: Charts / Recharts & D3 ────────────────────────────────
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) {
            return 'vendor-charts';
          }
          // ── Vendor: Supabase ─────────────────────────────────────────────
          if (id.includes('node_modules/@supabase/')) {
            return 'vendor-supabase';
          }
          // ── Vendor: Lucide icons ─────────────────────────────────────────
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          // ── Vendor: Axios ────────────────────────────────────────────────
          if (id.includes('node_modules/axios')) {
            return 'vendor-axios';
          }
          // ── Vendor: React Router ─────────────────────────────────────────
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          // ── Only split large third-party vendor libraries in node_modules ──
          // Application source code (/src/) should not be manually split to prevent circular chunk dependencies
        },
      },
    },
  },
})

