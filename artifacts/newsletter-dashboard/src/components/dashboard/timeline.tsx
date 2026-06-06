import React, { useMemo } from "react";
import { RunsData, RunRecord } from "@workspace/api-client-react/src/generated/api.schemas";
import DayRow from "./day-row";
import WeekGroup from "./week-group";
import { getISOWeekKey } from "@/lib/date-utils";
import { Empty } from "@/components/ui/empty";
import { Database } from "lucide-react";

interface TimelineProps {
  runsData?: RunsData;
}

export default function Timeline({ runsData }: TimelineProps) {
  const { recentDays, groupedWeeks } = useMemo(() => {
    if (!runsData) return { recentDays: [], groupedWeeks: [] };

    // Sort dates descending
    const sortedDates = Object.keys(runsData).sort((a, b) => b.localeCompare(a));
    
    // Take the last run for each date
    const dailyRuns = sortedDates.map(date => {
      const runs = runsData[date];
      return {
        date,
        run: runs[runs.length - 1] // Last run of the day
      };
    });

    const recentDays = dailyRuns.slice(0, 5);
    const olderDays = dailyRuns.slice(5);

    // Group older days by ISO week
    const weekGroups = olderDays.reduce((acc, curr) => {
      const weekKey = getISOWeekKey(curr.date);
      if (!acc[weekKey]) acc[weekKey] = [];
      acc[weekKey].push(curr);
      return acc;
    }, {} as Record<string, typeof olderDays>);

    const groupedWeeks = Object.entries(weekGroups)
      .map(([weekKey, days]) => ({ weekKey, days }))
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey));

    return { recentDays, groupedWeeks };
  }, [runsData]);

  if (!recentDays.length && !groupedWeeks.length) {
    return (
      <Empty
        icon={Database}
        title="NO_DATA_FOUND"
        description="Awaiting initial telemetry."
        className="py-12 border border-border border-dashed bg-muted/20"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {recentDays.map(({ date, run }) => (
          <DayRow key={date} date={date} run={run} isRecent={true} />
        ))}
      </div>

      {groupedWeeks.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            ARCHIVE_LOGS
          </h3>
          <div className="space-y-2">
            {groupedWeeks.map(({ weekKey, days }) => (
              <WeekGroup key={weekKey} weekKey={weekKey} days={days} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
