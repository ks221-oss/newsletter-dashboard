import React, { useMemo } from "react";
import { RunsData } from "@workspace/api-client-react/src/generated/api.schemas";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DailyChartPoint {
  label: string;
  fullDate: string;
  totalVideos: number;
  transcriptRate: number;
  emailSentPct: number;
  runCount: number;
}

function buildChartData(runsData: RunsData): DailyChartPoint[] {
  const sortedDates = Object.keys(runsData).sort((a, b) => a.localeCompare(b));
  const last30 = sortedDates.slice(-30);

  return last30.map((date) => {
    const dayRuns = runsData[date] ?? [];
    let totalVideos = 0;
    let okTranscripts = 0;
    let anyEmailSent = false;

    for (const run of dayRuns) {
      totalVideos += run.total_videos;
      okTranscripts += run.videos.filter((v) => v.transcript === "ok").length;
      if (run.email_sent) anyEmailSent = true;
    }

    const [, m, d] = date.split("-");
    return {
      label: `${parseInt(m)}/${parseInt(d)}`,
      fullDate: date,
      totalVideos,
      transcriptRate: totalVideos > 0 ? Math.round((okTranscripts / totalVideos) * 100) : 0,
      emailSentPct: anyEmailSent ? 100 : 0,
      runCount: dayRuns.length,
    };
  });
}

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 0,
  fontFamily: "monospace",
  fontSize: 11,
};

const labelStyle = { color: "#94a3b8", fontFamily: "monospace", fontSize: 10 };

export default function DailyCharts({ runsData }: { runsData: RunsData }) {
  const data = useMemo(() => buildChartData(runsData), [runsData]);

  if (data.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chart 1: Podcast Volume + Transcript Rate */}
      <div className="bg-card border border-border p-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
          Transcript Performance (daily)
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="count"
              orientation="left"
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={24}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={labelStyle}
              itemStyle={{ fontFamily: "monospace", fontSize: 11 }}
              formatter={(value, name) =>
                name === "transcriptRate" ? [`${value}%`, "Transcript %"] : [value, "Videos"]
              }
            />
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: "monospace", color: "#64748b", paddingTop: 8 }}
              formatter={(value) =>
                value === "totalVideos" ? "Videos Dropped" : "Transcript %"
              }
            />
            <Bar yAxisId="count" dataKey="totalVideos" fill="#0891b2" opacity={0.7} maxBarSize={28} />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="transcriptRate"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ r: 3, fill: "#f97316" }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Email Success + Run Count */}
      <div className="bg-card border border-border p-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
          Email Delivery (daily)
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 4, right: 40, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="pct"
              orientation="left"
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              allowDecimals={false}
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              width={24}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={labelStyle}
              itemStyle={{ fontFamily: "monospace", fontSize: 11 }}
              formatter={(value, name) =>
                name === "emailSentPct" ? [`${value}%`, "Email Sent"] : [value, "Runs"]
              }
            />
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: "monospace", color: "#64748b", paddingTop: 8 }}
              formatter={(value) =>
                value === "emailSentPct" ? "Email Success %" : "# Runs"
              }
            />
            <Bar yAxisId="pct" dataKey="emailSentPct" fill="#16a34a" opacity={0.7} maxBarSize={28} />
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="runCount"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={{ r: 3, fill: "#a78bfa" }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
