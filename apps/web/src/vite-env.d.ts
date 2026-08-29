/// <reference types="vite/client" />

/**
 * Typed environment. Without this `import.meta.env.X` is `any`, which defeats
 * the type-aware lint rules everywhere a config value is read.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
