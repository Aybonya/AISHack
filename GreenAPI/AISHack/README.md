# AISHack
School substitution assistant backed by Firestore.

## Run
```bash
npm run import:school
npm start
```

API runs on `http://localhost:3000`.

Dashboard runs at `http://localhost:3000`.

## Green-API setup
1. Create `.env` in the project root.
2. Add:
```env
PORT=3000
GREEN_API_ID_INSTANCE=7107571266
GREEN_API_TOKEN=your_real_token
PUBLIC_WEBHOOK_BASE_URL=https://your-public-domain.example.com
```
3. Start the server:
```bash
npm start
```
4. Set Green-API webhook URL to:
```text
https://your-public-domain.example.com/api/integrations/green-api/webhook
```

If you are testing locally, you need a public tunnel such as `ngrok` or `cloudflared`.
Example:
```bash
ngrok http 3000
```
Then use:
```text
https://your-ngrok-domain.ngrok-free.app/api/integrations/green-api/webhook
```

## Main endpoints
`GET /api/health`

`GET /api/teachers/search?q=марат`

`POST /api/replacements/recommend`
```json
{
  "teacherId": "nazhmadinov_marat",
  "dayKey": "tuesday",
  "lessonNumber": 2,
  "classId": "8D",
  "text": "Нажмадинов Марат заболел"
}
```

`POST /api/chat/process`
```json
{
  "teacherId": "nazhmadinov_marat",
  "dayKey": "tuesday",
  "lessonNumber": 2,
  "classId": "8D",
  "text": "Нажмадинов Марат заболел, нужна замена",
  "source": "telegram_bot"
}
```

`POST /api/messages/process`
```json
{
  "text": "1А - 25 детей, 2 болеют",
  "senderName": "Teacher 1A",
  "senderRole": "teacher",
  "source": "green_api"
}
```

`POST /api/replacements/:caseId/confirm`
```json
{
  "candidateTeacherId": "esalina_aizada",
  "approvedBy": "admin"
}
```

## Firestore collections
Core collections used by the bot:
- `teachers`
- `classes`
- `rooms`
- `teacher_load`
- `schedule_entries`
- `attendance_updates`
- `incident_cards`
- `director_tasks`
- `replacement_cases`
- `replacement_assignments`
- `chat_notes`
- `chat_messages`
- `orchestrator_events`

Best practice for chat integrations:
- parse obvious fields from the message if you can
- send `teacherId`, `dayKey`, `lessonNumber`, `classId` explicitly
- keep the original note in `text` for audit history
