# place.mcpay.tech

A minimal r/place-inspired pixel canvas with MCP tools, built on Next.js. Uses Vercel KV for storage.

## Running locally

1) Install deps

```bash
bun install
```

2) Set Vercel KV env vars (create a `.env.local`)

```bash
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

If using Vercel, add the KV integration and `vercel link` + `vercel env pull` to populate these automatically.

3) Start dev server

```bash
bun run dev
```

Open http://localhost:3000 and paint.

## API

- GET `/api/canvas` → returns full canvas state `{ meta, pixelsBase64 }`.
- POST `/api/canvas` with `{ action: "set_pixel", x, y, colorIndex }`.

Note: On first access, the canvas is initialized automatically if no state exists.

## MCP Tools

The server exposes 2 tools in `app/mcp/route.ts`:

- `get_canvas`: returns the current state
- `set_pixel`: set one pixel by coordinates and palette index

## Implementation notes

- Canvas state is stored as `{ meta, pixelsBase64 }` in KV at `canvas:v1`.
- Pixels are stored as base64-encoded `Uint8Array` of palette indices for compactness.
- Default canvas is 64x64 with a small palette; adjust as needed.
