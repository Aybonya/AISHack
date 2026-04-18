import type { AttendanceReport, CafeteriaSummary } from "@/lib/types";
import { createId } from "@/lib/utils";

export function buildCafeteriaSummary(
  attendanceReports: AttendanceReport[],
  classCatalog: string[],
  date: string,
): CafeteriaSummary {
  const dayReports = attendanceReports.filter((report) => report.date === date);
  const reportedClasses = Array.from(new Set(dayReports.map((report) => report.className))).sort();
  const totalMeals = dayReports.reduce((sum, report) => sum + report.presentCount, 0);
  const totalAbsent = dayReports.reduce((sum, report) => sum + report.absentCount, 0);
  const missingClasses = classCatalog.filter((className) => !reportedClasses.includes(className));

  return {
    id: createId("cafeteria"),
    date,
    totalMeals,
    totalAbsent,
    reportedClasses,
    missingClasses,
  };
}

export function upsertAttendanceReport(
  reports: AttendanceReport[],
  report: AttendanceReport,
): AttendanceReport[] {
  const withoutDuplicate = reports.filter(
    (item) => !(item.date === report.date && item.className === report.className),
  );

  return [...withoutDuplicate, report].sort((left, right) =>
    left.className.localeCompare(right.className, "ru"),
  );
}

export function upsertCafeteriaSummary(
  summaries: CafeteriaSummary[],
  nextSummary: CafeteriaSummary,
): CafeteriaSummary[] {
  const rest = summaries.filter((summary) => summary.date !== nextSummary.date);
  return [nextSummary, ...rest].sort((left, right) => right.date.localeCompare(left.date));
}
