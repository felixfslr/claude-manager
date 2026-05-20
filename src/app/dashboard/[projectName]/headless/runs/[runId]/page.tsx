"use client";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { ChatThread } from "@/components/project-detail/headless/chat-thread";

export default function HeadlessRunPage({
  params,
}: {
  params: Promise<{ projectName: string; runId: string }>;
}) {
  const { projectName, runId } = use(params);
  const decodedName = decodeURIComponent(projectName);
  const decodedRunId = decodeURIComponent(runId);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/dashboard/${encodeURIComponent(decodedName)}/headless`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <Bot className="size-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{decodedName}</h1>
        <span className="text-sm text-muted-foreground">/ chat / {decodedRunId.slice(0, 8)}</span>
      </div>
      <ChatThread projectName={decodedName} initialRunId={decodedRunId} />
    </div>
  );
}
