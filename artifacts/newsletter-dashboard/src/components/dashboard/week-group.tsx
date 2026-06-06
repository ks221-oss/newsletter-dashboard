import React, { useState } from "react";
import { RunRecord } from "@workspace/api-client-react/src/generated/api.schemas";
import DayRow from "./day-row";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FolderArchive } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WeekGroupProps {
  weekKey: string;
  days: { date: string; runs: RunRecord[] }[];
  allChannels: string[];
}

function formatWeek(weekKey: string) {
  const d = new Date(weekKey + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).toUpperCase();
}

export default function WeekGroup({ weekKey, days, allChannels }: WeekGroupProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalRunDays = days.length;
  const totalRuns = days.reduce((s, d) => s + d.runs.length, 0);
  const emailSentDays = days.filter((d) => d.runs.some((r) => r.email_sent)).length;
  const emailRate = totalRunDays > 0 ? Math.round((emailSentDays / totalRunDays) * 100) : 0;

  const totalVideos = days.reduce((s, d) =>
    s + d.runs.reduce((rs, r) => rs + r.total_videos, 0), 0);
  const okTranscripts = days.reduce((s, d) =>
    s + d.runs.reduce((rs, r) => rs + r.videos.filter((v) => v.transcript === "ok").length, 0), 0);
  const transcriptRate = totalVideos > 0 ? Math.round((okTranscripts / totalVideos) * 100) : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-muted/10 border border-border rounded-none">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors group">
        <div className="flex items-center gap-3">
          <FolderArchive className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
            WK_{formatWeek(weekKey)}
          </span>
          <Badge variant="outline" className="rounded-none text-[10px] font-mono border-border bg-transparent">
            {totalRunDays} DAYS · {totalRuns} RUNS
          </Badge>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono text-muted-foreground">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-widest opacity-50">Delivery</span>
            <span className={emailRate === 100 ? "text-emerald-400" : "text-amber-400"}>{emailRate}%</span>
          </div>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-widest opacity-50">Transcripts</span>
            <span className={transcriptRate > 90 ? "text-emerald-400" : "text-amber-400"}>{transcriptRate}%</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-2 space-y-2 border-t border-border bg-background">
          {days.map(({ date, runs }) => (
            <DayRow key={date} date={date} runs={runs} allChannels={allChannels} isRecent={false} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
