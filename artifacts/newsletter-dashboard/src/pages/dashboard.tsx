import React from "react";
import { useGetDashboardRuns, useGetDashboardSummary } from "@workspace/api-client-react";
import SummaryCards from "@/components/dashboard/summary-cards";
import Timeline from "@/components/dashboard/timeline";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { 
    data: runsData, 
    isLoading: isRunsLoading, 
    error: runsError,
    isRefetching: isRunsRefetching
  } = useGetDashboardRuns({
    query: { refetchInterval: 60000 }
  });

  const { 
    data: summaryData, 
    isLoading: isSummaryLoading,
    error: summaryError 
  } = useGetDashboardSummary({
    query: { refetchInterval: 60000 }
  });

  const isLoading = isRunsLoading || isSummaryLoading;
  const error = runsError || summaryError;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-20">
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

      {error ? (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>System Error</AlertTitle>
          <AlertDescription>
            Failed to fetch dashboard telemetry. Retrying in 60s.
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-24 w-full bg-muted" />
            <Skeleton className="h-24 w-full bg-muted" />
            <Skeleton className="h-24 w-full bg-muted" />
            <Skeleton className="h-24 w-full bg-muted" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full bg-muted" />
            <Skeleton className="h-16 w-full bg-muted" />
            <Skeleton className="h-16 w-full bg-muted" />
          </div>
        </div>
      ) : (
        <>
          <SummaryCards summary={summaryData} />
          
          <div className="space-y-4">
            <h2 className="text-sm font-bold tracking-widest text-muted-foreground uppercase border-b border-border pb-2">
              TELEMETRY_LOG
            </h2>
            <Timeline runsData={runsData} />
          </div>
        </>
      )}
    </div>
  );
}
