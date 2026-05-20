import type { Framework } from "./types";

interface FrameworkMeta {
  label: string;
  category: "web" | "backend" | "mobile";
  supportsTypescript: boolean;
  supportsStyling: boolean;
  supportsShadcn: boolean;
}

export const FRAMEWORK_META: Record<Framework, FrameworkMeta> = {
  none: { label: "Empty Project", category: "web", supportsTypescript: false, supportsStyling: false, supportsShadcn: false },
  nextjs: { label: "Next.js", category: "web", supportsTypescript: true, supportsStyling: true, supportsShadcn: true },
  "vite-react": { label: "Vite + React", category: "web", supportsTypescript: true, supportsStyling: true, supportsShadcn: true },
  "vite-vue": { label: "Vite + Vue", category: "web", supportsTypescript: true, supportsStyling: true, supportsShadcn: false },
  "vite-svelte": { label: "Vite + Svelte", category: "web", supportsTypescript: true, supportsStyling: true, supportsShadcn: false },
  astro: { label: "Astro", category: "web", supportsTypescript: true, supportsStyling: true, supportsShadcn: true },
  remix: { label: "Remix", category: "web", supportsTypescript: true, supportsStyling: true, supportsShadcn: true },
  express: { label: "Express", category: "backend", supportsTypescript: true, supportsStyling: false, supportsShadcn: false },
  fastapi: { label: "FastAPI", category: "backend", supportsTypescript: false, supportsStyling: false, supportsShadcn: false },
  flask: { label: "Flask", category: "backend", supportsTypescript: false, supportsStyling: false, supportsShadcn: false },
  "react-native": { label: "React Native", category: "mobile", supportsTypescript: true, supportsStyling: false, supportsShadcn: false },
  expo: { label: "Expo", category: "mobile", supportsTypescript: true, supportsStyling: false, supportsShadcn: false },
};

export type { FrameworkMeta };
