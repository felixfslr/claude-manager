import fs from "fs/promises";
import path from "path";
import { runCommand } from "./shell";
import { FRAMEWORK_META } from "./framework-meta";
import type { StackConfig } from "./types";

export { FRAMEWORK_META };

const SCAFFOLD_TIMEOUT = 120000;
const BUMP_TIMEOUT = 180000;

/**
 * Post-scaffold hook: bumps every dependency in package.json past its semver
 * range to the latest published version, then runs npm install. Framework
 * scaffolders (create-next-app, create-vite, create-astro, ...) lock deps to
 * versions that were "current" when their CLI was published, not the literal
 * latest. This step closes that gap. Failures are non-fatal — we keep whatever
 * versions the scaffolder shipped and log a warning.
 */
export async function bumpToLatest(projectPath: string): Promise<void> {
  try {
    await fs.access(path.join(projectPath, "package.json"));
  } catch {
    return;
  }
  try {
    await runCommand("npx -y npm-check-updates -u", {
      cwd: projectPath,
      timeout: BUMP_TIMEOUT,
    });
    await runCommand("npm install", {
      cwd: projectPath,
      timeout: BUMP_TIMEOUT,
    });
  } catch (err) {
    console.warn(
      `[scaffold] bumpToLatest failed for ${projectPath}:`,
      err instanceof Error ? err.message : err
    );
  }
}

async function scaffoldNextjs(projectPath: string, name: string, stack: StackConfig): Promise<void> {
  const flags = [
    "--yes",
    stack.typescript ? "--ts" : "--js",
    stack.styling === "tailwind" ? "--tailwind" : "--no-tailwind",
    stack.eslint ? "--eslint" : "--no-eslint",
    "--app",
    "--src-dir",
    "--no-import-alias",
  ];
  const parentDir = path.dirname(projectPath);
  await runCommand(`npx create-next-app@latest "${name}" ${flags.join(" ")}`, {
    cwd: parentDir,
    timeout: SCAFFOLD_TIMEOUT,
  });
}

async function scaffoldVite(projectPath: string, name: string, variant: string, stack: StackConfig): Promise<void> {
  const template = stack.typescript ? `${variant}-ts` : variant;
  const parentDir = path.dirname(projectPath);
  await runCommand(`npm create vite@latest "${name}" -- --template ${template}`, {
    cwd: parentDir,
    timeout: SCAFFOLD_TIMEOUT,
  });
  await runCommand("npm install", { cwd: projectPath, timeout: SCAFFOLD_TIMEOUT });
}

async function scaffoldAstro(projectPath: string, name: string, stack: StackConfig): Promise<void> {
  const parentDir = path.dirname(projectPath);
  await runCommand(
    `npm create astro@latest -- "${name}" --template minimal --yes --install ${stack.typescript ? "--typescript strict" : "--no-typescript"}`,
    { cwd: parentDir, timeout: SCAFFOLD_TIMEOUT }
  );
}

async function scaffoldRemix(projectPath: string, name: string): Promise<void> {
  const parentDir = path.dirname(projectPath);
  await runCommand(`npx create-remix@latest "${name}" --yes`, {
    cwd: parentDir,
    timeout: SCAFFOLD_TIMEOUT,
  });
}

async function scaffoldExpress(projectPath: string, stack: StackConfig): Promise<void> {
  await fs.mkdir(projectPath, { recursive: true });
  await runCommand("npm init -y", { cwd: projectPath, timeout: 30000 });

  if (stack.typescript) {
    await runCommand("npm install express@latest && npm install -D typescript@latest @types/express@latest @types/node@latest ts-node@latest", {
      cwd: projectPath,
      timeout: SCAFFOLD_TIMEOUT,
    });
    await fs.writeFile(
      path.join(projectPath, "src/index.ts"),
      `import express from "express";\n\nconst app = express();\nconst port = process.env.PORT || 3000;\n\napp.get("/", (_req, res) => {\n  res.json({ message: "Hello World" });\n});\n\napp.listen(port, () => {\n  console.log(\`Server running on port \${port}\`);\n});\n`,
      { recursive: true } as never
    );
    await fs.writeFile(
      path.join(projectPath, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { target: "ES2020", module: "commonjs", outDir: "./dist", rootDir: "./src", strict: true, esModuleInterop: true, skipLibCheck: true }, include: ["src"] }, null, 2)
    );
  } else {
    await runCommand("npm install express@latest", { cwd: projectPath, timeout: SCAFFOLD_TIMEOUT });
    await fs.mkdir(path.join(projectPath, "src"), { recursive: true });
    await fs.writeFile(
      path.join(projectPath, "src/index.js"),
      `const express = require("express");\n\nconst app = express();\nconst port = process.env.PORT || 3000;\n\napp.get("/", (_req, res) => {\n  res.json({ message: "Hello World" });\n});\n\napp.listen(port, () => {\n  console.log(\`Server running on port \${port}\`);\n});\n`
    );
  }
}

