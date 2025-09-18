# MCPlace

A minimal r/place-inspired pixel canvas with MCP tools, built on Next.js. Uses Upstash Redis for storage and event logging.

## Running locally

1) Install deps

```bash
bun install
```

2) Set Upstash Redis env vars (create a `.env.local`)

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

If using Vercel, add the Upstash Redis integration and `vercel link` + `vercel env pull` to populate these automatically.

3) Start dev server

```bash
bun run dev
```

Open http://localhost:3001 and paint.

## API

- GET `/api/canvas` → returns full canvas state `{ meta, pixelsBase64 }`.
- GET `/api/canvas/events?limit=100` → returns `{ events: CanvasEvent[] }` for replay/analytics.

Write operations happen exclusively through MCP tools (no POST writer route). On first access, the canvas is initialized automatically if no state exists.

## MCP Tools

The server exposes tools in `app/mcp/route.ts`:

- `get_canvas`: returns the current state, optionally as an embedded UI
- `set_pixel`: set one pixel by coordinates using a color string (e.g. `#ff0000`)
- `get_events`: fetch recent event log entries

All MCP tool invocations are recorded in the event log for auditing/replay.

## Implementation notes

- Canvas state is stored as `{ meta, pixelsBase64 }` in Redis at `canvas:v1`.
- Pixels are stored as base64-encoded `Uint8Array` of palette indices for compactness.
- Event log is an append-only Redis list at `canvas:events:v1` with two event kinds:
  - `tool_used` → `{ type, toolName, argsJson, timestampMs }`
  - `pixel_set` → `{ type, x, y, color, colorIndex, source, timestampMs }`
- Default canvas is 64x64 with a small palette; adjust as needed.

### Examples

Fetch latest 100 events:

```bash
curl "http://localhost:3001/api/canvas/events?limit=100"
```

Set a pixel via MCP tool invocation (from an MCP client):

```json
{"tool":"set_pixel","args":{"x":1,"y":2,"color":"#ff0000"}}
```
