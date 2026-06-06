import React, { useState } from "react";
import { RunRecord, VideoRecord } from "@workspace/api-client-react/src/generated/api.schemas";
import { useGetGmailStatus } from "@workspace/api-client-react";
import { formatDayDate } from "@/lib/date-utils";
import { ChevronDown, ExternalLink, CheckCircle2, XCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface DayRowProps {
  date: string;
  run: RunRecord;
  isRecent?: boolean;
}

export default function DayRow({ date, run, isRecent = false }: DayRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Fetch Gmail status only for recent days
  const { data: gmailStatus, isLoading: isGmailLoading } = useGetGmailStatus(date, {
    query: {
      enabled: isRecent,
      refetchInterval: 60000,
    }
  });

  const successfulTranscripts = run.videos.filter(v => v.transcript).length;
  const transcriptRate = run.total_videos > 0 ? successfulTranscripts / run.total_videos : 0;
  const hasFailures = run.videos.some(v => v.transcript_error);
  
  const failedVideos = run.videos.filter(v => v.transcript_error);

  const getErrorType = (error: string) => {
    const lower = error.toLowerCase();
    if (lower.includes("invalid video id")) return { type: "SHORTS_ERROR", color: "text-chart-2 border-chart-2" };
    if (lower.includes("disabled")) return { type: "CREATOR_DISABLED", color: "text-chart-5 border-chart-5" };
    if (lower.includes("could not retrieve")) return { type: "NO_CAPTIONS", color: "text-chart-3 border-chart-3" };
    return { type: "UNKNOWN_ERR", color: "text-muted-foreground border-border" };
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-card border border-border rounded-none">
      <div className="flex items-center justify-between p-4 flex-wrap gap-4">
        <div className="flex items-center gap-4 min-w-[200px]">
          <div className="font-mono text-sm uppercase font-bold text-foreground">
            {formatDayDate(date)}
          </div>
          
          <div className="flex items-center gap-2">
            {isRecent ? (
              isGmailLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : gmailStatus?.unavailable ? (
                <Badge variant="outline" className="text-muted-foreground font-mono text-[10px] rounded-none px-1 uppercase tracking-wider">
                  <AlertTriangle className="w-3 h-3 mr-1" /> No_IMAP
                </Badge>
              ) : gmailStatus?.found ? (
                <Badge variant="outline" className="text-chart-4 border-chart-4/30 font-mono text-[10px] rounded-none px-1 uppercase tracking-wider bg-chart-4/10">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> INBOX_OK
                </Badge>
              ) : gmailStatus?.found === false ? (
                <Badge variant="outline" className="text-chart-5 border-chart-5/30 font-mono text-[10px] rounded-none px-1 uppercase tracking-wider bg-chart-5/10">
                  <XCircle className="w-3 h-3 mr-1" /> MISSING
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground font-mono text-[10px] rounded-none px-1 uppercase tracking-wider">
                  <HelpCircle className="w-3 h-3 mr-1" /> UNKNOWN
                </Badge>
              )
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-6 flex-1 justify-end">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase text-muted-foreground tracking-widest">Sent</span>
            <span className={`font-mono text-sm font-bold ${run.email_sent ? 'text-chart-4' : 'text-chart-5'}`}>
              {run.email_sent ? 'TRUE' : 'FALSE'}
            </span>
          </div>
          
          <div className="flex flex-col items-end w-24">
            <span className="text-[10px] uppercase text-muted-foreground tracking-widest">Transcript</span>
            <span className={`font-mono text-sm font-bold ${
              transcriptRate === 1 ? 'text-chart-4' : transcriptRate > 0.5 ? 'text-chart-2' : 'text-chart-5'
            }`}>
              {successfulTranscripts}/{run.total_videos}
            </span>
          </div>

          <CollapsibleTrigger asChild>
            <button 
              disabled={!hasFailures}
              className="p-2 hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors border border-transparent hover:border-border"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div className="p-0 border-t border-border bg-background/50">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-xs tracking-wider uppercase font-mono h-8">Video ID/Title</TableHead>
                <TableHead className="text-xs tracking-wider uppercase font-mono h-8">Channel</TableHead>
                <TableHead className="text-xs tracking-wider uppercase font-mono h-8">Error Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failedVideos.map((v, i) => {
                const errDetail = getErrorType(v.transcript_error || "");
                return (
                  <TableRow key={i} className="hover:bg-muted/30 border-border">
                    <TableCell className="font-mono text-xs">
                      <a 
                        href={v.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1.5 hover:text-primary transition-colors max-w-[200px] md:max-w-xs truncate"
                        title={v.title}
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{v.title}</span>
                      </a>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={v.channel}>
                      {v.channel}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-mono text-[10px] rounded-none bg-transparent ${errDetail.color}`}>
                        {errDetail.type}
                      </Badge>
                      <div className="text-[10px] text-muted-foreground mt-1 max-w-xs truncate" title={v.transcript_error || ""}>
                        {v.transcript_error}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
