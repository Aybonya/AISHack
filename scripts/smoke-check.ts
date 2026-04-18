import { explainDocument } from "@/lib/ai/explainDocument";
import { buildSeedState } from "@/lib/seed";
import { processChatMessage } from "@/lib/services/chatPipeline";
import { confirmSubstitution } from "@/lib/services/substitution";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  let state = buildSeedState();

  state = processChatMessage(state, {
    chatId: "chat-general",
    senderId: "aliya",
    senderType: "teacher",
    text: "3В - 28 детей, 1 болеет",
  });

  const latestSummary = state.cafeteriaSummaries[0];
  const latestAttendance = state.attendanceReports.find((report) => report.className === "3В");
  assert(Boolean(latestAttendance), "Scenario 1 failed: attendance report not created.");
  assert(latestSummary.totalMeals >= 27, "Scenario 1 failed: cafeteria summary not updated.");

  state = processChatMessage(state, {
    chatId: "chat-facilities",
    senderId: "aliya",
    senderType: "teacher",
    text: "В кабинете 12 сломалась парта",
  });

  assert(state.incidents.length >= 2, "Scenario 2 failed: incident not created.");
  assert(
    state.incidents[0]?.location.includes("Кабинет 12"),
    "Scenario 2 failed: incident location not parsed.",
  );

  state = processChatMessage(state, {
    chatId: "chat-general",
    senderId: "aliya",
    senderType: "teacher",
    text: "Аскар заболел, его не будет сегодня",
  });

  const suggestion = state.substitutionSuggestions[0];
  assert(Boolean(suggestion), "Scenario 3 failed: substitution suggestion not generated.");

  const confirmed = confirmSubstitution(state, suggestion.id);
  const updatedEntries = confirmed.scheduleEntries.filter(
    (entry) => entry.substitutionStatus === "confirmed",
  );
  assert(updatedEntries.length > 0, "Scenario 3 failed: schedule not updated after confirmation.");

  state = processChatMessage(state, {
    chatId: "chat-general",
    senderId: "director-janar",
    senderType: "director",
    text: "Айгерим, подготовь актовый зал. Назкен, закажи воду и бейджи",
  });

  const freshTasks = state.tasks.filter((task) => task.sourceMessageId === state.messages.at(-2)?.id);
  assert(freshTasks.length === 2, "Scenario 4 failed: tasks were not created.");

  const answer = explainDocument("Объясни приказ простыми словами", state.documentChunks);
  assert(answer.bullets.length > 0, "Scenario 5 failed: document explanation not returned.");

  console.log("AISana smoke check passed.");
  console.log(
    JSON.stringify(
      {
        attendance: latestAttendance?.className,
        meals: latestSummary.totalMeals,
        incidentCount: state.incidents.length,
        substitutionCandidate: suggestion.candidateUserId,
        confirmedSubstitutions: updatedEntries.length,
        documentBullets: answer.bullets.length,
      },
      null,
      2,
    ),
  );
}

run();
