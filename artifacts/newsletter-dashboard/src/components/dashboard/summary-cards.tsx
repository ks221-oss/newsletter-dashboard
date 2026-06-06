import React from "react";
import { DashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Mail, Video, Zap } from "lucide-react";

export default function SummaryCards({ summary }: { summary?: DashboardSummary }) {
  if (!summary) return null;

  const cards = [
    {
      title: "30D Runs",
      value: summary.last30DaysRuns,
      icon: Activity,
      color: "text-primary",
      desc: "Total execution cycles"
    },
    {
      title: "30D Emails Sent",
      value: summary.last30DaysEmailsSent,
      icon: Mail,
      color: "text-chart-4",
      desc: "Successful deliveries"
    },
    {
      title: "Transcript Rate",
      value: `${(summary.last30DaysTranscriptRate * 100).toFixed(1)}%`,
      icon: Zap,
      color: "text-chart-2",
      desc: "Success ratio (30d)"
    },
    {
      title: "Total Videos",
      value: summary.totalVideosProcessed,
      icon: Video,
      color: "text-chart-3",
      desc: "Lifetime processed"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <Card key={i} className="bg-card border-border rounded-none shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {card.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold tracking-tight">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider opacity-70">
                {card.desc}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
