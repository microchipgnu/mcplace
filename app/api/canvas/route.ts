import { getCanvas } from "@/lib/canvas";

export const runtime = "nodejs";

export async function GET() {
  const state = await getCanvas();
  return new Response(JSON.stringify(state), {
    headers: { "content-type": "application/json" },
  });
}
