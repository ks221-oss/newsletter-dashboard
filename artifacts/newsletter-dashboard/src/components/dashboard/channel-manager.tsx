import React, { useState, useEffect, useRef } from "react";
import {
  useGetChannels,
  useCreateChannel,
  useUpdateChannel,
  useDeleteChannel,
  getGetChannelsQueryKey,
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
      // Eases toward 90% over ~3s, never reaches 100 (server controls completion)
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
}: {
  ch: TrackedChannel;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}) {
  const queryClient = useQueryClient();
  const [editingScraperName, setEditingScraperName] = useState(false);
  const [scraperNameInput, setScraperNameInput] = useState(
    ch.scraperName ?? "",
  );
  const [editError, setEditError] = useState<string | null>(null);

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
      <div className="flex items-center justify-between px-3 py-2 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Youtube className="w-4 h-4 text-red-500 shrink-0" />
          <div className="min-w-0">
            <div className="font-mono text-sm text-foreground truncate">
              {ch.displayName}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {ch.youtubeHandle}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:block text-[10px] font-mono text-muted-foreground opacity-60">
            {formatDate(ch.createdAt)}
          </span>
          {ch.scraperName ? (
            <Badge
              variant="outline"
              className="rounded-none font-mono text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
            >
              MAPPED
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="rounded-none font-mono text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10"
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
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <Pencil className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => onDelete(ch.id)}
            disabled={isDeleting}
            className="p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/30 disabled:opacity-50"
            title="Remove channel"
          >
            <Trash2 className="w-3.5 h-3.5" />
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
  const [nameTouched, setNameTouched] = useState(false);
  const [addState, setAddState] = useState<AddState>({ kind: "idle" });

  const { data: channels, isLoading } = useGetChannels({
    query: { queryKey: getGetChannelsQueryKey() },
  });

  const { mutate: createChannel } = useCreateChannel({
    mutation: {
      onSuccess: (created) => {
        queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
        const handle =
          (created as TrackedChannel).youtubeHandle ?? urlInput;
        setAddState({ kind: "success", handle });
        setUrlInput("");
        setDisplayName("");
        setNameTouched(false);
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

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setUrlInput(val);
    if (addState.kind !== "idle") setAddState({ kind: "idle" });
    if (!nameTouched) {
      const parsed = parseYouTubeInput(val);
      if (parsed) setDisplayName(suggestDisplayName(parsed));
      else setDisplayName("");
    }
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const handle = parseYouTubeInput(urlInput);
    if (!handle || !displayName.trim()) return;

    // Client-side duplicate check
    const exists = channels?.some(
      (ch) => ch.youtubeHandle.toLowerCase() === handle.toLowerCase(),
    );
    if (exists) {
      setAddState({ kind: "duplicate", handle });
      return;
    }

    setAddState({ kind: "adding" });
    createChannel({ data: { displayName: displayName.trim(), youtubeHandle: handle } });
  }

  const parsedHandle = parseYouTubeInput(urlInput);

  const isDuplicateInline =
    !!parsedHandle &&
    !!channels?.some(
      (ch) => ch.youtubeHandle.toLowerCase() === parsedHandle.toLowerCase(),
    );

  const canSubmit =
    !!parsedHandle &&
    !!displayName.trim() &&
    addState.kind !== "adding" &&
    !isDuplicateInline;

  return (
    <div className="space-y-3">
      {/* ── Add form ── */}
      <form onSubmit={handleAdd} className="space-y-2">
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

        {parsedHandle && parsedHandle !== urlInput.trim() && !isDuplicateInline && (
          <div className="text-[10px] font-mono text-muted-foreground px-1">
            → <span className="text-primary">{parsedHandle}</span>
          </div>
        )}

        <input
          type="text"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setNameTouched(true);
          }}
          className="w-full bg-background border border-border px-3 py-1.5 text-[12px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary rounded-none"
          disabled={addState.kind === "adding"}
        />

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

        {/* Progress bar — shown only while adding */}
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
      ) : (
        <div className="space-y-px">
          {channels.map((ch) => (
            <ChannelRow
              key={ch.id}
              ch={ch}
              onDelete={(id) => deleteChannel({ id })}
              isDeleting={isDeleting}
            />
          ))}
          <div className="text-[10px] font-mono text-muted-foreground pt-1 opacity-60">
            {channels.length} channel{channels.length !== 1 ? "s" : ""} tracked
            {" · "}
            <span className="text-amber-400">NO_MAP</span> = scraper name not set
            {" · "}
            <span className="text-emerald-400">MAPPED</span> = telemetry matched
          </div>
        </div>
      )}
    </div>
  );
}
