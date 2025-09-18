import { getCanvasEvents } from "@/lib/canvas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;
  const events = await getCanvasEvents({ limit: Number.isFinite(limit) ? (limit as number) : undefined });
  return new Response(JSON.stringify({ events }), {
    headers: { "content-type": "application/json" },
  });
}


