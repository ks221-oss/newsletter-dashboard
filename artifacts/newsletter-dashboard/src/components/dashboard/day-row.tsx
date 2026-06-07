import React, { useState } from "react";
import { RunRecord, VideoRecord } from "@workspace/api-client-react";
import { useGetGmailStatus, getGetGmailStatusQueryKey } from "@workspace/api-client-react";
import { ChevronDown, ChevronRight, ExternalLink, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Mail } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface DayRowProps {
  date: string;
  runs: RunRecord[];
  allChannels: string[];
  isRecent?: boolean;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).toUpperCase();
}

function getErrorType(error: string) {
  const lower = error.toLowerCase();
  if (lower.includes("invalid video id")) return { label: "SHORTS_PARSE", color: "text-amber-400 border-amber-400/40" };
  if (lower.includes("disabled")) return { label: "CREATOR_DISABLED", color: "text-red-400 border-red-400/40" };
  if (lower.includes("could not retrieve")) return { label: "NO_CAPTIONS", color: "text-orange-400 border-orange-400/40" };
  if (lower.includes("proxy") || lower.includes("502") || lower.includes("connectionpool") || lower.includes("max retries")) return { label: "PROXY_ERR", color: "text-blue-400 border-blue-400/40" };
  if (lower.includes("timeout") || lower.includes("timed out")) return { label: "TIMEOUT", color: "text-blue-400 border-blue-400/40" };
  return { label: "UNKNOWN", color: "text-muted-foreground border-border" };
}

