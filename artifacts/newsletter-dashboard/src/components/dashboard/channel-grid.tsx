import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  useGetChannels,
  useCreateChannel,
  useUpdateChannel,
  useDeleteChannel,
  useGetDashboardRuns,
  useValidateChannel,
  getGetChannelsQueryKey,
  getGetDashboardRunsQueryKey,
  getValidateChannelQueryKey,
  RunsData,
  VideoRecord,
  TrackedChannel,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Trash2,
  Loader2,
  AlertCircle,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Search,
  ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseYouTubeInput(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    if (url.hostname === "www.youtube.com" || url.hostname === "youtube.com") {
      if (url.pathname.startsWith("/@")) return url.pathname.slice(1);
      if (url.pathname.startsWith("/channel/")) return url.pathname.slice("/channel/".length);
      if (url.pathname.startsWith("/c/")) return "@" + url.pathname.slice("/c/".length);
      if (url.pathname.startsWith("/user/")) return "@" + url.pathname.slice("/user/".length);
    }
  } catch {
    // not a URL
  }
  return trimmed;
}

/** Returns true for raw YouTube channel IDs like UCf_KhBXw5TIV0A7butjgFhg */
function isChannelId(handle: string): boolean {
  return /^UC[\w-]{22}$/.test(handle);
}

function suggestDisplayName(handle: string): string {
  if (isChannelId(handle)) return ""; // never guess names from opaque channel IDs
  const base = handle.replace(/^@/, "").replace(/[-_]/g, " ");
  return base
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatLastSeen(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function isWithin14Days(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00Z");
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 14);
  cutoff.setUTCHours(0, 0, 0, 0);
  return d >= cutoff;
}

const AVATAR_PALETTES = [
  { bg: "bg-emerald-900/70", text: "text-emerald-300" },
  { bg: "bg-blue-900/70",    text: "text-blue-300" },
  { bg: "bg-purple-900/70",  text: "text-purple-300" },
  { bg: "bg-amber-900/70",   text: "text-amber-300" },
  { bg: "bg-cyan-900/70",    text: "text-cyan-300" },
  { bg: "bg-rose-900/70",    text: "text-rose-300" },
  { bg: "bg-indigo-900/70",  text: "text-indigo-300" },
  { bg: "bg-lime-900/70",    text: "text-lime-300" },
];

function avatarPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Progress bar ────────────────────────────────────────────────────────────

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
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);
  return (
    <div className="h-0.5 w-full bg-muted overflow-hidden">
      <div className="h-full bg-primary transition-none" style={{ width: `${width}%` }} />
    </div>
  );
}

// ─── Channel card ────────────────────────────────────────────────────────────

type ChannelStatus = "active" | "idle" | "nomap";

interface ChannelCardProps {
  ch: TrackedChannel;
  status: ChannelStatus;
  lastSeen: string | undefined;
  onDelete: (id: number) => void;
  isDeleting: boolean;
  knownScraperNames: string[];
  mappedScraperNames: Set<string>;
}

