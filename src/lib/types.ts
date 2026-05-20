export interface Project {
  name: string;
  path: string;
  gitRemote: string | null;
  description?: string;
  currentBranch?: string;
  lastActivity?: string;
}

export type SessionState = "stopped" | "starting" | "running";

export interface NamedSession {
  name: string;
  state: SessionState;
  bridgeUrl: string | null;
}

export interface SessionStatus {
  projectName: string;
  state: SessionState;
  bridgeUrl: string | null;
  sessions: NamedSession[];
}

export type SessionAction = "start" | "stop" | "restart";

export interface ServerStats {
  uptime: number;
  loadAvg: number[];
  totalMem: number;
  freeMem: number;
  cpuCount: number;
}

export interface FileTreeNode {
  name: string;
  type: "file" | "directory";
  size?: number;
  children?: FileTreeNode[];
}

export interface FileTreeResult {
  tree: FileTreeNode[];
  fileCount: number;
  totalSize: number;
}

export interface GitHubInfo {
  repoName: string;
  visibility: string;
  defaultBranch: string;
  lastCommit: {
    message: string;
    author: string;
    date: string;
  } | null;
  openPrCount: number;
  htmlUrl: string;
}

// Stack Selection
export type Framework =
  | "none"
  | "nextjs"
  | "vite-react"
  | "vite-vue"
  | "vite-svelte"
  | "astro"
  | "remix"
  | "express"
  | "fastapi"
  | "flask"
  | "react-native"
  | "expo";

export type StylingOption = "none" | "tailwind" | "css-modules" | "styled-components";

export interface StackConfig {
  framework: Framework;
  styling: StylingOption;
  typescript: boolean;
  eslint: boolean;
  prettier: boolean;
  shadcnUi: boolean;
}

// Hosting
export type DeploymentTarget = "vercel" | "local";

export interface EnvironmentConfig {
  domain?: string;
  vercelProjectId?: string;
  vercelDeploymentUrl?: string;
  envVars: Record<string, string>;
  deploymentTarget: DeploymentTarget;
  cloudflareTunnelId?: string;
  localPort?: number;
}

export interface HostingConfig {
  environments: {
    production: EnvironmentConfig;
    staging: EnvironmentConfig;
  };
  cloudflareZoneId?: string;
  vercelProjectId?: string;
}

// Vercel
export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  latestDeployment?: VercelDeployment;
}

export interface VercelDeployment {
  id: string;
  url: string;
  state: string;
  createdAt: string;
}

// Cloudflare
export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

export interface CloudflareTunnel {
  id: string;
  name: string;
  status: string;
}

// Settings
export interface AppSettings {
  vercelToken?: string;
  githubToken?: string;
  cloudflareApiToken?: string;
  cloudflareAccountId?: string;
  supabaseAccessToken?: string;
  elevenlabsApiKey?: string;
}

// Git Operations
export interface GitBranch {
  name: string;
  current: boolean;
  lastCommitDate: string;
  lastCommitMessage: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  filesChanged?: number;
}

export interface GitDiffFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  patch: string;
}

export interface GitStash {
  index: number;
  message: string;
  date: string;
}

export interface GitSnapshot {
  tag: string;
  description: string;
  date: string;
  hash: string;
}

// GitHub Repos
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  clone_url: string;
  updated_at: string;
  language: string | null;
  default_branch: string;
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
}

// Dependencies
export interface DependencyInfo {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: "dependencies" | "devDependencies";
}

export interface AuditVulnerability {
  name: string;
  severity: "low" | "moderate" | "high" | "critical";
  title: string;
  fixAvailable: boolean;
}

// Templates
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  stack: StackConfig;
  extraPackages: string[];
  claudeMd?: string;
}

// Supabase
export interface SupabaseProject {
  id: string;
  name: string;
  region: string;
  status: string;
}

export interface SupabaseTable {
  schema: string;
  name: string;
  columns: { name: string; type: string; nullable: boolean }[];
}
