
declare module '*.css';

// Add this for Kakao env vars
interface ImportMetaEnv {
  readonly VITE_KAKAO_REST_API_KEY: string;
  readonly VITE_KAKAO_REDIRECT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}