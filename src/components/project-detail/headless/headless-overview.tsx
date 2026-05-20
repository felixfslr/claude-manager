"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ListChecks, Play, FileText, Repeat, NotebookPen } from "lucide-react";
import { RunsList } from "./runs-list";
import { RunForm } from "./run-form";
import { PromptsLibrary } from "./prompts-library";
import { PlansLibrary } from "./plans-library";
import { LoopsList } from "./loops-list";

interface HeadlessOverviewProps {
  projectName: string;
}

export function HeadlessOverview({ projectName }: HeadlessOverviewProps) {
  return (
    <Tabs defaultValue="new">
      <TabsList variant="line" className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="new">
          <Play className="size-3.5" />
          New Chat
        </TabsTrigger>
        <TabsTrigger value="runs">
          <ListChecks className="size-3.5" />
          Runs
        </TabsTrigger>
        <TabsTrigger value="prompts">
          <FileText className="size-3.5" />
          Prompts
        </TabsTrigger>
        <TabsTrigger value="plans">
          <NotebookPen className="size-3.5" />
          Plans
        </TabsTrigger>
        <TabsTrigger value="loops">
          <Repeat className="size-3.5" />
          Loops
        </TabsTrigger>
      </TabsList>
      <TabsContent value="new" className="mt-6">
        <RunForm projectName={projectName} />
      </TabsContent>
      <TabsContent value="runs" className="mt-6">
        <RunsList projectName={projectName} />
      </TabsContent>
      <TabsContent value="prompts" className="mt-6">
        <PromptsLibrary projectName={projectName} />
      </TabsContent>
      <TabsContent value="plans" className="mt-6">
        <PlansLibrary projectName={projectName} />
      </TabsContent>
      <TabsContent value="loops" className="mt-6">
        <LoopsList projectName={projectName} />
      </TabsContent>
    </Tabs>
  );
}
