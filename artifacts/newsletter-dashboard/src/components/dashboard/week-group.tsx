import React, { useState } from "react";
import { RunRecord } from "@workspace/api-client-react/src/generated/api.schemas";
import { formatWeekDate } from "@/lib/date-utils";
import DayRow from "./day-row";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FolderArchive } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WeekGroupProps {
  weekKey: string;
  days: { date: string; run: RunRecord }[];
}

export default function WeekGroup({ weekKey, days }: WeekGroupProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalRuns = days.length;
  const emailsSent = days.filter(d => d.run.email_sent).length;
  const emailRate = totalRuns > 0 ? (emailsSent / totalRuns) * 100 : 0;
  
  const totalVideos = days.reduce((sum, d) => sum + d.run.total_videos, 0);
  const totalTranscripts = days.reduce((sum, d) => sum + d.run.videos.filter(v => v.transcript).length, 0);
  const transcriptRate = totalVideos > 0 ? (totalTranscripts / totalVideos) * 100 : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-muted/10 border border-border rounded-none">
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors group">
        <div className="flex items-center gap-3">
          <FolderArchive className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
            WK_{formatWeekDate(weekKey)}
          </span>
          <Badge variant="outline" className="rounded-none text-[10px] font-mono border-border bg-transparent">
            {totalRuns} RUNS
          </Badge>
        </div>

        <div className="flex items-center gap-6 text-xs font-mono text-muted-foreground">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-widest opacity-50">Delivery</span>
            <span className={emailRate === 100 ? 'text-chart-4' : 'text-chart-2'}>{emailRate.toFixed(0)}%</span>
          </div>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[9px] uppercase tracking-widest opacity-50">Transcripts</span>
            <span className={transcriptRate > 90 ? 'text-chart-4' : 'text-chart-2'}>{transcriptRate.toFixed(0)}%</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="p-2 space-y-2 border-t border-border bg-background">
          {days.map(({ date, run }) => (
            <DayRow key={date} date={date} run={run} isRecent={false} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
