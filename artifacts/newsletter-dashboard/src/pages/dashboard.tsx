import React from "react";
import { useGetDashboardRuns, getGetDashboardRunsQueryKey } from "@workspace/api-client-react";
import DailyCharts from "@/components/dashboard/daily-charts";
import Timeline from "@/components/dashboard/timeline";
import ChannelManager from "@/components/dashboard/channel-manager";
import SidePaneLogs from "@/components/dashboard/side-pane-logs";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const {
    data: runsData,
    isLoading: isRunsLoading,
    error: runsError,
    isRefetching: isRunsRefetching,
  } = useGetDashboardRuns({
    query: { queryKey: getGetDashboardRunsQueryKey(), refetchInterval: 60000 },
  });

  return (
    <div className="flex min-h-screen">
      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 p-4 md:p-8 space-y-8 pb-20">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">MISSION_CONTROL</h1>
            <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">
              AI Podcast Digest • Operations Dashboard
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded border border-border">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              SYSTEM_ONLINE
            </div>
            {isRunsRefetching && (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
            )}
          </div>
        </header>

        {runsError ? (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>System Error</AlertTitle>
            <AlertDescription>
              Failed to fetch dashboard telemetry. Retrying in 60s.
            </AlertDescription>
          </Alert>
        ) : isRunsLoading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Skeleton className="h-[240px] w-full bg-muted" />
              <Skeleton className="h-[240px] w-full bg-muted" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-16 w-full bg-muted" />
              <Skeleton className="h-16 w-full bg-muted" />
            </div>
          </div>
        ) : (
          <>
            {runsData && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase border-b border-border pb-2">
                  METRICS_GRAPH
                </h2>
                <DailyCharts runsData={runsData} />
              </div>
            )}

            {runsData && (
              <div className="space-y-4">
                <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase border-b border-border pb-2">
                  TELEMETRY_LOG
                </h2>
                <Timeline runsData={runsData} />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Side pane ── */}
      <aside className="hidden md:flex flex-col w-72 xl:w-80 border-l border-border shrink-0 sticky top-0 h-screen overflow-y-auto">
        {/* Logs */}
        <div className="flex-1 p-4 space-y-3 border-b border-border">
          <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase pb-1 border-b border-border">
            Logs
          </h2>
          {isRunsLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full bg-muted" />
              ))}
            </div>
          ) : (
            <SidePaneLogs runsData={runsData} />
          )}
        </div>

        {/* Channels tracked */}
        <div className="p-4 space-y-3">
          <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase pb-1 border-b border-border">
            Channels tracked
          </h2>
          <ChannelManager />
        </div>
      </aside>

      {/* ── Mobile side pane (stacked below, visible on small screens) ── */}
      <div className="md:hidden w-full border-t border-border mt-8">
        <div className="p-4 space-y-3 border-b border-border">
          <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase pb-1 border-b border-border">
            Logs
          </h2>
          <SidePaneLogs runsData={runsData} />
        </div>
        <div className="p-4 space-y-3">
          <h2 className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase pb-1 border-b border-border">
            Channels tracked
          </h2>
          <ChannelManager />
        </div>
      </div>
    </div>
  );
}
