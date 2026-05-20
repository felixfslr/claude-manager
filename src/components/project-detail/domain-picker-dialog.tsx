"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import type { CloudflareZone } from "@/lib/types";

interface DomainPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onAdded: () => void;
}

export function DomainPickerDialog({
  open,
  onOpenChange,
  projectName,
  onAdded,
}: DomainPickerDialogProps) {
  const [zones, setZones] = useState<CloudflareZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<CloudflareZone | null>(null);
  const [subdomain, setSubdomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"cloudflare" | "manual">("cloudflare");
  const [manualDomain, setManualDomain] = useState("");

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch("/api/cloudflare/zones")
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => {
          if (Array.isArray(data)) setZones(data);
        })
        .catch(() => toast.error("Failed to load Cloudflare zones"))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const fullDomain = selectedZone
    ? subdomain
      ? `${subdomain}.${selectedZone.name}`
      : selectedZone.name
    : "";

  const handleAdd = async () => {
    setSaving(true);
    try {
      const domain = mode === "cloudflare" ? fullDomain : manualDomain.trim();

      if (!domain) {
        toast.error("Enter a domain");
        return;
      }

      // Add to Vercel project
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectName)}/hosting/domains`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add domain");
      }

      // If using Cloudflare, create DNS record pointing to Vercel
      if (mode === "cloudflare" && selectedZone) {
        try {
          await fetch(`/api/cloudflare/zones/${selectedZone.id}/dns`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "CNAME",
              name: subdomain || "@",
              content: "cname.vercel-dns.com",
              proxied: false,
            }),
          });
        } catch {
          toast.warning("Domain added to Vercel but DNS record creation failed");
        }

        // Save zone to hosting config
        const hostingRes = await fetch(
          `/api/projects/${encodeURIComponent(projectName)}/hosting`
        );
        if (hostingRes.ok) {
          const hosting = await hostingRes.json();
          if (hosting) {
            hosting.cloudflareZoneId = selectedZone.id;
            await fetch(
              `/api/projects/${encodeURIComponent(projectName)}/hosting`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(hosting),
              }
            );
          }
        }
      }

      toast.success(`Domain ${domain} added`);
      onOpenChange(false);
      onAdded();
      setSubdomain("");
      setManualDomain("");
      setSelectedZone(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add domain");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Domain</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "cloudflare" ? "default" : "outline"}
              onClick={() => setMode("cloudflare")}
              className="text-xs"
            >
              Cloudflare
            </Button>
            <Button
              size="sm"
              variant={mode === "manual" ? "default" : "outline"}
              onClick={() => setMode("manual")}
              className="text-xs"
            >
              Manual
            </Button>
          </div>

          {mode === "cloudflare" ? (
            <>
              <div className="space-y-2">
                <Label>Zone (Domain)</Label>
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : zones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Cloudflare zones found. Check your API token.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-[160px] overflow-y-auto">
                    {zones.map((z) => (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => setSelectedZone(z)}
                        className={`w-full flex items-center justify-between rounded-md border px-3 py-1.5 text-sm ${
                          selectedZone?.id === z.id
                            ? "border-foreground bg-foreground/5"
                            : "border-border hover:border-foreground/30"
                        }`}
                      >
                        <span>{z.name}</span>
                        {selectedZone?.id === z.id && (
                          <Check className="size-3.5 text-green-500" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedZone && (
                <div className="space-y-2">
                  <Label htmlFor="subdomain">Subdomain (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="subdomain"
                      placeholder="staging"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      .{selectedZone.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Result: {fullDomain}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="manual-domain">Domain</Label>
              <Input
                id="manual-domain"
                placeholder="example.com"
                value={manualDomain}
                onChange={(e) => setManualDomain(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={
              saving ||
              (mode === "cloudflare" && !selectedZone) ||
              (mode === "manual" && !manualDomain.trim())
            }
          >
            {saving && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
            Add Domain
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
