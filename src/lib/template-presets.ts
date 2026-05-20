import type { ProjectTemplate } from "./types";

export const PRESET_TEMPLATES: ProjectTemplate[] = [
  {
    id: "nextjs-fullstack",
    name: "Next.js Full Stack",
    description: "Next.js + Tailwind + shadcn/ui + TypeScript",
    stack: { framework: "nextjs", styling: "tailwind", typescript: true, eslint: true, prettier: true, shadcnUi: true },
    extraPackages: [],
  },
  {
    id: "vite-react-app",
    name: "Vite React App",
    description: "Vite + React + Tailwind + TypeScript",
    stack: { framework: "vite-react", styling: "tailwind", typescript: true, eslint: true, prettier: true, shadcnUi: false },
    extraPackages: [],
  },
  {
    id: "python-fastapi",
    name: "Python FastAPI",
    description: "FastAPI + Uvicorn + Python venv",
    stack: { framework: "fastapi", styling: "none", typescript: false, eslint: false, prettier: false, shadcnUi: false },
    extraPackages: [],
  },
  {
    id: "astro-blog",
    name: "Astro Blog",
    description: "Astro + Tailwind + TypeScript",
    stack: { framework: "astro", styling: "tailwind", typescript: true, eslint: true, prettier: false, shadcnUi: false },
    extraPackages: [],
  },
  {
    id: "express-api",
    name: "Express API",
    description: "Express + TypeScript + Prettier",
    stack: { framework: "express", styling: "none", typescript: true, eslint: false, prettier: true, shadcnUi: false },
    extraPackages: [],
  },
];