async function scaffoldFastAPI(projectPath: string): Promise<void> {
  await fs.mkdir(projectPath, { recursive: true });
  await runCommand("python3 -m venv venv", { cwd: projectPath, timeout: 30000 });
  await runCommand("./venv/bin/pip install fastapi uvicorn", { cwd: projectPath, timeout: SCAFFOLD_TIMEOUT });
  await fs.writeFile(
    path.join(projectPath, "main.py"),
    `from fastapi import FastAPI\n\napp = FastAPI()\n\n\n@app.get("/")\ndef root():\n    return {"message": "Hello World"}\n`
  );
  await fs.writeFile(
    path.join(projectPath, "requirements.txt"),
    "fastapi\nuvicorn\n"
  );
}

async function scaffoldFlask(projectPath: string): Promise<void> {
  await fs.mkdir(projectPath, { recursive: true });
  await runCommand("python3 -m venv venv", { cwd: projectPath, timeout: 30000 });
  await runCommand("./venv/bin/pip install flask", { cwd: projectPath, timeout: SCAFFOLD_TIMEOUT });
  await fs.writeFile(
    path.join(projectPath, "app.py"),
    `from flask import Flask\n\napp = Flask(__name__)\n\n\n@app.route("/")\ndef root():\n    return {"message": "Hello World"}\n\n\nif __name__ == "__main__":\n    app.run(debug=True)\n`
  );
  await fs.writeFile(
    path.join(projectPath, "requirements.txt"),
    "flask\n"
  );
}

async function scaffoldReactNative(projectPath: string, name: string): Promise<void> {
  const parentDir = path.dirname(projectPath);
  await runCommand(`npx @react-native-community/cli init "${name}" --skip-install`, {
    cwd: parentDir,
    timeout: SCAFFOLD_TIMEOUT,
  });
  await runCommand("npm install", { cwd: projectPath, timeout: SCAFFOLD_TIMEOUT });
}

async function scaffoldExpo(projectPath: string, name: string): Promise<void> {
  const parentDir = path.dirname(projectPath);
  await runCommand(`npx create-expo-app@latest "${name}" --no-install`, {
    cwd: parentDir,
    timeout: SCAFFOLD_TIMEOUT,
  });
  await runCommand("npm install", { cwd: projectPath, timeout: SCAFFOLD_TIMEOUT });
}

export async function scaffoldProject(
  projectPath: string,
  name: string,
  stack: StackConfig,
  useLatestDependencies: boolean = true
): Promise<void> {
  // Run main scaffold
  switch (stack.framework) {
    case "nextjs":
      await scaffoldNextjs(projectPath, name, stack);
      break;
    case "vite-react":
      await scaffoldVite(projectPath, name, "react", stack);
      break;
    case "vite-vue":
      await scaffoldVite(projectPath, name, "vue", stack);
      break;
    case "vite-svelte":
      await scaffoldVite(projectPath, name, "svelte", stack);
      break;
    case "astro":
      await scaffoldAstro(projectPath, name, stack);
      break;
    case "remix":
      await scaffoldRemix(projectPath, name);
      break;
    case "express":
      await scaffoldExpress(projectPath, stack);
      break;
    case "fastapi":
      await scaffoldFastAPI(projectPath);
      break;
    case "flask":
      await scaffoldFlask(projectPath);
      break;
    case "react-native":
      await scaffoldReactNative(projectPath, name);
      break;
    case "expo":
      await scaffoldExpo(projectPath, name);
      break;
    case "none":
      await fs.mkdir(projectPath, { recursive: true });
      break;
  }

  const meta = FRAMEWORK_META[stack.framework];

  // Post-scaffold: Tailwind (for frameworks that don't include it natively)
  if (stack.styling === "tailwind" && meta.supportsStyling && stack.framework !== "nextjs") {
    try {
      await runCommand("npm install -D tailwindcss@latest @tailwindcss/vite@latest", {
        cwd: projectPath,
        timeout: 60000,
      });
    } catch {
      // Some frameworks handle tailwind differently
    }
  }

  // Post-scaffold: Prettier
  if (stack.prettier && meta.category !== "backend") {
    try {
      await runCommand("npm install -D prettier@latest", { cwd: projectPath, timeout: 30000 });
      await fs.writeFile(path.join(projectPath, ".prettierrc"), "{}");
    } catch {
      // ignore
    }
  }

  // Post-scaffold: shadcn/ui
  if (stack.shadcnUi && meta.supportsShadcn) {
    try {
      await runCommand("npx shadcn@latest init --yes --defaults", {
        cwd: projectPath,
        timeout: 60000,
      });
    } catch {
      // ignore
    }
  }

  // Final pass: bump every dep past the framework's pinned semver to true latest.
  if (useLatestDependencies) {
    await bumpToLatest(projectPath);
  }
}
