# AISana

AISana is a production-like MVP of an AI-powered school operations dashboard for **Aqbobek School**.  
It is designed for a school director and acts as a digital AI vice-principal that turns everyday school chat traffic into structured operational workflows.

## What AISana does

- Parses teacher chat messages and classifies them into attendance, incidents, task commands, substitutions, or generic context.
- Builds cafeteria attendance summaries automatically from class reports.
- Creates incident cards from maintenance or safety messages.
- Converts director commands into structured staff tasks.
- Suggests teacher substitutions when a teacher is absent.
- Explains school regulations and internal orders in plain language through a lightweight local RAG flow.
- Presents everything in a dark, WhatsApp-inspired admin dashboard with seeded demo data.

## Tech stack

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS, lucide-react
- **State:** local seeded in-memory store via React context
- **AI logic:** deterministic parser/services with mock-first behavior
- **RAG:** local document chunks with keyword-overlap retrieval
- **Verification:** ESLint, Next production build, smoke script for all core demo scenarios

## Routes

- `/` — dashboard home
- `/chats` — chat workspace
- `/chats/[id]` — selected chat conversation
- `/tasks` — tasks board
- `/incidents` — incidents board
- `/schedule` — weekly schedule and substitutions
- `/documents` — local regulation assistant / RAG page

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Open:

```text
http://localhost:3000
```

## Available scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run smoke
```

## Environment variables

Create a `.env` file from `.env.example` if needed.

```bash
OPENAI_API_KEY=
AISANA_USE_OPENAI=false
```

Current MVP works fully without any API key.  
The app defaults to mock logic so the demo is always usable offline/local-first.

## Demo scenarios

Use the chat workspace or quick scenario chips to verify:

1. Attendance

```text
3В - 28 детей, 1 болеет
```

Expected result:
- attendance is parsed
- AI acknowledgement appears
- cafeteria summary updates

2. Incident

```text
В кабинете 12 сломалась парта
```

Expected result:
- incident is created
- incident card appears
- right-side counter updates

3. Absence and substitution

```text
Аскар заболел, его не будет сегодня
```

Expected result:
- absence is registered
- AISana suggests a substitute
- after confirmation, schedule entries update

4. Director command to tasks

```text
Айгерим, подготовь актовый зал. Назкен, закажи воду и бейджи
```

Expected result:
- two tasks are created
- tasks page updates
- AI summary card appears in chat

5. Documents / RAG

Use:

```text
Объясни приказ простыми словами
```

Expected result:
- relevant chunks are retrieved
- response is returned in short plain-language bullet points

## Seeded data

The app ships with realistic seeded demo content:

- populated staff database with director, teachers, admin, facilities, cafeteria, and AI assistant roles
- five operational chat channels
- seeded messages for attendance, incident handling, director commands, and cafeteria coordination
- current-day task cards and incident cards
- weekly schedule with substitution-ready teacher availability
- local regulation chunks:
  - Приказ МОН РК №130
  - Приказ о замещении уроков
  - Внутренний регламент посещаемости

## Architecture summary

### Core data and domain types

- `lib/types.ts` — shared interfaces for users, chats, messages, incidents, tasks, attendance, schedule, substitutions, and documents
- `lib/seed.ts` — all seeded mock data for Aqbobek School

### Parser pipeline

- `lib/parser/classifyMessage.ts`
- `lib/parser/extractAttendance.ts`
- `lib/parser/extractIncident.ts`
- `lib/parser/extractTasks.ts`
- `lib/parser/extractAbsence.ts`

These modules use deterministic heuristics and regex rules so the system works without external AI access.

### Services

- `lib/services/chatPipeline.ts` — orchestration for incoming messages
- `lib/services/cafeteria.ts`
- `lib/services/incidents.ts`
- `lib/services/tasks.ts`
- `lib/services/substitution.ts`
- `lib/services/documents.ts`

### AI abstraction layer

- `lib/ai/explainDocument.ts`
- `lib/ai/generateTaskSummary.ts`
- `lib/ai/suggestSubstitution.ts`

These provide mock-first behavior and keep higher-level app logic modular.

### UI

- `components/app-shell.tsx` — overall dashboard shell
- `components/app-sidebar.tsx` — left navigation
- `components/chat-list.tsx` — center-left chat rail
- `components/conversation-view.tsx` — main messenger workspace
- `components/insights-rail.tsx` — right-side summary cards
- `components/*-page-view.tsx` — page-level views

## Verification performed

The project was verified with:

- `npm run lint`
- `npm run build`
- `npm run smoke`
- local dev server startup and route checks for `/`, `/chats/chat-general`, `/tasks`, and `/documents`

## Assumptions made

- MVP prioritizes a polished local demo over full backend persistence.
- Voice input is simulated as text-based voice command parsing.
- Local seeded state resets on refresh; persistence can be added later if needed.
- LLM integration is optional; deterministic behavior is the default so the app never depends on external API availability.

## Future improvements

- persist state to SQLite or Prisma
- add real OpenAI parsing/explanation routes behind feature flags
- add websocket-like live chat updates
- add real audio recording and speech-to-text
- add document uploads and chunk indexing UI
- add notifications, audit logs, and director approval workflows
