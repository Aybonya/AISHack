const { parseDateKey } = require("../utils");
const { loadCollection } = require("./school-data-service");

async function readCollection(name, limit = 50) {
  return loadCollection(name, { limit });
}

async function getLatestAttendance(dateKey = parseDateKey()) {
  const attendanceRows = await loadCollection("attendance_updates", { limit: 200 });
  const filteredItems = attendanceRows.filter((item) => item.dateKey === dateKey);

  const latestByClass = new Map();
  filteredItems.forEach((item) => {
    latestByClass.set(item.classId, item);
  });

  const items = Array.from(latestByClass.values()).sort((a, b) =>
    String(a.classId).localeCompare(String(b.classId))
  );

  const totals = items.reduce(
    (acc, item) => {
      acc.present += Number(item.presentCount || 0);
      acc.absent += Number(item.absentCount || 0);
      acc.total += Number(item.totalCount || 0);
      return acc;
    },
    { present: 0, absent: 0, total: 0, classesReported: items.length }
  );

  return { dateKey, totals, items };
}

async function getDashboardOverview() {
  const [attendance, incidents, tasks, cases, assignments, events] = await Promise.all([
    getLatestAttendance(),
    readCollection("incident_cards", 100),
    readCollection("director_tasks", 100),
    readCollection("replacement_cases", 100),
    readCollection("replacement_assignments", 100),
    readCollection("orchestrator_events", 100),
  ]);

  const openIncidents = incidents.filter((item) => item.status !== "closed");
  const openTasks = tasks.filter((item) => item.status !== "done");
  const pendingCases = cases.filter((item) => item.status === "suggested");

  return {
    attendance,
    stats: {
      openIncidents: openIncidents.length,
      openTasks: openTasks.length,
      pendingReplacementCases: pendingCases.length,
      approvedAssignments: assignments.length,
      orchestratorEvents: events.length,
    },
    incidents: openIncidents.slice(0, 12),
    tasks: openTasks.slice(0, 12),
    replacementCases: pendingCases.slice(0, 12),
    recentEvents: events.slice(0, 20),
  };
}

function buildAiBrief(overview) {
  const lines = [];
  const attendance = overview.attendance?.totals;

  lines.push("AI brief for the director:");
  if (attendance) {
    lines.push(
      `Attendance collected from ${attendance.classesReported} classes. Present: ${attendance.present}, absent: ${attendance.absent}, total meal portions: ${attendance.present}.`
    );
  }

  if (overview.stats.openIncidents) {
    lines.push(`Open incidents: ${overview.stats.openIncidents}. The top incident should be reviewed by the facilities manager.`);
  } else {
    lines.push("No open incidents detected from teacher messages.");
  }

  if (overview.stats.openTasks) {
    lines.push(`Open director tasks: ${overview.stats.openTasks}. Follow-up is needed on delegated items.`);
  }

  if (overview.stats.pendingReplacementCases) {
    lines.push(
      `There are ${overview.stats.pendingReplacementCases} substitution cases awaiting approval.`
    );
  } else {
    lines.push("No substitution approvals are pending right now.");
  }

  const urgentIncident = overview.incidents.find((item) => item.priority === "high");
  if (urgentIncident) {
    lines.push(`Urgent issue: ${urgentIncident.summary}`);
  }

  return lines.join(" ");
}

module.exports = {
  getLatestAttendance,
  getDashboardOverview,
  buildAiBrief,
  readCollection,
};
