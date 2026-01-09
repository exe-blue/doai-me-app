/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL: string | undefined;
  readonly VITE_API_URL: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css' {
  const content: string;
  export default content;
}

