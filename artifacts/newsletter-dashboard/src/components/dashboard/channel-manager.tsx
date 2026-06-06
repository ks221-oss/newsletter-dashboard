import React, { useState } from "react";
import { useGetChannels, useCreateChannel, useDeleteChannel } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetChannelsQueryKey } from "@workspace/api-client-react";
import { Plus, Trash2, Youtube, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ChannelManager() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [youtubeHandle, setYoutubeHandle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const { data: channels, isLoading } = useGetChannels();

  const { mutate: createChannel, isPending: isCreating } = useCreateChannel({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetChannelsQueryKey() });
        setDisplayName("");
        setYoutubeHandle("");
        setAddError(null);
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
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
    createChannel({ data: { displayName: displayName.trim(), youtubeHandle: youtubeHandle.trim() } });
  }

  return (
    <div className="bg-card border border-border p-4 space-y-4">
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
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
            <div
              key={ch.id}
              className="flex items-center justify-between px-3 py-2 bg-background/50 border border-border/50 hover:border-border/80 transition-colors group"
            >
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
                <Badge variant="outline" className="rounded-none font-mono text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                  TRACKING
                </Badge>
                <button
                  onClick={() => deleteChannel({ id: ch.id })}
                  disabled={isDeleting}
                  className="p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/30 rounded-none disabled:opacity-50"
                  title="Remove channel"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {channels && channels.length > 0 && (
        <div className="text-[10px] font-mono text-muted-foreground pt-1 opacity-60">
          Your VPS script can fetch this list via{" "}
          <code className="text-primary">GET /api/channels</code> to know which channels to scrape.
        </div>
      )}
    </div>
  );
}
