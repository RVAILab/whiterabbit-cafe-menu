/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROJECTED_MENU_URL?: string
  readonly VITE_DISPLAY_CONTROL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
