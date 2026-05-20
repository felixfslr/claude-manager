"use client";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { HeadlessOverview } from "@/components/project-detail/headless/headless-overview";

export default function HeadlessPage({
  params,
}: {
  params: Promise<{ projectName: string }>;
}) {
  const { projectName } = use(params);
  const decodedName = decodeURIComponent(projectName);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/dashboard/${encodeURIComponent(decodedName)}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <Bot className="size-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{decodedName}</h1>
        <span className="text-sm text-muted-foreground">/ headless claude</span>
      </div>
      <HeadlessOverview projectName={decodedName} />
    </div>
  );
}
