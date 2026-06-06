import { Router, type IRouter } from "express";
import {
  GetGmailStatusParams,
  GetDashboardRunsResponse,
  GetGmailStatusResponse,
  GetDashboardSummaryResponse,
} from "@workspace/api-zod";
import { checkGmail, isGmailConfigured } from "../lib/gmail";
import { logger } from "../lib/logger";

const VPS_URL = process.env.VPS_DATA_URL ?? "http://168.144.159.14:8080/data";

const router: IRouter = Router();

async function fetchVpsRuns(): Promise<Record<string, unknown[]>> {
  const res = await fetch(VPS_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`VPS responded with ${res.status}`);
  }
  return res.json() as Promise<Record<string, unknown[]>>;
}

router.get("/dashboard/runs", async (req, res): Promise<void> => {
  try {
    const raw = await fetchVpsRuns();
    const parsed = GetDashboardRunsResponse.safeParse(raw);
    if (!parsed.success) {
      req.log.warn({ err: parsed.error.message }, "VPS data failed schema validation — passing raw");
      res.json(raw);
      return;
    }
    res.json(parsed.data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch VPS run data");
    res.status(502).json({ error: "Unable to reach newsletter run data source" });
  }
});

router.get("/dashboard/gmail/:date", async (req, res): Promise<void> => {
  const params = GetGmailStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { date } = params.data;

  if (!isGmailConfigured()) {
    const result = GetGmailStatusResponse.parse({ date, found: null, unavailable: true });
    res.json(result);
    return;
  }

  try {
    const found = await checkGmail(date);
    const result = GetGmailStatusResponse.parse({ date, found, unavailable: false });
    res.json(result);
  } catch (err) {
    logger.error({ err, date }, "Gmail check failed");
    const result = GetGmailStatusResponse.parse({ date, found: null, unavailable: false });
    res.json(result);
  }
});

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  try {
    const raw = await fetchVpsRuns();
    const parsed = GetDashboardRunsResponse.safeParse(raw);
    const runs = parsed.success ? parsed.data : (raw as Record<string, Array<{ total_videos?: number; email_sent?: boolean; videos?: Array<{ transcript?: string }> }>>) ;

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let totalRuns = 0;
    let last30DaysRuns = 0;
    let last30DaysEmailsSent = 0;
    let last30TotalVideos = 0;
    let last30OkVideos = 0;
    let totalVideosProcessed = 0;

    for (const [dateStr, dayRuns] of Object.entries(runs)) {
      if (!Array.isArray(dayRuns) || dayRuns.length === 0) continue;
      totalRuns += dayRuns.length;

      const dt = new Date(dateStr + "T00:00:00Z");
      const inLast30 = dt >= thirtyDaysAgo;

      for (const run of dayRuns) {
        const r = run as { total_videos?: number; email_sent?: boolean; videos?: Array<{ transcript?: string }> };
        const videos = r.videos ?? [];
        const tv = r.total_videos ?? videos.length;
        totalVideosProcessed += tv;

        if (inLast30) {
          last30DaysRuns++;
          if (r.email_sent) last30DaysEmailsSent++;
          last30TotalVideos += tv;
          last30OkVideos += videos.filter((v) => v.transcript === "ok").length;
        }
      }
    }

    const summary = GetDashboardSummaryResponse.parse({
      totalRuns,
      last30DaysRuns,
      last30DaysEmailsSent,
      last30DaysTranscriptRate: last30TotalVideos > 0 ? last30OkVideos / last30TotalVideos : 0,
      totalVideosProcessed,
    });

    res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Failed to compute dashboard summary");
    res.status(502).json({ error: "Unable to reach newsletter run data source" });
  }
});

export default router;
