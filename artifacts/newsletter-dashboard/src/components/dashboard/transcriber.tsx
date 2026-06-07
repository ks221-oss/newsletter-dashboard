import React, { useState } from "react";
import {
  useTranscribeVideo,
  useSummariseTranscript,
  usePushToNotion,
} from "@workspace/api-client-react";
import type { TranscriptResult, SummaryResult } from "@workspace/api-client-react";
import { Mic, Loader2, ChevronDown, ChevronUp, ExternalLink, RotateCcw, Check } from "lucide-react";

const NOTION_DB_URL = "https://www.notion.so/3778d67d1a80806cbfd7d7cec90b08cb";

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {
    // ignore
  }
  return null;
}

function formatOffset(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type Stage = "idle" | "fetching-transcript" | "generating-summary" | "done" | "error";

interface Results {
  transcript: TranscriptResult;
  summary: SummaryResult;
  youtubeUrl: string;
}

export default function Transcriber() {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [notionStatus, setNotionStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [notionPageUrl, setNotionPageUrl] = useState<string | null>(null);
  const [notionError, setNotionError] = useState("");

  const transcribeMutation = useTranscribeVideo();
  const summariseMutation = useSummariseTranscript();
  const notionMutation = usePushToNotion();

  const videoId = extractVideoId(url.trim());
  const isValidUrl = videoId !== null;

  async function handleTranscribe() {
    const trimmedUrl = url.trim();
    setStage("fetching-transcript");
    setErrorMsg("");
    setResults(null);
    setTranscriptOpen(false);
    setNotionStatus("idle");
    setNotionPageUrl(null);

    let transcript: TranscriptResult;
    try {
      transcript = await transcribeMutation.mutateAsync({ data: { youtubeUrl: trimmedUrl } });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to fetch transcript";
      setErrorMsg(msg);
      setStage("error");
      return;
    }

    setStage("generating-summary");

    let summary: SummaryResult;
    try {
      summary = await summariseMutation.mutateAsync({
        data: { title: transcript.title, lines: transcript.lines },
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "AI service unavailable";
      setErrorMsg(msg);
      setStage("error");
      return;
    }

    setResults({ transcript, summary, youtubeUrl: trimmedUrl });
    setStage("done");
  }

  async function handlePushToNotion() {
    if (!results) return;
    setNotionStatus("loading");
    setNotionError("");
    try {
      const result = await notionMutation.mutateAsync({
        data: {
          videoId: results.transcript.videoId,
          title: results.transcript.title,
          youtubeUrl: results.youtubeUrl,
          thumbnailUrl: results.transcript.thumbnailUrl ?? null,
          summary: results.summary.summary,
          lines: results.transcript.lines,
        },
      });
      setNotionPageUrl(result.notionPageUrl);
      setNotionStatus("done");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Failed to push to Notion";
      setNotionError(msg);
      setNotionStatus("error");
    }
  }

  function handleReset() {
    setUrl("");
    setStage("idle");
    setErrorMsg("");
    setResults(null);
    setTranscriptOpen(false);
    setNotionStatus("idle");
    setNotionPageUrl(null);
    setNotionError("");
  }

  // ── Idle / input screen ───────────────────────────────────────────────────
  if (stage === "idle") {
    return (
      <div className="max-w-2xl space-y-8">
        <div className="space-y-1">
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-foreground uppercase">
            Podcast Transcriber
          </h2>
          <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
            Paste any YouTube podcast URL to generate a summary and transcript
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && isValidUrl && handleTranscribe()}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 px-3 py-2 text-xs font-mono bg-background border border-border focus:outline-none focus:border-primary placeholder:text-muted-foreground/30"
            />
            <button
              onClick={handleTranscribe}
              disabled={!isValidUrl}
              className="px-4 py-2 text-[10px] font-mono uppercase tracking-widest bg-primary text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            >
              Transcribe
            </button>
          </div>

          <a
            href={NOTION_DB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/50 hover:text-primary transition-colors uppercase tracking-widest"
          >
            Browse all summaries &amp; transcripts
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    );
  }

  // ── Processing states ─────────────────────────────────────────────────────
  if (stage === "fetching-transcript" || stage === "generating-summary") {
    return (
      <div className="max-w-2xl space-y-8">
        <div className="space-y-1">
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-foreground uppercase">
            Podcast Transcriber
          </h2>
        </div>

        <div className="border border-border p-6 space-y-4">
          {/* Step 1 */}
          <div className="flex items-center gap-3">
            {stage === "fetching-transcript" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
            ) : (
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
            )}
            <span
              className={`text-[10px] font-mono uppercase tracking-wider ${
                stage === "fetching-transcript" ? "text-foreground" : "text-muted-foreground/50"
              }`}
            >
              Fetching transcript from YouTube…
            </span>
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-3">
            {stage === "generating-summary" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
            ) : (
              <span className="w-3.5 h-3.5 shrink-0" />
            )}
            <span
              className={`text-[10px] font-mono uppercase tracking-wider ${
                stage === "generating-summary" ? "text-foreground" : "text-muted-foreground/30"
              }`}
            >
              Generating AI summary…
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (stage === "error") {
    return (
      <div className="max-w-2xl space-y-8">
        <div className="space-y-1">
          <h2 className="text-xs font-mono font-bold tracking-[0.2em] text-foreground uppercase">
            Podcast Transcriber
          </h2>
        </div>

        <div className="border border-destructive/50 bg-destructive/5 p-4 space-y-3">
          <p className="text-[10px] font-mono text-destructive uppercase tracking-wider">Error</p>
          <p className="text-xs font-mono text-foreground">{errorMsg}</p>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest"
          >
            <RotateCcw className="w-3 h-3" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Results screen ────────────────────────────────────────────────────────
  if (stage === "done" && results) {
    const { transcript, summary, youtubeUrl } = results;

    return (
      <div className="max-w-2xl space-y-6">
        {/* Video header */}
        <div className="flex gap-4 items-start border border-border p-4">
          {transcript.thumbnailUrl && (
            <img
              src={transcript.thumbnailUrl}
              alt=""
              className="w-24 h-14 object-cover shrink-0"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="min-w-0 space-y-1 flex-1">
            <p className="text-xs font-mono font-bold text-foreground leading-snug line-clamp-2">
              {transcript.title}
            </p>
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[9px] font-mono text-muted-foreground/50 hover:text-primary transition-colors"
            >
              youtube.com
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>

        {/* AI Summary */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground">
              AI Summary
            </span>
          </div>
          <div className="text-xs font-mono text-foreground leading-relaxed whitespace-pre-line">
            {summary.summary}
          </div>
          <p className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-widest">
            Generated by AI — verify key facts
          </p>
        </div>

        {/* Full Transcript (collapsible) */}
        <div className="space-y-2">
          <button
            onClick={() => setTranscriptOpen((v) => !v)}
            className="flex items-center gap-2 w-full text-left border-b border-border pb-2"
          >
            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground flex-1">
              Transcript
            </span>
            <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest">
              {transcriptOpen ? "Hide" : "Show"}
            </span>
            {transcriptOpen ? (
              <ChevronUp className="w-3 h-3 text-muted-foreground/40" />
            ) : (
              <ChevronDown className="w-3 h-3 text-muted-foreground/40" />
            )}
          </button>

          {transcriptOpen && (
            <div className="max-h-80 overflow-y-auto border border-border bg-muted/20 p-3 space-y-0.5">
              {transcript.lines.map((line, i) => (
                <p key={i} className="text-[9px] font-mono text-foreground/70 leading-relaxed">
                  <span className="text-muted-foreground/40 mr-2">[{formatOffset(line.offset)}]</span>
                  {line.text}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="border-t border-border pt-4 flex flex-wrap items-center gap-4">
          {/* Add to Notion */}
          {notionStatus === "idle" && (
            <button
              onClick={handlePushToNotion}
              className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-mono uppercase tracking-widest border border-border hover:border-primary hover:text-primary transition-colors"
            >
              <Mic className="w-3 h-3" />
              Add to Notion
            </button>
          )}
          {notionStatus === "loading" && (
            <button
              disabled
              className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-mono uppercase tracking-widest border border-border text-muted-foreground/40 cursor-not-allowed"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              Adding…
            </button>
          )}
          {notionStatus === "done" && (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-primary uppercase tracking-widest">
                <Check className="w-3 h-3" />
                Added to Notion
              </span>
              {notionPageUrl && (
                <a
                  href={notionPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/50 hover:text-primary transition-colors"
                >
                  View page
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          )}
          {notionStatus === "error" && (
            <div className="space-y-1">
              <button
                onClick={handlePushToNotion}
                className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-mono uppercase tracking-widest border border-destructive/50 text-destructive hover:bg-destructive/5 transition-colors"
              >
                Retry Add to Notion
              </button>
              <p className="text-[8px] font-mono text-destructive/70">{notionError}</p>
            </div>
          )}

          {/* Transcribe another */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Transcribe another
          </button>

          {/* Browse Notion DB */}
          <a
            href={NOTION_DB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] font-mono text-muted-foreground/30 hover:text-primary transition-colors ml-auto"
          >
            Browse all summaries →
          </a>
        </div>
      </div>
    );
  }

  return null;
}
