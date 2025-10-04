// /src/routes/api/indicies/spx/+server.ts
import type { RequestHandler } from "@sveltejs/kit";
// Use the npm build to avoid 'Deno is not defined' under Vite/Bun SSR
import yahooFinance from "yahoo-finance2";

// --- Type helpers derived from the runtime function signatures ---
// (npm build doesn't expose /modules/* typings)
type ChartOptions = NonNullable<Parameters<typeof yahooFinance.chart>[1]>;
type ChartResult  = Awaited<ReturnType<typeof yahooFinance.chart>>;
type Interval     = ChartOptions["interval"];

const PRESETS = new Set(["1D","5D","1M","3M","6M","YTD","1Y","2Y","5Y","MAX"]);

// small helper to keep type inference for Interval
function makeWindow(interval: Interval, start: Date, end: Date) {
  return { start, end, interval };
}

function presetToWindow(preset: string) {
  const now = new Date();
  const end = now;
  const start = new Date(now);
  switch (preset) {
    case "1D":  start.setDate(now.getDate() - 1);  return makeWindow("1m", start, end);
    case "5D":  start.setDate(now.getDate() - 5);  return makeWindow("5m", start, end);
    case "1M":  start.setMonth(now.getMonth() - 1); return makeWindow("1d", start, end);
    case "3M":  start.setMonth(now.getMonth() - 3); return makeWindow("1d", start, end);
    case "6M":  start.setMonth(now.getMonth() - 6); return makeWindow("1d", start, end);
    case "YTD": return makeWindow("1d", new Date(now.getFullYear(), 0, 1), end);
    case "1Y":  start.setFullYear(now.getFullYear() - 1); return makeWindow("1d", start, end);
    case "2Y":  start.setFullYear(now.getFullYear() - 2); return makeWindow("1wk", start, end);
    case "5Y":  start.setFullYear(now.getFullYear() - 5); return makeWindow("1mo", start, end);
    case "MAX": return makeWindow("1mo", new Date(2020, 0, 1), end);
    default:    return null ;
  }
}

export const GET: RequestHandler = async ({ url, setHeaders }) => {
  try {
    const preset = (url.searchParams.get("preset") ?? "1Y").toUpperCase();
    const includePrePost = url.searchParams.get("includePrePost") === "true";

    const qpInterval = url.searchParams.get("interval") ?? undefined;
    const p1 = url.searchParams.get("period1") ?? undefined; // ISO string or epoch ms
    const p2 = url.searchParams.get("period2") ?? undefined;

    let period1: Date | number | string | undefined;
    let period2: Date | number | string | undefined;
    let interval: Interval | undefined;

    if (p1 || p2 || qpInterval) {
      period1 = p1 ? (/^\d+$/.test(p1) ? Number(p1) : new Date(p1)) : undefined;
      period2 = p2 ? (/^\d+$/.test(p2) ? Number(p2) : new Date(p2)) : undefined;
      interval = (qpInterval as Interval | undefined) ?? "1d";
    } else {
      const w = PRESETS.has(preset) ? presetToWindow(preset)! : presetToWindow("1Y")!;
      period1 = w.start;
      period2 = w.end;
      interval = w.interval;
    }

    // Build options WITHOUT including undefined optional keys
    const base: Omit<ChartOptions, "period1" | "period2"> = {
      interval: interval!,
      includePrePost,
      return: "array"
    } as ChartOptions;

    const opts: ChartOptions = {
      ...base,
      ...(period1 !== undefined ? { period1 } : {}),
      ...(period2 !== undefined ? { period2 } : {})
    } as ChartOptions;

    const res: ChartResult = await yahooFinance.chart("^GSPC", opts);

    const out = {
      symbol: "^GSPC",
      meta: {
        currency: res.meta.currency,
        exchangeName: res.meta.exchangeName,
        instrumentType: res.meta.instrumentType,
        validRanges: res.meta.validRanges
      },
      interval,
      includePrePost,
      quotes: res.quotes.map((q: any) => ({
        date: q.date,
        open: q.open,
        high: q.high,
        low: q.low,
        close: q.close,
        adjclose: q.adjclose ?? null,
        volume: q.volume ?? null
      })),
      events: res.events ?? null
    };

    setHeaders({
      "Cache-Control": "public, max-age=60",
      "Content-Type": "application/json"
    });

    return new Response(JSON.stringify(out), { status: 200 });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: true, message: err?.message ?? "Unknown error" }),
      { status: 500 }
    );
  }
};
