# Worklog 2026-07-06 - Admin AI Assistant

## Context

Added an admin-only AI assistant for Studio V2. The assistant is designed for quick internal lookup and should not expose provider names, token strategy, tool calls, or technical markup to customers.

No database schema changes were made. No Prisma migration was created or run.

## Main changes

- Added admin-only floating assistant UI.
- Added time-based robot-style greeting.
- Added quick question chips for common lookup flows.
- Added streaming response display so answers appear progressively.
- Added backend AI endpoint with tool-based data lookup.
- Added backup provider fallback: primary MiMo, secondary Gemini Flash.
- Added safeguards so raw tool markup such as `<tool_call>` is never returned to the UI.

## Backend

Updated `server.ts`:

- Added `POST /api/ai/assistant`.
- Added `POST /api/ai/assistant/stream`.
- Added OpenAI-compatible MiMo chat call.
- Added Gemini Flash `generateContent` fallback.
- Added provider fallback logic:
  - Try MiMo first when configured.
  - If MiMo fails, automatically try Gemini when configured.
  - Frontend receives the same response shape and does not know which provider was used.
- Added tool whitelist:
  - `get_business_overview`
  - `search_customers`
  - `search_orders`
  - `search_tasks`
  - `search_leads`
  - `get_schedule_range`
  - `get_operational_alerts`
  - `get_staff_workload`
- Added deterministic fallback intent routing for cases where a model prints tool-like markup instead of making a real tool call.
- Added SSE streaming that emits answer text one character at a time.

## Frontend

Added `src/components/AiAssistantBubble.tsx`:

- Admin-only floating assistant panel.
- Robot-style UI with online status.
- Auto-opens once per session with a time-based greeting.
- Quick question chips:
  - `Tổng quan hôm nay`
  - `Lịch chụp sắp tới`
  - `Cảnh báo vận hành`
  - `Ai đang bận nhất tuần này?`
  - `Lead nào cần chăm sóc?`
- Uses streaming endpoint first.
- Falls back to non-stream endpoint if streaming fails.

Updated `src/App.tsx`:

- Renders assistant only for `role-admin`.
- Handles desktop and mobile-preview placement.

Updated mobile layout:

- `src/components/mobile/MobileLayout.tsx` supports an assistant slot inside the mobile frame.
- `src/components/mobile/MobileApp.tsx` renders the assistant inside mobile layout for admin.

## Environment

Updated `.env.example` with placeholders only:

- `MIMO_API_BASE_URL`
- `MIMO_MODEL`
- `MIMO_API_KEY`
- `GEMINI_API_BASE_URL`
- `GEMINI_MODEL`
- `GEMINI_API_KEY`

Real API keys were used only in local runtime environment variables and were not written to source files.

## Validation performed

- `npm run lint` passed.
- Local server started on `http://127.0.0.1:3000`.
- Local database fallback via `db.json` was used because `DATABASE_URL` was not configured at home.
- Tested admin login with local data.
- Tested AI endpoint with MiMo.
- Tested provider fallback by intentionally using an invalid MiMo key and confirming Gemini still returned a normal answer.
- Tested streaming endpoint.
- Tested new tools:
  - `Tuần sau có lịch chụp nào?` -> `get_schedule_range`
  - `Cảnh báo vận hành` -> `get_operational_alerts`
  - `Ai đang bận nhất tuần này?` -> `get_staff_workload`
- Checked UI did not show raw `<tool_call>` or technical markup.

## Notes for next session

- The current local environment has no company Docker PostgreSQL connection, so the app runs on `db.json` fallback.
- Before production deployment, set provider API keys as server environment variables, not in source code.
- Consider adding a small admin settings page later to show assistant health without exposing provider details to normal users.
