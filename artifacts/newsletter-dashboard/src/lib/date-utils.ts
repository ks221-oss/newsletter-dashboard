import { format, parseISO, startOfWeek, isSameWeek } from "date-fns";

export function formatDayDate(dateString: string) {
  try {
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch (e) {
    return dateString;
  }
}

export function formatWeekDate(dateString: string) {
  try {
    return format(startOfWeek(parseISO(dateString), { weekStartsOn: 1 }), "MMM d");
  } catch (e) {
    return dateString;
  }
}

export function getISOWeekKey(dateString: string) {
  try {
    const d = parseISO(dateString);
    const w = startOfWeek(d, { weekStartsOn: 1 });
    return w.toISOString().split("T")[0];
  } catch (e) {
    return dateString;
  }
}
