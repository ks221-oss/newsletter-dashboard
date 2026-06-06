import React, { useState } from "react";
import { useGetDashboardRuns, getGetDashboardRunsQueryKey } from "@workspace/api-client-react";
import DailyCharts from "@/components/dashboard/daily-charts";
import Timeline from "@/components/dashboard/timeline";
import SidePane from "@/components/dashboard/side-pane";
import ChannelManager from "@/components/dashboard/channel-manager";
import SidePaneLogs from "@/components/dashboard/side-pane-logs";
import { AlertCircle, RefreshCw, Youtube, List } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type MobileTab = "accounts" | "logs";

export default function Dashboard() {
  const [mobileTab, setMobileTab] = useState<MobileTab>("accounts");

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
      {/* ── Left side pane (desktop only) ── */}
      <SidePane runsData={runsData} isRunsLoading={isRunsLoading} />

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 p-4 md:p-8 space-y-8 pb-20">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">AI Podcast Digest</h1>
            <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">
              Operations Dashboard
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

        {/* ── Mobile: tabbed pane below main content ── */}
        <div className="md:hidden border-t border-border pt-4 space-y-4">
          {/* Tab bar */}
          <div className="flex border border-border">
            <button
              onClick={() => setMobileTab("accounts")}
              className={`flex items-center gap-1.5 flex-1 justify-center px-4 py-2.5 text-[10px] font-mono uppercase tracking-widest transition-colors ${
                mobileTab === "accounts"
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <Youtube className="w-3 h-3" />
              Accounts Tracked
            </button>
            <button
              onClick={() => setMobileTab("logs")}
              className={`flex items-center gap-1.5 flex-1 justify-center px-4 py-2.5 text-[10px] font-mono uppercase tracking-widest border-l border-border transition-colors ${
                mobileTab === "logs"
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              <List className="w-3 h-3" />
              Logs
            </button>
          </div>

          {/* Tab content */}
          {mobileTab === "accounts" && <ChannelManager />}
          {mobileTab === "logs" && <SidePaneLogs runsData={runsData} />}
        </div>
      </div>
    </div>
  );
}
