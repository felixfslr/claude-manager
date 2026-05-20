"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface TokenField {
  key: string;
  label: string;
  service: string;
  placeholder: string;
  description: string;
}

const TOKEN_FIELDS: TokenField[] = [
  {
    key: "githubToken",
    label: "GitHub Token",
    service: "github",
    placeholder: "ghp_xxxxxxxxxxxx",
    description: "Personal access token with repo scope",
  },
  {
    key: "vercelToken",
    label: "Vercel Token",
    service: "vercel",
    placeholder: "xxxxxxxxxxxxxxxx",
    description: "Account token from vercel.com/account/tokens",
  },
  {
    key: "cloudflareApiToken",
    label: "Cloudflare API Token",
    service: "cloudflare",
    placeholder: "xxxxxxxxxxxxxxxx",
    description: "API token with Zone and DNS permissions",
  },
  {
    key: "cloudflareAccountId",
    label: "Cloudflare Account ID",
    service: "",
    placeholder: "xxxxxxxxxxxxxxxx",
    description: "Found in Cloudflare dashboard overview",
  },
  {
    key: "supabaseAccessToken",
    label: "Supabase Access Token",
    service: "supabase",
    placeholder: "sbp_xxxxxxxxxxxx",
    description: "Access token from supabase.com/dashboard/account/tokens",
  },
  {
    key: "elevenlabsApiKey",
    label: "ElevenLabs API Key",
    service: "",
    placeholder: "xxxxxxxxxxxxxxxx",
    description: "Used by the voice-input mic button (scribe_v2 STT, default language: de)",
  },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [masked, setMasked] = useState<Record<string, string>>({});
  const [configured, setConfigured] = useState<string[]>([]);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; info?: string }>>({});
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setMasked(data.settings);
        setConfigured(data.configured);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: values[key] }),
      });
      if (res.ok) {
        const data = await res.json();
        setMasked(data.settings);
        setConfigured(data.configured);
        setEditing((prev) => ({ ...prev, [key]: false }));
        setValues((prev) => ({ ...prev, [key]: "" }));
        setTestResults((prev) => ({ ...prev, [key]: undefined! }));
        toast.success("Token saved");
      } else {
        toast.error("Failed to save token");
      }
    } catch {
      toast.error("Failed to save token");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (service: string, key: string) => {
    if (!service) return;
    setTesting((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [key]: data }));
      if (data.ok) {
        toast.success(`Connected: ${data.info}`);
      } else {
        toast.error(`Connection failed: ${data.error}`);
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [key]: { ok: false } }));
      toast.error("Test failed");
    } finally {
      setTesting((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon-xs">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage API tokens for integrations
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {TOKEN_FIELDS.map((field) => {
          const isConfigured = configured.includes(field.key);
          const isEditing = editing[field.key];
          const isVisible = visible[field.key];
          const testResult = testResults[field.key];

          return (
            <div
              key={field.key}
              className="rounded-lg border border-border p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">{field.label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {field.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isConfigured && !isEditing && (
                    <span className="flex items-center gap-1 text-xs text-green-500">
                      <Check className="size-3" />
                      Set
                    </span>
                  )}
                  {testResult && (
                    <span
                      className={`flex items-center gap-1 text-xs ${testResult.ok ? "text-green-500" : "text-red-500"}`}
                    >
                      {testResult.ok ? (
                        <Check className="size-3" />
                      ) : (
                        <X className="size-3" />
                      )}
                    </span>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={isVisible ? "text" : "password"}
                        placeholder={field.placeholder}
                        value={values[field.key] || ""}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setVisible((prev) => ({
                            ...prev,
                            [field.key]: !prev[field.key],
                          }))
                        }
                      >
                        {isVisible ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(field.key)}
                      disabled={saving || !values[field.key]?.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing((prev) => ({ ...prev, [field.key]: false }));
                        setValues((prev) => ({ ...prev, [field.key]: "" }));
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {isConfigured && (
                    <span className="text-sm font-mono text-muted-foreground">
                      {masked[field.key]}
                    </span>
                  )}
                  <div className="flex gap-2 ml-auto">
                    {field.service && isConfigured && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTest(field.service, field.key)}
                        disabled={testing[field.key]}
                      >
                        {testing[field.key] ? (
                          <Loader2 className="size-3 animate-spin" data-icon="inline-start" />
                        ) : null}
                        Test
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditing((prev) => ({ ...prev, [field.key]: true }))
                      }
                    >
                      {isConfigured ? "Change" : "Set"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
