import React from "react";
import { RunsData, RunRecord, VideoRecord } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, Minus } from "lucide-react";

interface SidePaneLogsProps {
  runsData?: RunsData;
}

function formatDateCompact(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).toUpperCase();
}

export default function SidePaneLogs({ runsData }: SidePaneLogsProps) {
  if (!runsData) {
    return (
      <div className="text-[11px] font-mono text-muted-foreground text-center py-4 opacity-60">
        AWAITING_DATA…
      </div>
    );
  }

  const sorted = Object.keys(runsData)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 14);

  if (sorted.length === 0) {
    return (
      <div className="text-[11px] font-mono text-muted-foreground text-center py-4 opacity-60">
        NO_LOGS_FOUND
      </div>
    );
  }

  return (
    <div className="space-y-px">
      {sorted.map((date) => {
        const runs = (runsData[date] ?? []) as RunRecord[];
        const totalVideos = runs.reduce((s, r) => s + r.total_videos, 0);
        const okTranscripts = runs.reduce(
          (s, r) => s + (r.videos as VideoRecord[]).filter((v) => v.transcript === "ok").length,
          0,
        );
        const emailSent = runs.some((r) => r.email_sent);
        const rate = totalVideos > 0 ? okTranscripts / totalVideos : null;

        const rateColor =
          rate === null
            ? "text-muted-foreground"
            : rate === 1
              ? "text-emerald-400"
              : rate > 0.5
                ? "text-amber-400"
                : "text-red-400";

        return (
          <div
            key={date}
            className="flex items-center justify-between px-2 py-1.5 hover:bg-muted/30 transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  emailSent ? "bg-emerald-400" : runs.length === 0 ? "bg-muted-foreground/30" : "bg-red-400"
                }`}
              />
              <span className="font-mono text-[11px] text-foreground/80 tabular-nums">
                {formatDateCompact(date)}
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 text-[10px] font-mono">
              {runs.length === 0 ? (
                <span className="text-muted-foreground opacity-40">—</span>
              ) : (
                <>
                  <span className={rateColor}>
                    {rate === null ? "—" : `${okTranscripts}/${totalVideos}`}
                  </span>
                  {emailSent ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-400/60" />
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}

      <div className="pt-2 px-2 flex items-center justify-between text-[9px] font-mono text-muted-foreground opacity-40 uppercase tracking-widest">
        <span>date</span>
        <span className="flex items-center gap-2.5">
          <span>transcripts</span>
          <span>email</span>
        </span>
      </div>
    </div>
  );
}
