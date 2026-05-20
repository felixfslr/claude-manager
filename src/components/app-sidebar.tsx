"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ServerStatsWidget } from "./server-stats";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  PanelLeftClose,
  PanelLeft,
  Zap,
  Settings,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/sessions", label: "Sessions", icon: Activity },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-sidebar transition-all duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <Zap className="size-4" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight">
            Claude Manager
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn("ml-auto text-muted-foreground hover:text-foreground hover:bg-accent/50", collapsed && "ml-0")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeft className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
        </Button>
      </div>

      <Separator />

      {/* Nav links */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all duration-150 relative",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Server stats at bottom */}
      <Separator />
      {!collapsed && (
        <div className="py-2">
          <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Server
          </p>
          <ServerStatsWidget />
        </div>
      )}
    </aside>
  );
}
