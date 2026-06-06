import React, { useState } from "react";
import {
  useGetChannels,
  useCreateChannel,
  useUpdateChannel,
  useDeleteChannel,
  getGetChannelsQueryKey,
} from "@workspace/api-client-react";
import { TrackedChannel } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Youtube, Loader2, AlertCircle, Pencil, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ChannelRow({ ch, onDelete, isDeleting }: { ch: TrackedChannel; onDelete: (id: number) => void; isDeleting: boolean }) {
  const queryClient = useQueryClient();
  const [editingScraperName, setEditingScraperName] = useState(false);
  const [scraperNameInput, setScraperNameInput] = useState(ch.scraperName ?? "");
  const [editError, setEditError] = useState<string | null>(null);

  const { mutate: updateChannel, isPending: isUpdating } = useUpdateChannel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
        setEditingScraperName(false);
        setEditError(null);
      },
      onError: () => {
        setEditError("Failed to save");
      },
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
      {/* Main row */}
      <div className="flex items-center justify-between px-3 py-2 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Youtube className="w-4 h-4 text-red-500 shrink-0" />
          <div className="min-w-0">
            <div className="font-mono text-sm text-foreground truncate">{ch.displayName}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{ch.youtubeHandle}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:block text-[10px] font-mono text-muted-foreground opacity-60">
            Added {formatDate(ch.createdAt)}
          </span>
          {ch.scraperName ? (
            <Badge variant="outline" className="rounded-none font-mono text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
              MAPPED
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-none font-mono text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/10">
              NO_MAP
            </Badge>
          )}
          <button
            onClick={() => setEditingScraperName((v) => !v)}
            className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20 rounded-none"
            title="Set scraper name"
          >
            {editingScraperName ? <ChevronUp className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onDelete(ch.id)}
            disabled={isDeleting}
            className="p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/30 rounded-none disabled:opacity-50"
            title="Remove channel"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inline scraper name editor */}
      {editingScraperName && (
        <div className="px-3 pb-3 pt-1 border-t border-border/30 bg-muted/10 space-y-1.5">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Scraper name — exact string your VPS reports as the channel name
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
              className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary border border-primary/30 text-[11px] font-mono hover:bg-primary/20 transition-colors disabled:opacity-50 rounded-none"
            >
              {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={isUpdating}
              className="flex items-center gap-1 px-3 py-1.5 bg-transparent text-muted-foreground border border-border text-[11px] font-mono hover:text-foreground transition-colors disabled:opacity-50 rounded-none"
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
                onClick={() => { setScraperNameInput(""); updateChannel({ id: ch.id, data: { scraperName: null } }); }}
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

export default function ChannelManager() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [youtubeHandle, setYoutubeHandle] = useState("");
  const [scraperName, setScraperName] = useState("");
  const [showScraperField, setShowScraperField] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const { data: channels, isLoading } = useGetChannels({
    query: { queryKey: getGetChannelsQueryKey() },
  });

  const { mutate: createChannel, isPending: isCreating } = useCreateChannel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
        setDisplayName("");
        setYoutubeHandle("");
        setScraperName("");
        setShowScraperField(false);
        setAddError(null);
      },
      onError: (err: unknown) => {
        const msg = (err as { data?: { error?: string } })?.data?.error;
        setAddError(msg ?? "Failed to add channel");
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

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !youtubeHandle.trim()) return;
    setAddError(null);
    createChannel({
      data: {
        displayName: displayName.trim(),
        youtubeHandle: youtubeHandle.trim(),
        scraperName: scraperName.trim() || null,
      },
    });
  }

  return (
    <div className="bg-card border border-border p-4 space-y-4">
      {/* Add form */}
      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Display name (e.g. Lex Fridman)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="flex-1 bg-background border border-border px-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary rounded-none"
            disabled={isCreating}
          />
          <input
            type="text"
            placeholder="YouTube handle (e.g. @lexfridman)"
            value={youtubeHandle}
            onChange={(e) => setYoutubeHandle(e.target.value)}
            className="flex-1 bg-background border border-border px-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary rounded-none"
            disabled={isCreating}
          />
          <button
            type="submit"
            disabled={isCreating || !displayName.trim() || !youtubeHandle.trim()}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-none"
          >
            {isCreating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Add Channel
          </button>
        </div>

        {/* Optional scraper name toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowScraperField((v) => !v)}
            className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
          >
            {showScraperField ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showScraperField ? "Hide" : "Set scraper name (optional)"}
          </button>

          {showScraperField && (
            <div className="mt-2 space-y-1">
              <input
                type="text"
                placeholder="Exact name your VPS scraper reports (e.g. Lex Fridman Podcast)"
                value={scraperName}
                onChange={(e) => setScraperName(e.target.value)}
                className="w-full bg-background border border-border px-3 py-1.5 text-[12px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 rounded-none border-dashed"
                disabled={isCreating}
              />
              <p className="text-[10px] font-mono text-muted-foreground opacity-60">
                Used to match this channel in the telemetry log. Check the channel breakdown in any day row to see what your scraper reports.
              </p>
            </div>
          )}
        </div>
      </form>

      {addError && (
        <div className="flex items-center gap-2 text-[11px] font-mono text-red-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {addError}
        </div>
      )}

      {/* Channel list */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full bg-muted" />
          <Skeleton className="h-10 w-full bg-muted" />
        </div>
      ) : !channels || channels.length === 0 ? (
        <div className="py-6 text-center text-[11px] font-mono text-muted-foreground uppercase tracking-wider border border-dashed border-border">
          No channels tracked yet — add one above
        </div>
      ) : (
        <div className="space-y-1">
          {channels.map((ch) => (
            <ChannelRow
              key={ch.id}
              ch={ch}
              onDelete={(id) => deleteChannel({ id })}
              isDeleting={isDeleting}
            />
          ))}
        </div>
      )}

      {channels && channels.length > 0 && (
        <div className="text-[10px] font-mono text-muted-foreground pt-1 opacity-60">
          <span className="text-amber-400">NO_MAP</span> = scraper name not set, channel won&apos;t appear in day-row breakdown.{" "}
          <span className="text-emerald-400">MAPPED</span> = matched to telemetry data.
          {" "}Your VPS can fetch tracked channels via{" "}
          <code className="text-primary">GET /api/channels</code>.
        </div>
      )}
    </div>
  );
}
