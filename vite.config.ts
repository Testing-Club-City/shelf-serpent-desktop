import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { viteStaticCopy } from 'vite-plugin-static-copy';
// @ts-ignore - No types available for these plugins
import wasm from 'vite-plugin-wasm';
// @ts-ignore - No types available for these plugins
import topLevelAwait from 'vite-plugin-top-level-await';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: './', // Use relative paths for all assets
  server: {
    host: "127.0.0.1",
    port: 1421,
    cors: true,
    proxy: {
      '/rest/v1': {
        target: 'https://iqxqmvwxvvbxvvxvvxvv.supabase.co',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    // Copy SQL.js WASM file to public directory
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/sql.js/dist/sql-wasm.wasm',
          dest: ''
        }
      ]
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Enable esbuild optimizations for better performance
    esbuildOptions: {
      target: 'esnext',
      // Ensure Node.js global is available
      define: {
        global: 'globalThis',
      },
    },
    // Explicitly include sql.js for optimization
    include: ['sql.js'],
    // Enable WebAssembly support
    exclude: ['@sqlite.org/sqlite-wasm']
  },
  build: {
    target: 'esnext',
    // Improve build performance and reliability
    minify: true,
    sourcemap: mode === 'development',
    // Ensure WASM files are properly handled
    rollupOptions: {
      // Remove external as these need to be bundled for Tauri
      output: {
        manualChunks: {
          'sql-js': ['sql.js']
        }
      }
    }
  },
}));