function SingleRunDetail({ run, idx }: { run: RunRecord; idx: number }) {
  const [open, setOpen] = useState(false);
  const ok = (run.videos as VideoRecord[]).filter((v) => v.transcript === "ok").length;
  const failed = (run.videos as VideoRecord[]).filter((v) => v.transcript !== "ok" && v.transcript_error);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border/50 bg-background/40">
      <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/20 transition-colors group">
        <div className="flex items-center gap-3">
          <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
          <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
            Run #{idx + 1}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <span className={run.email_sent ? "text-emerald-400" : "text-red-400"}>
            {run.email_sent ? "✓ EMAIL_SENT" : "✗ EMAIL_FAILED"}
          </span>
          <span className={ok === run.total_videos ? "text-emerald-400" : ok > 0 ? "text-amber-400" : "text-red-400"}>
            {ok}/{run.total_videos} TRANSCRIPT
          </span>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        {failed.length === 0 ? (
          <div className="px-8 py-2 text-[11px] font-mono text-muted-foreground">
            ALL_TRANSCRIPTS_OK — no failures
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="text-[10px] tracking-wider uppercase font-mono h-7 text-muted-foreground">Title</TableHead>
                <TableHead className="text-[10px] tracking-wider uppercase font-mono h-7 text-muted-foreground">Channel</TableHead>
                <TableHead className="text-[10px] tracking-wider uppercase font-mono h-7 text-muted-foreground">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failed.map((v: VideoRecord, i: number) => {
                const err = getErrorType(v.transcript_error ?? "");
                return (
                  <TableRow key={i} className="hover:bg-muted/20 border-border/30">
                    <TableCell className="font-mono text-[11px] max-w-[200px]">
                      <a href={v.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 hover:text-primary transition-colors truncate" title={v.title}>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{v.title}</span>
                      </a>
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground truncate max-w-[120px]" title={v.channel}>
                      {v.channel}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        title={v.transcript_error ?? ""}
                        className={`font-mono text-[10px] rounded-none bg-transparent ${err.color} cursor-help`}
                      >
                        {err.label}
                      </Badge>
                      {err.label === "UNKNOWN" && v.transcript_error && (
                        <p className="font-mono text-[9px] text-muted-foreground/60 mt-0.5 max-w-[260px] break-words leading-relaxed">
                          {v.transcript_error}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function DayRow({ date, runs, allChannels, isRecent = false }: DayRowProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: gmailStatus, isLoading: isGmailLoading } = useGetGmailStatus(date, {
    query: { queryKey: getGetGmailStatusQueryKey(date), enabled: isRecent, refetchInterval: 60000 },
  });

  // Aggregate across all runs
  const totalVideos = runs.reduce((s, r) => s + r.total_videos, 0);
  const okTranscripts = runs.reduce(
    (s, r) => s + (r.videos as VideoRecord[]).filter((v) => v.transcript === "ok").length,
    0,
  );
  const anyEmailSent = runs.some((r) => r.email_sent);
  const transcriptRate = totalVideos > 0 ? okTranscripts / totalVideos : 0;

  // Channel breakdown across all runs
  const channelMap = new Map<string, { videos: number; ok: number }>();
  for (const run of runs) {
    for (const v of run.videos as VideoRecord[]) {
      const ch = v.channel || "Unknown";
      const existing = channelMap.get(ch) ?? { videos: 0, ok: 0 };
      channelMap.set(ch, {
        videos: existing.videos + 1,
        ok: existing.ok + (v.transcript === "ok" ? 1 : 0),
      });
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="bg-card border border-border rounded-none">
      <div className="flex items-center justify-between p-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-sm uppercase font-bold text-foreground tracking-wider">
            {formatDate(date)}
          </div>

          {runs.length > 1 && (
            <Badge variant="outline" className="rounded-none font-mono text-[10px] border-violet-500/40 text-violet-400 bg-violet-500/10">
              {runs.length} RUNS
            </Badge>
          )}

          {isRecent && (
            isGmailLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : gmailStatus?.unavailable ? (
              <Badge variant="outline" className="text-muted-foreground font-mono text-[10px] rounded-none px-1 uppercase tracking-wider">
                <AlertTriangle className="w-3 h-3 mr-1" /> NO_IMAP
              </Badge>
            ) : gmailStatus?.found ? (
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 font-mono text-[10px] rounded-none px-1 uppercase tracking-wider bg-emerald-500/10">
                <CheckCircle2 className="w-3 h-3 mr-1" /> INBOX_OK
              </Badge>
            ) : gmailStatus?.found === false ? (
              <Badge variant="outline" className="text-red-400 border-red-500/30 font-mono text-[10px] rounded-none px-1 uppercase tracking-wider bg-red-500/10">
                <XCircle className="w-3 h-3 mr-1" /> MISSING
              </Badge>
            ) : (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 font-mono text-[10px] rounded-none px-1 uppercase tracking-wider bg-yellow-500/10">
                <HelpCircle className="w-3 h-3 mr-1" /> GMAIL_ERR
              </Badge>
            )
          )}
        </div>

        <div className="flex items-center gap-5 flex-1 justify-end">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase text-muted-foreground tracking-widest">Email</span>
            <span className={`font-mono text-xs font-bold ${anyEmailSent ? "text-emerald-400" : "text-red-400"}`}>
              {anyEmailSent ? "SENT" : "NONE"}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase text-muted-foreground tracking-widest">Transcript</span>
            <span className={`font-mono text-xs font-bold ${
              transcriptRate === 1 ? "text-emerald-400" : transcriptRate > 0.5 ? "text-amber-400" : "text-red-400"
            }`}>
              {okTranscripts}/{totalVideos}
            </span>
          </div>

          <CollapsibleTrigger asChild>
            <button className="p-2 hover:bg-muted text-muted-foreground transition-colors border border-transparent hover:border-border">
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent>
        <div className="border-t border-border bg-background/50 p-4 space-y-5">

          {/* Channel Breakdown */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
              Channel Breakdown — {totalVideos} total podcasts
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[10px] uppercase font-mono h-7 tracking-wider text-muted-foreground">Channel</TableHead>
                  <TableHead className="text-[10px] uppercase font-mono h-7 tracking-wider text-muted-foreground text-right">Dropped</TableHead>
                  <TableHead className="text-[10px] uppercase font-mono h-7 tracking-wider text-muted-foreground text-right">Transcribed</TableHead>
                  <TableHead className="text-[10px] uppercase font-mono h-7 tracking-wider text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allChannels.map((ch) => {
                  const stats = channelMap.get(ch);
                  const noDrop = !stats;
                  return (
                    <TableRow key={ch} className={`border-border/30 hover:bg-muted/20 ${noDrop ? "opacity-40" : ""}`}>
                      <TableCell className="font-mono text-[11px] max-w-[180px] truncate" title={ch}>{ch}</TableCell>
                      <TableCell className="font-mono text-[11px] text-right">{noDrop ? "—" : stats.videos}</TableCell>
                      <TableCell className={`font-mono text-[11px] text-right ${
                        noDrop ? "" : stats.ok === stats.videos ? "text-emerald-400" : "text-amber-400"
                      }`}>
                        {noDrop ? "—" : `${stats.ok}/${stats.videos}`}
                      </TableCell>
                      <TableCell>
                        {noDrop ? (
                          <span className="font-mono text-[10px] text-muted-foreground">NO_DROP</span>
                        ) : stats.ok === stats.videos ? (
                          <span className="font-mono text-[10px] text-emerald-400">ALL_TRANSCRIBED</span>
                        ) : stats.ok === 0 ? (
                          <span className="font-mono text-[10px] text-red-400">ALL_FAILED</span>
                        ) : (
                          <span className="font-mono text-[10px] text-amber-400">PARTIAL</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {Array.from(channelMap.entries())
                  .filter(([ch]) => !allChannels.includes(ch))
                  .map(([ch, stats]) => (
                    <TableRow key={ch} className="border-border/30 hover:bg-muted/20">
                      <TableCell className="font-mono text-[11px] max-w-[180px] truncate" title={ch}>{ch}</TableCell>
                      <TableCell className="font-mono text-[11px] text-right">{stats.videos}</TableCell>
                      <TableCell className={`font-mono text-[11px] text-right ${stats.ok === stats.videos ? "text-emerald-400" : "text-amber-400"}`}>
                        {stats.ok}/{stats.videos}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-[10px] text-emerald-400">
                          {stats.ok === stats.videos ? "ALL_TRANSCRIBED" : "PARTIAL"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          {/* Email Status Summary */}
          <div className="flex items-center gap-2 py-2 border-t border-border/40">
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Email delivery:
            </span>
            {runs.map((r, i) => (
              <Badge key={i} variant="outline" className={`font-mono text-[10px] rounded-none ${
                r.email_sent
                  ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                  : "text-red-400 border-red-500/30 bg-red-500/10"
              }`}>
                {runs.length > 1 ? `Run#${i + 1} ` : ""}{r.email_sent ? "✓ SENT" : "✗ NOT SENT"}
              </Badge>
            ))}
          </div>

          {/* Individual Runs */}
          {runs.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
                {runs.length === 1 ? "Run Detail" : `All ${runs.length} Runs`}
              </div>
              <div className="space-y-1.5">
                {runs.map((run, i) => (
                  <SingleRunDetail key={i} run={run} idx={i} />
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
