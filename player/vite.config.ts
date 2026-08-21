import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode === 'production') {
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
    const requiredEndpoints = ['VITE_PROJECTED_MENU_URL', 'VITE_DISPLAY_CONTROL_URL'] as const
    const missing = requiredEndpoints.filter((name) => !env[name]?.trim())
    const legacySanityVariables = Object.keys(env).filter((name) => name.startsWith('VITE_SANITY_'))

    if (missing.length > 0) {
      throw new Error(
        `Production player build requires ${missing.join(' and ')}. `
        + 'Configure the deployed WR-POS endpoints explicitly.',
      )
    }

    if (legacySanityVariables.length > 0) {
      throw new Error(
        `Production player build refuses legacy client-side Sanity variables: ${legacySanityVariables.join(', ')}. `
        + 'Remove them from the build environment so Vite cannot expose their values in the browser bundle.',
      )
    }
  }

  return {
    plugins: [react()],
  }
})
