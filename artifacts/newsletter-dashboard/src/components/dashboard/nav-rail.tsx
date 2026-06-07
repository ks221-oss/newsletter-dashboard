import React from "react";
import { Youtube, List, BookOpen, Mic, ChevronLeft, ChevronRight } from "lucide-react";

const NOTION_URL =
  "https://app.notion.com/p/ks221/3778d67d1a808030834fd3d08f41b05e?v=3778d67d1a80800eb016000c4288ba59";

export type NavView = "accounts" | "logs" | "transcriber";

interface NavRailProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
  channelCount: number;
  logCount: number;
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
}

export default function NavRail({
  activeView,
  onViewChange,
  channelCount,
  logCount,
  collapsed,
  onCollapse,
}: NavRailProps) {
  function activate(view: NavView) {
    onViewChange(view);
    if (collapsed) onCollapse(false);
  }

  if (collapsed) {
    return (
      <aside className="hidden md:flex flex-col w-10 border-r border-border/60 shrink-0 sticky top-0 h-screen bg-background">
        <button
          onClick={() => onCollapse(false)}
          className="flex items-center justify-center h-10 w-full border-b border-border/60 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors shrink-0"
          title="Expand navigation"
        >
          <ChevronRight className="w-3 h-3" />
        </button>

        <button
          onClick={() => activate("accounts")}
          className={`relative flex items-center justify-center h-10 w-full border-b border-border/60 transition-colors ${
            activeView === "accounts"
              ? "text-primary bg-primary/10 border-l-2 border-l-primary"
              : "text-muted-foreground hover:text-primary hover:bg-primary/5 border-l-2 border-l-transparent"
          }`}
          title={`Accounts Tracked (${channelCount})`}
        >
          <Youtube className="w-3.5 h-3.5" />
          {channelCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-primary/70" />
          )}
        </button>

        <button
          onClick={() => activate("logs")}
          className={`flex items-center justify-center h-10 w-full border-b border-border/60 transition-colors ${
            activeView === "logs"
              ? "text-primary bg-primary/10 border-l-2 border-l-primary"
              : "text-muted-foreground hover:text-primary hover:bg-primary/5 border-l-2 border-l-transparent"
          }`}
          title="Logs"
        >
          <List className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => activate("transcriber")}
          className={`flex items-center justify-center h-10 w-full border-b border-border/60 transition-colors ${
            activeView === "transcriber"
              ? "text-primary bg-primary/10 border-l-2 border-l-primary"
              : "text-muted-foreground hover:text-primary hover:bg-primary/5 border-l-2 border-l-transparent"
          }`}
          title="Podcast Transcriber"
        >
          <Mic className="w-3.5 h-3.5" />
        </button>

        <a
          href={NOTION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-10 w-full border-b border-border/60 text-muted-foreground hover:text-primary hover:bg-primary/5 border-l-2 border-l-transparent transition-colors"
          title="Podcast Digest History"
        >
          <BookOpen className="w-3.5 h-3.5" />
        </a>

        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <span
            className="text-[7px] font-mono text-muted-foreground/25 uppercase tracking-[0.3em] select-none whitespace-nowrap"
            style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
          >
            CLICK ↑ TO EXPAND
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden md:flex flex-col w-40 border-r border-border/60 shrink-0 sticky top-0 h-screen bg-background">
      <div className="flex items-center justify-between pl-3 pr-2 py-2 border-b border-border/60 shrink-0">
        <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-[0.25em]">
          NAVIGATION
        </span>
        <button
          onClick={() => onCollapse(true)}
          className="p-0.5 text-muted-foreground/50 hover:text-primary transition-colors"
          title="Collapse navigation"
        >
          <ChevronLeft className="w-3 h-3" />
        </button>
      </div>

      <nav className="flex flex-col py-1">
        {(
          [
            { view: "accounts" as NavView, Icon: Youtube, label: "Accounts Tracked", count: channelCount },
            { view: "logs" as NavView, Icon: List, label: "Logs", count: logCount },
            { view: "transcriber" as NavView, Icon: Mic, label: "Transcriber", count: 0 },
          ] as const
        ).map(({ view, Icon, label, count }) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={`flex items-center gap-2 pl-3 pr-2 py-2.5 text-left transition-colors ${
              activeView === view
                ? "text-primary bg-primary/10 border-l-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-l-2 border-transparent"
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-mono uppercase tracking-wider leading-tight flex-1">
              {label}
            </span>
            {count > 0 && (
              <span
                className={`text-[9px] font-mono px-1.5 py-px rounded-sm tabular-nums ${
                  activeView === view
                    ? "bg-primary/20 text-primary"
                    : "bg-muted/60 text-muted-foreground"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}

        <a
          href={NOTION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 pl-3 pr-2 py-2.5 text-left transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/30 border-l-2 border-transparent"
        >
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[10px] font-mono uppercase tracking-wider leading-tight flex-1">
            Podcast Digest History
          </span>
        </a>
      </nav>
    </aside>
  );
}