function ChannelCard({
  ch,
  status,
  lastSeen,
  onDelete,
  isDeleting,
  knownScraperNames,
  mappedScraperNames,
}: ChannelCardProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [scraperNameInput, setScraperNameInput] = useState(ch.scraperName ?? "");
  const [editError, setEditError] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    if (!expanded || knownScraperNames.length === 0) return [];
    const q = scraperNameInput.toLowerCase();
    if (knownScraperNames.some((n) => n.toLowerCase() === q)) return [];
    return knownScraperNames.filter((n) => !q || n.toLowerCase().includes(q)).slice(0, 6);
  }, [expanded, scraperNameInput, knownScraperNames]);

  const { mutate: updateChannel, isPending: isUpdating } = useUpdateChannel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
        setEditError(null);
      },
      onError: () => setEditError("Failed to save"),
    },
  });

  function handleSave() {
    const val = scraperNameInput.trim() || null;
    updateChannel({ id: ch.id, data: { scraperName: val } });
  }

  function handleCancel() {
    setScraperNameInput(ch.scraperName ?? "");
    setExpanded(false);
    setEditError(null);
  }

  const palette = avatarPalette(ch.displayName);
  const abbr = initials(ch.displayName);

  const dotClass =
    status === "active"
      ? "bg-emerald-400"
      : status === "idle"
        ? "bg-amber-500/50"
        : "bg-border/40";

  return (
    <div className="border border-border/50 bg-card hover:border-border transition-colors flex flex-col">
      {/* ── Card body ── */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Top row: avatar + activity dot */}
        <div className="flex items-start justify-between">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${palette.bg}`}>
            <span className={`text-[11px] font-mono font-bold ${palette.text}`}>{abbr}</span>
          </div>
          <span
            className={`w-2 h-2 rounded-full mt-0.5 shrink-0 ${dotClass} ${status === "active" ? "animate-pulse" : ""}`}
            title={
              status === "active" ? `Active — last seen ${lastSeen}` :
              status === "idle" ? "Idle — not seen recently" :
              "No scraper mapping set"
            }
          />
        </div>

        {/* Name + handle */}
        <div className="min-w-0">
          <div className="font-mono text-[12px] font-semibold text-foreground truncate leading-tight">
            {ch.displayName}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
            {ch.youtubeHandle}
          </div>
        </div>

        {/* Last seen + expand toggle */}
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-border/30">
          <span className="font-mono text-[9px] text-muted-foreground/60 uppercase tracking-wider">
            {lastSeen ? `Last ${formatLastSeen(lastSeen)}` : "—"}
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            title={expanded ? "Collapse" : "Edit scraper mapping"}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* ── Expanded: scraper editor ── */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/10 px-3 py-2.5 space-y-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider opacity-70">
            Scraper name — exact string your VPS reports
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={scraperNameInput}
              onChange={(e) => setScraperNameInput(e.target.value)}
              placeholder={`e.g. ${ch.displayName}`}
              className="flex-1 min-w-0 bg-background border border-border px-2 py-1 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary rounded-none"
              disabled={isUpdating}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={isUpdating}
              className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary border border-primary/30 text-[10px] font-mono hover:bg-primary/20 transition-colors disabled:opacity-50 shrink-0"
            >
              {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={isUpdating}
              className="p-1 text-muted-foreground border border-border hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest opacity-50">
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
                      className={`px-1.5 py-0.5 border text-[9px] font-mono transition-colors rounded-none ${
                        inUse
                          ? "border-border/30 text-muted-foreground/30 cursor-default"
                          : "border-primary/30 text-primary bg-primary/5 hover:bg-primary/15"
                      }`}
                    >
                      {name}{inUse && <span className="ml-0.5 opacity-50">·used</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {knownScraperNames.length === 0 && (
            <div className="text-[9px] font-mono text-muted-foreground opacity-40">
              No telemetry yet — type the exact string your VPS reports
            </div>
          )}

          {editError && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-red-400">
              <AlertCircle className="w-3 h-3" /> {editError}
            </div>
          )}

          {ch.scraperName && (
            <div className="text-[9px] font-mono text-muted-foreground opacity-60 flex items-center gap-1">
              <span>Current: <span className="text-foreground">{ch.scraperName}</span></span>
              <span>·</span>
              <button
                onClick={() => { setScraperNameInput(""); updateChannel({ id: ch.id, data: { scraperName: null } }); }}
                className="text-red-400/60 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            </div>
          )}

          <div className="pt-1 border-t border-border/30">
            <button
              onClick={() => onDelete(ch.id)}
              disabled={isDeleting}
              className="flex items-center gap-1 text-[9px] font-mono text-red-400/50 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3 h-3" />
              Remove channel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add state ───────────────────────────────────────────────────────────────

type AddState =
  | { kind: "idle" }
  | { kind: "adding" }
  | { kind: "success"; handle: string }
  | { kind: "duplicate"; handle: string }
  | { kind: "error"; message: string };

type FilterTab = "all" | "active" | "idle";

// ─── Channel grid ─────────────────────────────────────────────────────────────

export default function ChannelGrid() {
  const queryClient = useQueryClient();
  const [urlInput, setUrlInput] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nameOverrideOpen, setNameOverrideOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [addState, setAddState] = useState<AddState>({ kind: "idle" });
  const [debouncedHandle, setDebouncedHandle] = useState("");

  // Capture current parsedHandle in a ref for use inside mutation callbacks
  const pendingHandleRef = useRef<string>("");
  // Track whether the user has manually typed in the display name field
  const userEditedNameRef = useRef(false);

  const { data: channels, isLoading } = useGetChannels({
    query: { queryKey: getGetChannelsQueryKey() },
  });

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

  // Names already claimed by a channel — dims suggestion chips
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
    const sortedDates = Object.keys(runsData as RunsData).sort((a, b) => b.localeCompare(a));
    for (const date of sortedDates) {
      const runs = (runsData as RunsData)[date];
      for (const run of runs) {
        for (const v of run.videos as VideoRecord[]) {
          if (v.channel && !map.has(v.channel)) map.set(v.channel, date);
        }
      }
    }
    return map;
  }, [runsData]);

  const { mutate: createChannel } = useCreateChannel({
    mutation: {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
        const handle = (created as TrackedChannel).youtubeHandle ?? pendingHandleRef.current;
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
          setAddState({ kind: "duplicate", handle: pendingHandleRef.current });
        } else {
          setAddState({ kind: "error", message: msg ?? "Failed to add channel" });
        }
      },
    },
  });

  const { mutate: deleteChannel, isPending: isDeleting } = useDeleteChannel({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() }),
    },
  });

  const parsedHandle = parseYouTubeInput(urlInput);
  const inferredName = parsedHandle ? suggestDisplayName(parsedHandle) : "";
  const effectiveName = displayName.trim() || inferredName;

  // Debounce: only fire the validation query 700 ms after the user stops typing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (!parsedHandle) { setDebouncedHandle(""); return; }
    debounceTimerRef.current = setTimeout(() => setDebouncedHandle(parsedHandle), 700);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [parsedHandle]);

  // Validate the channel via YouTube RSS — fires once debounce settles
  const {
    data: validation,
    isFetching: validating,
    error: validationError,
  } = useValidateChannel(
    { handle: debouncedHandle },
    {
      query: {
        queryKey: getValidateChannelQueryKey({ handle: debouncedHandle }),
        enabled: !!debouncedHandle,
        staleTime: 60_000,
        retry: false,
        gcTime: 5 * 60 * 1000,
      },
    },
  );

  // Auto-fill display name from YouTube RSS channel name when validation succeeds
  useEffect(() => {
    if (validation?.channelName && !userEditedNameRef.current) {
      setDisplayName(validation.channelName);
      setNameOverrideOpen(true);
    }
  }, [validation]);

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUrlInput(e.target.value);
    userEditedNameRef.current = false;
    if (addState.kind !== "idle") setAddState({ kind: "idle" });
    if (!nameOverrideOpen) setDisplayName("");
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const handle = parseYouTubeInput(urlInput);
    if (!handle || !effectiveName) return;
    const exists = channels?.some((ch) => ch.youtubeHandle.toLowerCase() === handle.toLowerCase());
    if (exists) { setAddState({ kind: "duplicate", handle }); return; }
    pendingHandleRef.current = handle;
    setAddState({ kind: "adding" });
    createChannel({ data: { displayName: effectiveName, youtubeHandle: handle } });
  }

  function handleClearInput() {
    setUrlInput("");
    setDisplayName("");
    setNameOverrideOpen(false);
    setAddState({ kind: "idle" });
    setDebouncedHandle("");
    userEditedNameRef.current = false;
  }

  const isDuplicateInline =
    !!parsedHandle &&
    !!channels?.some((ch) => ch.youtubeHandle.toLowerCase() === parsedHandle.toLowerCase());

  // Still waiting for the debounce timer to fire
  const isDebouncing = !!parsedHandle && parsedHandle !== debouncedHandle;

  const canSubmit =
    !!parsedHandle &&
    !!effectiveName &&
    addState.kind !== "adding" &&
    !isDuplicateInline &&
    !isDebouncing &&
    !validating &&
    !!validation &&
    !validationError;

  // Derive status per channel
  function channelStatus(ch: TrackedChannel): ChannelStatus {
    if (!ch.scraperName) return "nomap";
    const lastSeen = lastSeenMap.get(ch.scraperName);
    if (lastSeen && isWithin14Days(lastSeen)) return "active";
    return "idle";
  }

  // Counts
  const allChannels = channels ?? [];
  const activeCount = allChannels.filter((ch) => channelStatus(ch) === "active").length;
  const idleCount = allChannels.filter((ch) => channelStatus(ch) !== "active").length;

  // Filter
  const lowerQ = filterQuery.toLowerCase();
  const filteredBySearch = allChannels.filter(
    (ch) =>
      !filterQuery ||
      ch.displayName.toLowerCase().includes(lowerQ) ||
      ch.youtubeHandle.toLowerCase().includes(lowerQ),
  );

  const displayChannels = filteredBySearch.filter((ch) => {
    if (filterTab === "active") return channelStatus(ch) === "active";
    if (filterTab === "idle") return channelStatus(ch) !== "active";
    return true;
  });

  const showSearch = allChannels.length >= 5;

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-sm font-mono font-bold tracking-[0.2em] text-foreground uppercase">
            Accounts Tracked
          </h1>
          <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest mt-0.5">
            YouTube channels currently monitored for new content
          </p>
        </div>
        {allChannels.length > 0 && (
          <span className="shrink-0 text-[9px] font-mono px-2 py-1 border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 uppercase tracking-wider whitespace-nowrap">
            {activeCount} channel{activeCount !== 1 ? "s" : ""} active
          </span>
        )}
      </div>

      {/* ── Add channel form ── */}
      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            placeholder="https://www.youtube.com/@handle"
            value={urlInput}
            onChange={handleUrlChange}
            className={`flex-1 min-w-0 bg-background border px-3 py-2 text-[12px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none rounded-none transition-colors ${
              isDuplicateInline ? "border-amber-500/60" : "border-border focus:border-primary"
            }`}
            disabled={addState.kind === "adding"}
          />
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary border border-primary/30 text-[11px] font-mono hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 whitespace-nowrap"
          >
            <Check className="w-3 h-3" />
            Confirm Add
          </button>
          {urlInput && (
            <button
              type="button"
              onClick={handleClearInput}
              className="p-2 text-muted-foreground border border-border hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Adding progress */}
        {addState.kind === "adding" && <AddingProgressBar />}

        {/* Validation status panel */}
        {parsedHandle && addState.kind === "idle" && !isDuplicateInline && (
          <>
            {/* Debouncing — still typing */}
            {isDebouncing && (
              <div className="flex items-center gap-2 px-3 py-1.5 border border-border/20 bg-muted/5 text-[10px] font-mono text-muted-foreground/30">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span>Identifying channel…</span>
              </div>
            )}

            {/* Fetching RSS from YouTube */}
            {!isDebouncing && validating && (
              <div className="flex items-center gap-2 px-3 py-2 border border-border/40 bg-muted/20 text-[10px] font-mono text-muted-foreground/60">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                <span>Validating channel via YouTube RSS…</span>
              </div>
            )}

            {/* Validation failed */}
            {!isDebouncing && !validating && validationError && (
              <div className="flex items-start gap-2 px-3 py-2 border border-red-500/30 bg-red-500/5 text-[10px] font-mono">
                <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-red-400 font-semibold">Channel validation failed</div>
                  <div className="text-red-400/60 mt-0.5">
                    {((validationError as { data?: { error?: string } })?.data?.error) ?? "Could not reach YouTube — try again"}
                  </div>
                </div>
              </div>
            )}

            {/* Validation success: channel name + video list */}
            {!isDebouncing && !validating && validation && (
              <div className="border border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-500/15">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold truncate">
                    {validation.channelName ?? parsedHandle}
                  </span>
                  <span className="text-muted-foreground/25 text-[10px] shrink-0">·</span>
                  <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider shrink-0">
                    {validation.videos.length} video{validation.videos.length !== 1 ? "s" : ""}
                    {" / last "}{validation.lookbackDays}d
                  </span>
                  {validation.lookbackDays === 90 && (
                    <span className="ml-auto text-[8px] font-mono text-amber-400/60 uppercase tracking-wider shrink-0">
                      quiet last 14d
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border/15 max-h-48 overflow-y-auto">
                  {validation.videos.slice(0, 10).map((v, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/10 transition-colors">
                      <span className="text-[9px] font-mono text-muted-foreground/25 tabular-nums w-4 shrink-0 text-right">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-[10px] font-mono text-foreground/65 truncate">
                        {v.title}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground/35 shrink-0">
                        {new Date(v.publishedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground/25 hover:text-primary transition-colors shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Display name — auto-opened + filled by validation; user can still edit */}
        {nameOverrideOpen && addState.kind === "idle" && (
          <div className="flex items-center gap-2">
            <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider shrink-0">Name</div>
            <input
              type="text"
              placeholder={inferredName || "Display name"}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                userEditedNameRef.current = true;
              }}
              className="flex-1 bg-background border border-primary/40 px-3 py-1.5 text-[12px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary rounded-none"
            />
            <button
              type="button"
              onClick={() => {
                const reset = validation?.channelName ?? "";
                setDisplayName(reset);
                userEditedNameRef.current = false;
                if (!reset) setNameOverrideOpen(false);
              }}
              className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 border border-border shrink-0"
            >
              Reset
            </button>
          </div>
        )}

        {addState.kind === "success" && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 py-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Added {addState.handle}
          </div>
        )}
        {addState.kind === "duplicate" && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400 py-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {addState.handle} is already tracked
          </div>
        )}
        {addState.kind === "error" && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-red-400 py-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {addState.message}
          </div>
        )}
      </form>

      {/* ── Filter row ── */}
      {allChannels.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
              <input
                type="text"
                placeholder="Search channels..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="bg-background border border-border pl-7 pr-3 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary rounded-none transition-colors w-44"
              />
            </div>
          )}
          <div className="flex items-center border border-border/60">
            {(
              [
                { id: "all" as FilterTab,    label: "All",    count: allChannels.length },
                { id: "active" as FilterTab, label: "Active", count: activeCount },
                { id: "idle" as FilterTab,   label: "Idle",   count: idleCount },
              ]
            ).map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => setFilterTab(id)}
                className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                  filterTab === id
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                } ${id !== "all" ? "border-l border-border/60" : ""}`}
              >
                {label}
                <span className={`text-[9px] tabular-nums ${filterTab === id ? "text-primary/80" : "text-muted-foreground/50"}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
          {filterQuery && (
            <span className="text-[9px] font-mono text-muted-foreground/50">
              {displayChannels.length} of {allChannels.length}
            </span>
          )}
        </div>
      )}

      {/* ── Card grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full bg-muted/40" />
          ))}
        </div>
      ) : displayChannels.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-widest">
            {allChannels.length === 0 ? "No channels tracked yet — add one above" : "No channels match filter"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {displayChannels.map((ch) => {
            const st = channelStatus(ch);
            const ls = ch.scraperName ? lastSeenMap.get(ch.scraperName) : undefined;
            return (
              <ChannelCard
                key={ch.id}
                ch={ch}
                status={st}
                lastSeen={ls}
                onDelete={(id) => deleteChannel({ id })}
                isDeleting={isDeleting}
                knownScraperNames={knownScraperNames}
                mappedScraperNames={mappedScraperNames}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
