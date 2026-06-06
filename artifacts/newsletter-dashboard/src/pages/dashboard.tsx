import React, { useState } from "react";
import { useGetDashboardRuns, getGetDashboardRunsQueryKey, useGetChannels, getGetChannelsQueryKey } from "@workspace/api-client-react";
import DailyCharts from "@/components/dashboard/daily-charts";
import Timeline from "@/components/dashboard/timeline";
import NavRail, { NavView } from "@/components/dashboard/nav-rail";
import ChannelGrid from "@/components/dashboard/channel-grid";
import SidePaneLogs from "@/components/dashboard/side-pane-logs";
import { AlertCircle, RefreshCw, Youtube, List } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

type MobileTab = "accounts" | "logs";

export default function Dashboard() {
  const [activeView, setActiveView] = useState<NavView>("accounts");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("accounts");

  const {
    data: runsData,
    isLoading: isRunsLoading,
    error: runsError,
    isRefetching: isRunsRefetching,
  } = useGetDashboardRuns({
    query: { queryKey: getGetDashboardRunsQueryKey(), refetchInterval: 60000 },
  });

  const { data: channels } = useGetChannels({
    query: { queryKey: getGetChannelsQueryKey() },
  });

  const channelCount = channels?.length ?? 0;
  const logCount = runsData ? Object.keys(runsData).length : 0;

  return (
    <div className="flex min-h-screen">
      {/* ── Left nav rail (desktop only) ── */}
      <NavRail
        activeView={activeView}
        onViewChange={setActiveView}
        channelCount={channelCount}
        logCount={logCount}
        collapsed={navCollapsed}
        onCollapse={setNavCollapsed}
      />

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Global header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-mono font-bold tracking-[0.15em] text-primary uppercase">
              MISSION_CONTROL
            </h1>
            <div className="hidden sm:flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">
              <span>AI Podcast Digest</span>
              <span>·</span>
              <span>Operations Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            {isRunsRefetching && <RefreshCw className="w-3 h-3 animate-spin text-primary/60" />}
            <div className="flex items-center gap-1.5 px-2 py-1 border border-border text-[10px]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
              SYSTEM_ONLINE
            </div>
          </div>
        </header>

        {/* Desktop view content */}
        <div className="hidden md:block flex-1 p-6 overflow-auto">
          {activeView === "accounts" && <ChannelGrid />}

          {activeView === "logs" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-foreground uppercase mb-1">
                  Logs
                </h2>
                <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
                  Run telemetry and email delivery history
                </p>
              </div>

              {runsError ? (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>System Error</AlertTitle>
                  <AlertDescription>Failed to fetch telemetry. Retrying in 60s.</AlertDescription>
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
                      <h3 className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground uppercase border-b border-border pb-2">
                        METRICS_GRAPH
                      </h3>
                      <DailyCharts runsData={runsData} />
                    </div>
                  )}
                  {runsData && (
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground uppercase border-b border-border pb-2">
                        TELEMETRY_LOG
                      </h3>
                      <Timeline runsData={runsData} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Mobile content */}
        <div className="md:hidden flex-1 p-4 space-y-6 pb-24">
          {/* Mobile tab bar */}
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

          {mobileTab === "accounts" && <ChannelGrid />}
          {mobileTab === "logs" && (
            <div className="space-y-8">
              {isRunsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full bg-muted" />
                  <Skeleton className="h-16 w-full bg-muted" />
                </div>
              ) : (
                <>
                  {runsData && <DailyCharts runsData={runsData} />}
                  {runsData && <Timeline runsData={runsData} />}
                  <SidePaneLogs runsData={runsData} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
