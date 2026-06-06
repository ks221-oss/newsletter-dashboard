import React, { useState } from "react";
import { Youtube, List, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ChannelManager from "./channel-manager";
import SidePaneLogs from "./side-pane-logs";
import {
  useGetChannels,
  getGetChannelsQueryKey,
  RunsData,
} from "@workspace/api-client-react";

type Tab = "accounts" | "logs";

interface SidePaneProps {
  runsData?: RunsData;
  isRunsLoading: boolean;
}

export default function SidePane({ runsData, isRunsLoading }: SidePaneProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("accounts");

  const { data: channels } = useGetChannels({
    query: { queryKey: getGetChannelsQueryKey() },
  });
  const channelCount = channels?.length ?? 0;

  function expand(tab: Tab) {
    setActiveTab(tab);
    setCollapsed(false);
  }

  if (collapsed) {
    return (
      <aside className="hidden md:flex flex-col w-12 border-r border-border shrink-0 sticky top-0 h-screen">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center h-10 w-full border-b border-border text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
          title="Expand pane"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => expand("accounts")}
          className={`flex items-center justify-center h-10 w-full border-b border-border transition-colors relative ${
            activeTab === "accounts"
              ? "text-primary bg-primary/5"
              : "text-muted-foreground hover:text-primary hover:bg-primary/5"
          }`}
          title={`Accounts Tracked (${channelCount})`}
        >
          <Youtube className="w-3.5 h-3.5" />
          {channelCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary opacity-80" />
          )}
        </button>

        <button
          onClick={() => expand("logs")}
          className={`flex items-center justify-center h-10 w-full border-b border-border transition-colors ${
            activeTab === "logs"
              ? "text-primary bg-primary/5"
              : "text-muted-foreground hover:text-primary hover:bg-primary/5"
          }`}
          title="Logs"
        >
          <List className="w-3.5 h-3.5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="hidden md:flex flex-col w-72 xl:w-80 border-r border-border shrink-0 sticky top-0 h-screen overflow-hidden">
      {/* ── Tab bar ── */}
      <div className="flex items-stretch border-b border-border shrink-0">
        <button
          onClick={() => setActiveTab("accounts")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-mono uppercase tracking-widest transition-colors ${
            activeTab === "accounts"
              ? "text-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          <Youtube className="w-3 h-3 shrink-0" />
          Accounts Tracked
          {channelCount > 0 && (
            <span
              className={`ml-0.5 px-1.5 py-px rounded-sm text-[9px] font-mono ${
                activeTab === "accounts"
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {channelCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-mono uppercase tracking-widest transition-colors flex-1 border-l border-border ${
            activeTab === "logs"
              ? "text-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
          }`}
        >
          <List className="w-3 h-3 shrink-0" />
          Logs
        </button>

        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center justify-center px-3 border-l border-border text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors shrink-0"
          title="Collapse pane"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "accounts" && (
          <div className="p-4">
            <ChannelManager />
          </div>
        )}

        {activeTab === "logs" && (
          <div className="p-4 space-y-3">
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
        )}
      </div>
    </aside>
  );
}
