import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  useGetChannels,
  useCreateChannel,
  useUpdateChannel,
  useDeleteChannel,
  useGetDashboardRuns,
  getGetChannelsQueryKey,
  getGetDashboardRunsQueryKey,
  RunsData,
  VideoRecord,
} from "@workspace/api-client-react";
import { TrackedChannel } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Youtube,
  Loader2,
  AlertCircle,
  Pencil,
  Check,
  X,
  ChevronUp,
  CheckCircle2,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function parseYouTubeInput(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
      if (url.pathname.startsWith("/@")) return url.pathname.slice(1);
      if (url.pathname.startsWith("/channel/"))
        return url.pathname.slice("/channel/".length);
      if (url.pathname.startsWith("/c/"))
        return "@" + url.pathname.slice("/c/".length);
      if (url.pathname.startsWith("/user/"))
        return "@" + url.pathname.slice("/user/".length);
    }
  } catch {
    // not a URL
  }
  return trimmed;
}

function suggestDisplayName(handle: string): string {
  const base = handle.replace(/^@/, "").replace(/[-_]/g, " ");
  return base
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AddingProgressBar() {
  const [width, setWidth] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = 90 * (1 - Math.exp(-elapsed / 2800));
      setWidth(pct);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="h-0.5 w-full bg-muted overflow-hidden">
      <div
        className="h-full bg-primary transition-none"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function ChannelRow({
  ch,
  onDelete,
  isDeleting,
  knownScraperNames,
  mappedScraperNames,
  lastSeenMap,
}: {
  ch: TrackedChannel;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  knownScraperNames: string[];
  mappedScraperNames: Set<string>;
  lastSeenMap: Map<string, string>;
}) {
  const queryClient = useQueryClient();
  const [editingScraperName, setEditingScraperName] = useState(false);
  const [scraperNameInput, setScraperNameInput] = useState(
    ch.scraperName ?? "",
  );
  const [editError, setEditError] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    if (!editingScraperName || knownScraperNames.length === 0) return [];
    const q = scraperNameInput.toLowerCase();
    // Exact match → no suggestions needed
    if (knownScraperNames.some((n) => n.toLowerCase() === q)) return [];
    return knownScraperNames
      .filter((n) => !q || n.toLowerCase().includes(q))
      .slice(0, 6);
  }, [editingScraperName, scraperNameInput, knownScraperNames]);

  const { mutate: updateChannel, isPending: isUpdating } = useUpdateChannel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
        setEditingScraperName(false);
        setEditError(null);
      },
      onError: () => setEditError("Failed to save"),
    },
  });

  function handleSaveScraperName() {
    const val = scraperNameInput.trim() || null;
    updateChannel({ id: ch.id, data: { scraperName: val } });
  }

  function handleCancelEdit() {
    setScraperNameInput(ch.scraperName ?? "");
    setEditingScraperName(false);
    setEditError(null);
  }

  return (
    <div className="border border-border/50 bg-background/50 hover:border-border/80 transition-colors">
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Youtube className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <div className="min-w-0">
            <div className="font-mono text-xs text-foreground truncate leading-tight">
              {ch.displayName}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground leading-tight flex items-center gap-1.5">
              <span className="truncate">{ch.youtubeHandle}</span>
              <span className="opacity-40">·</span>
              <span className="shrink-0 opacity-60">{formatDate(ch.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {ch.scraperName ? (() => {
            const lastSeen = lastSeenMap.get(ch.scraperName);
            if (lastSeen) {
              const d = new Date(lastSeen + "T00:00:00Z");
              const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
              return (
                <Badge
                  variant="outline"
                  className="rounded-none font-mono text-[9px] border-emerald-500/40 text-emerald-400 bg-emerald-500/10 px-1 py-0 gap-1"
                  title={`Last seen in telemetry: ${lastSeen}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  {label}
                </Badge>
              );
            }
            return (
              <Badge
                variant="outline"
                className="rounded-none font-mono text-[9px] border-amber-500/30 text-amber-400 bg-amber-500/10 px-1 py-0"
                title="Scraper name set but not yet seen in telemetry"
              >
                UNSEEN
              </Badge>
            );
          })() : (
            <Badge
              variant="outline"
              className="rounded-none font-mono text-[9px] border-border/40 text-muted-foreground bg-muted/10 px-1 py-0"
            >
              NO_MAP
            </Badge>
          )}
          <button
            onClick={() => setEditingScraperName((v) => !v)}
            className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20"
            title="Set scraper name"
          >
            {editingScraperName ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <Pencil className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => onDelete(ch.id)}
            disabled={isDeleting}
            className="p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/30 disabled:opacity-50"
            title="Remove channel"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {editingScraperName && (
        <div className="px-3 pb-3 pt-1 border-t border-border/30 bg-muted/10 space-y-1.5">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Scraper name — exact string your VPS reports for this channel
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={scraperNameInput}
              onChange={(e) => setScraperNameInput(e.target.value)}
              placeholder={`e.g. ${ch.displayName} Podcast`}
              className="flex-1 bg-background border border-border px-3 py-1.5 text-[12px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary rounded-none"
              disabled={isUpdating}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveScraperName();
                if (e.key === "Escape") handleCancelEdit();
              }}
              autoFocus
            />
            <button
              onClick={handleSaveScraperName}
              disabled={isUpdating}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 text-[11px] font-mono hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={isUpdating}
              className="flex items-center gap-1 px-3 py-1.5 bg-transparent text-muted-foreground border border-border text-[11px] font-mono hover:text-foreground transition-colors disabled:opacity-50"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* ── Suggestions from live telemetry ── */}
          {suggestions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest opacity-60">
                Seen in telemetry — click to use
              </div>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((name) => {
                  const inUse = mappedScraperNames.has(name) && name !== ch.scraperName;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setScraperNameInput(name)}
                      disabled={isUpdating}
                      title={inUse ? "Already mapped to another channel" : undefined}
                      className={`px-2 py-0.5 border text-[10px] font-mono transition-colors rounded-none ${
                        inUse
                          ? "border-border/40 text-muted-foreground/40 cursor-default"
                          : "border-primary/30 text-primary bg-primary/5 hover:bg-primary/15"
                      }`}
                    >
                      {name}
                      {inUse && <span className="ml-1 opacity-50">·used</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* No telemetry available yet */}
          {knownScraperNames.length === 0 && (
            <div className="text-[10px] font-mono text-muted-foreground opacity-40">
              No telemetry seen yet — type the exact string your VPS reports
            </div>
          )}

          {editError && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-red-400">
              <AlertCircle className="w-3 h-3" />
              {editError}
            </div>
          )}
          {ch.scraperName && (
            <div className="text-[10px] font-mono text-muted-foreground opacity-60">
              Currently: <span className="text-foreground">{ch.scraperName}</span>
              {" · "}
              <button
                onClick={() => {
                  setScraperNameInput("");
                  updateChannel({ id: ch.id, data: { scraperName: null } });
                }}
                className="text-red-400/70 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type AddState =
  | { kind: "idle" }
  | { kind: "adding" }
  | { kind: "success"; handle: string }
  | { kind: "duplicate"; handle: string }
  | { kind: "error"; message: string };

export default function ChannelManager() {
  const queryClient = useQueryClient();
  const [urlInput, setUrlInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nameOverrideOpen, setNameOverrideOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [addState, setAddState] = useState<AddState>({ kind: "idle" });

  const { data: channels, isLoading } = useGetChannels({
    query: { queryKey: getGetChannelsQueryKey() },
  });

  // Pull cached run telemetry (no extra fetch — already in TanStack Query cache)
  const { data: runsData } = useGetDashboardRuns({
    query: { queryKey: getGetDashboardRunsQueryKey() },
  });

  // All unique channel name strings seen across every run's video list
  const knownScraperNames = useMemo<string[]>(() => {
    if (!runsData) return [];
    const seen = new Set<string>();
    for (const runs of Object.values(runsData as RunsData)) {
      for (const run of runs) {
        for (const v of run.videos as VideoRecord[]) {
          if (v.channel) seen.add(v.channel);
        }
      }
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [runsData]);

  // Names already claimed by another channel — used to dim suggestion chips
  const mappedScraperNames = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const ch of channels ?? []) {
      if (ch.scraperName) s.add(ch.scraperName);
    }
    return s;
  }, [channels]);

  // Most recent date each scraper-name string was seen in telemetry
  const lastSeenMap = useMemo<Map<string, string>>(() => {
    if (!runsData) return new Map();
    const map = new Map<string, string>();
    // Sort dates descending so first occurrence = most recent
    const sortedDates = Object.keys(runsData as RunsData).sort((a, b) => b.localeCompare(a));
    for (const date of sortedDates) {
      const runs = (runsData as RunsData)[date];
      for (const run of runs) {
        for (const v of run.videos as VideoRecord[]) {
          if (v.channel && !map.has(v.channel)) {
            map.set(v.channel, date);
          }
        }
      }
    }
    return map;
  }, [runsData]);

  const { mutate: createChannel } = useCreateChannel({
    mutation: {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
        const handle = (created as TrackedChannel).youtubeHandle ?? urlInput;
        setAddState({ kind: "success", handle });
        setUrlInput("");
        setDisplayName("");
        setNameOverrideOpen(false);
        setTimeout(() => setAddState({ kind: "idle" }), 3000);
      },
      onError: (err: unknown) => {
        const status = (err as { status?: number })?.status;
        const msg = (err as { data?: { error?: string } })?.data?.error;
        if (status === 409) {
          setAddState({ kind: "duplicate", handle: parsedHandle });
        } else {
          setAddState({
            kind: "error",
            message: msg ?? "Failed to add channel — please try again",
          });
        }
      },
    },
  });

  const { mutate: deleteChannel, isPending: isDeleting } = useDeleteChannel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
      },
    },
  });

  const parsedHandle = parseYouTubeInput(urlInput);
  const inferredName = parsedHandle ? suggestDisplayName(parsedHandle) : "";
  const effectiveName = displayName.trim() || inferredName;

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setUrlInput(val);
    if (addState.kind !== "idle") setAddState({ kind: "idle" });
    // Only reset override name if the user hasn't manually typed one
    if (!nameOverrideOpen) {
      setDisplayName("");
    }
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const handle = parseYouTubeInput(urlInput);
    if (!handle || !effectiveName) return;

    const exists = channels?.some(
      (ch) => ch.youtubeHandle.toLowerCase() === handle.toLowerCase(),
    );
    if (exists) {
      setAddState({ kind: "duplicate", handle });
      return;
    }

    setAddState({ kind: "adding" });
    createChannel({ data: { displayName: effectiveName, youtubeHandle: handle } });
  }

  const isDuplicateInline =
    !!parsedHandle &&
    !!channels?.some(
      (ch) => ch.youtubeHandle.toLowerCase() === parsedHandle.toLowerCase(),
    );

  const canSubmit =
    !!parsedHandle &&
    !!effectiveName &&
    addState.kind !== "adding" &&
    !isDuplicateInline;

  // Filter channel list
  const lowerFilter = filterQuery.toLowerCase();
  const filteredChannels = channels?.filter(
    (ch) =>
      !filterQuery ||
      ch.displayName.toLowerCase().includes(lowerFilter) ||
      ch.youtubeHandle.toLowerCase().includes(lowerFilter),
  );

  const showFilter = (channels?.length ?? 0) >= 5;

  return (
    <div className="space-y-3">
      {/* ── Add form ── */}
      <form onSubmit={handleAdd} className="space-y-2">
        {/* URL input */}
        <div className="relative">
          <input
            type="text"
            placeholder="YouTube URL or @handle"
            value={urlInput}
            onChange={handleUrlChange}
            className={`w-full bg-background border px-3 py-1.5 text-[12px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none rounded-none transition-colors ${
              isDuplicateInline
                ? "border-amber-500/60 focus:border-amber-500"
                : "border-border focus:border-primary"
            }`}
            disabled={addState.kind === "adding"}
          />
          {isDuplicateInline && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                tracked
              </span>
            </div>
          )}
        </div>

        {/* Inferred name chip — shown when there's a parsed handle and no duplicate */}
        {parsedHandle && !isDuplicateInline && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] font-mono text-muted-foreground">→</span>
            {nameOverrideOpen ? (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={inferredName}
                  className="flex-1 bg-background border border-border px-2 py-1 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary rounded-none"
                  disabled={addState.kind === "adding"}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    setDisplayName("");
                    setNameOverrideOpen(false);
                  }}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Use inferred name"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
                <span className="text-[10px] font-mono text-primary flex-1 truncate">
                  {effectiveName}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDisplayName(inferredName);
                    setNameOverrideOpen(true);
                  }}
                  className="p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  title="Edit display name"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
        >
          {addState.kind === "adding" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {addState.kind === "adding" ? "Adding…" : "Add Channel"}
        </button>

        {addState.kind === "adding" && <AddingProgressBar />}
      </form>

      {/* ── Status feedback ── */}
      {addState.kind === "duplicate" && (
        <div className="flex items-center gap-2 px-3 py-2 border border-amber-500/30 bg-amber-500/5 text-[11px] font-mono text-amber-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            <span className="text-foreground">{addState.handle}</span> is
            already being tracked.
          </span>
        </div>
      )}

      {addState.kind === "error" && (
        <div className="flex items-start gap-2 px-3 py-2 border border-red-500/30 bg-red-500/5 text-[11px] font-mono text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          <div className="space-y-1">
            <div>{addState.message}</div>
            <button
              onClick={() => setAddState({ kind: "idle" })}
              className="text-[10px] text-red-400/70 hover:text-red-400 underline transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {addState.kind === "success" && (
        <div className="flex items-center gap-2 px-3 py-2 border border-emerald-500/30 bg-emerald-500/5 text-[11px] font-mono text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>
            <span className="text-foreground">{addState.handle}</span> added
            successfully.
          </span>
        </div>
      )}

      {/* ── Filter ── */}
      {showFilter && !isLoading && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Filter channels…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-background border border-border pl-7 pr-3 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary rounded-none"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* ── Channel list ── */}
      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full bg-muted" />
          ))}
        </div>
      ) : !channels || channels.length === 0 ? (
        <div className="py-4 text-center text-[11px] font-mono text-muted-foreground uppercase tracking-wider border border-dashed border-border">
          No channels tracked yet — add one above
        </div>
      ) : filteredChannels && filteredChannels.length === 0 ? (
        <div className="py-3 text-center text-[11px] font-mono text-muted-foreground border border-dashed border-border">
          No channels match "{filterQuery}"
        </div>
      ) : (
        <div className="space-y-px">
          {filteredChannels?.map((ch) => (
            <ChannelRow
              key={ch.id}
              ch={ch}
              onDelete={(id) => deleteChannel({ id })}
              isDeleting={isDeleting}
              knownScraperNames={knownScraperNames}
              mappedScraperNames={mappedScraperNames}
              lastSeenMap={lastSeenMap}
            />
          ))}
          <div className="text-[10px] font-mono text-muted-foreground pt-1 opacity-60">
            {filterQuery
              ? `${filteredChannels?.length ?? 0} of ${channels.length} channels`
              : `${channels.length} channel${channels.length !== 1 ? "s" : ""} tracked`}
            {" · "}
            <span className="text-amber-400">NO_MAP</span> = scraper name not set
          </div>
        </div>
      )}
    </div>
  );
}
