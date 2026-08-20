import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ command, mode }) => {
  const localPreviewDirectory = loadEnv(mode, process.cwd(), '')
    .HANAFY_LOCAL_PREVIEW_DIR
  const localPreviewPlugin =
    command === 'serve' && localPreviewDirectory
      ? createLocalPreviewPlugin(localPreviewDirectory)
      : null

  return {
  plugins: [
    ...(localPreviewPlugin ? [localPreviewPlugin] : []),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'maskable-icon-512x512.png',
      ],
      manifest: {
        id: '/',
        name: 'Hanafy - Hana & Cramble',
        short_name: 'Hanafy',
        description: 'Two gentle habit adventures for Hana and Cramble.',
        theme_color: '#fffaf0',
        background_color: '#fffaf0',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['health', 'lifestyle', 'productivity'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  }
})

function createLocalPreviewPlugin(directory: string): Plugin {
  return {
    name: 'hanafy-local-production-content-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__hanafy-local-preview', async (_request, response) => {
        try {
          const [hana, cramble] = await Promise.all([
            readPreviewProfile(join(directory, 'hana.json')),
            readPreviewProfile(join(directory, 'cramble.json')),
          ])
          response.statusCode = 200
          response.setHeader('Cache-Control', 'no-store')
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ hana, cramble }))
        } catch (error) {
          console.warn('Could not serve the local Hanafy preview.', error)
          response.statusCode = 404
          response.end('Local preview unavailable')
        }
      })
    },
  }
}

async function readPreviewProfile(path: string) {
  const payload = JSON.parse(await readFile(path, 'utf8'))
  const state = payload?.snapshot?.state
  if (!state || !Array.isArray(state.openActivities)) {
    throw new Error(`Invalid local preview snapshot: ${path}`)
  }

  const openActivities = state.openActivities.map((activity: Record<string, unknown>) => ({
    id: activity.id,
    custom: true,
    title: activity.title,
    description: activity.description,
    color: activity.color,
    kind: activity.kind,
    unit: activity.unit ?? null,
    createdDate: activity.createdDate,
  }))

  return {
    openActivities,
    todayCounts: state.openActivityLogs?.[state.currentDate] ?? {},
  }
}
