import React, { useMemo } from "react";
import { RunsData, RunRecord, VideoRecord } from "@workspace/api-client-react";
import { useGetChannels, getGetChannelsQueryKey } from "@workspace/api-client-react";
import DayRow from "./day-row";
import WeekGroup from "./week-group";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Database } from "lucide-react";

interface TimelineProps {
  runsData?: RunsData;
}

function getISOWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function Timeline({ runsData }: TimelineProps) {
  const { data: storedChannels } = useGetChannels({
    query: { queryKey: getGetChannelsQueryKey() },
  });

  const { allChannels, recentDays, groupedWeeks } = useMemo(() => {
    if (!runsData) return { allChannels: [], recentDays: [], groupedWeeks: [] };

    // Derive all known channels from run history
    const channelSet = new Set<string>();
    for (const runs of Object.values(runsData) as RunRecord[][]) {
      for (const run of runs) {
        for (const v of run.videos as VideoRecord[]) {
          if (v.channel) channelSet.add(v.channel);
        }
      }
    }

    // Merge with stored tracked channels so newly-added channels appear as NO_DROP
    if (storedChannels) {
      for (const ch of storedChannels) {
        channelSet.add(ch.displayName);
      }
    }

    const allChannels = Array.from(channelSet).sort();

    const sortedDates = Object.keys(runsData).sort((a, b) => b.localeCompare(a));
    const dailyEntries = sortedDates.map((date) => ({
      date,
      runs: (runsData[date] ?? []) as RunRecord[],
    }));

    const recentDays = dailyEntries.slice(0, 5);
    const olderDays = dailyEntries.slice(5);

    const weekGroups = olderDays.reduce(
      (acc, curr) => {
        const weekKey = getISOWeekStart(curr.date);
        if (!acc[weekKey]) acc[weekKey] = [];
        acc[weekKey].push(curr);
        return acc;
      },
      {} as Record<string, typeof olderDays>,
    );

    const groupedWeeks = Object.entries(weekGroups)
      .map(([weekKey, days]) => ({ weekKey, days }))
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey));

    return { allChannels, recentDays, groupedWeeks };
  }, [runsData, storedChannels]);

  if (!recentDays.length && !groupedWeeks.length) {
    return (
      <Empty className="py-12 border border-border border-dashed bg-muted/20">
        <EmptyHeader>
          <Database className="w-8 h-8 text-muted-foreground mb-2" />
          <EmptyTitle className="font-mono text-sm uppercase tracking-wider">NO_DATA_FOUND</EmptyTitle>
          <EmptyDescription>Awaiting initial telemetry.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {recentDays.map(({ date, runs }) => (
          <DayRow key={date} date={date} runs={runs} allChannels={allChannels} isRecent={true} />
        ))}
      </div>

      {groupedWeeks.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border">
          <h3 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            ARCHIVE_LOGS
          </h3>
          <div className="space-y-2">
            {groupedWeeks.map(({ weekKey, days }) => (
              <WeekGroup key={weekKey} weekKey={weekKey} days={days} allChannels={allChannels} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
