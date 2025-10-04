import { VITE_ALPHA_VANTAGE } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

type Interval = "5min" | "1d" | "1wk" | "1mo";
type AVFunction = "CRYPTO_INTRADAY" | "DIGITAL_CURRENCY_DAILY" | "DIGITAL_CURRENCY_WEEKLY" | "DIGITAL_CURRENCY_MONTHLY";

const PRESETS = new Set(["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "2Y", "5Y", "MAX"]);

// small helper to keep type inference
function makeWindow(interval: Interval, av_function: AVFunction, start: Date) {
  return { start, interval, av_function };
}

function presetToWindow(preset: string) {
  const now = new Date();
  const start = new Date(now);
  switch (preset) {
    case "1D":  start.setUTCDate(now.getUTCDate() - 1);  return makeWindow("5min", "CRYPTO_INTRADAY", start);
    case "5D":  start.setUTCDate(now.getUTCDate() - 5);  return makeWindow("5min", "CRYPTO_INTRADAY", start);
    case "1M":  start.setUTCMonth(now.getUTCMonth() - 1); return makeWindow("1d", "DIGITAL_CURRENCY_DAILY", start);
    case "3M":  start.setUTCMonth(now.getUTCMonth() - 3); return makeWindow("1d", "DIGITAL_CURRENCY_DAILY", start);
    case "6M":  start.setUTCMonth(now.getUTCMonth() - 6); return makeWindow("1d", "DIGITAL_CURRENCY_DAILY", start);
    case "YTD": return makeWindow("1d", "DIGITAL_CURRENCY_DAILY", new Date(Date.UTC(now.getUTCFullYear(), 0, 1)));
    case "1Y":  start.setUTCFullYear(now.getUTCFullYear() - 1); return makeWindow("1d", "DIGITAL_CURRENCY_DAILY", start);
    case "2Y":  start.setUTCFullYear(now.getUTCFullYear() - 2); return makeWindow("1wk", "DIGITAL_CURRENCY_WEEKLY", start);
    case "5Y":  start.setUTCFullYear(now.getUTCFullYear() - 5); return makeWindow("1mo", "DIGITAL_CURRENCY_MONTHLY", start);
    case "MAX": return makeWindow("1mo", "DIGITAL_CURRENCY_MONTHLY", new Date(0)); // new Date(0) is epoch start in UTC
    default:    return null;
  }
}

async function fetchAlphaVantageData(av_function: AVFunction, interval: Interval) {
  const BASE_URL = 'https://www.alphavantage.co/query';
  const symbol = 'ETH';
  const market = 'USD';
  const apikey = VITE_ALPHA_VANTAGE;

  let url = `${BASE_URL}?function=${av_function}&symbol=${symbol}&market=${market}&apikey=${apikey}`;
  if (av_function === 'CRYPTO_INTRADAY') {
    url += `&interval=${interval}&outputsize=full`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Alpha Vantage API request failed with status ${response.status}`);
  }
  const data = await response.json();
  if (data['Error Message'] || data['Note']) {
    throw new Error(data['Error Message'] || data['Note'] || 'Unknown error from Alpha Vantage');
  }
  return data;
}

function parseAlphaVantageData(data: any, av_function: AVFunction, start: Date) {
  const meta = data['Meta Data'];
  let timeSeriesKey: string;

  switch(av_function) {
    case 'CRYPTO_INTRADAY':
      timeSeriesKey = `Time Series Crypto (${meta['4. Interval']})`;
      break;
    case 'DIGITAL_CURRENCY_DAILY':
      timeSeriesKey = 'Time Series (Digital Currency Daily)';
      break;

    case 'DIGITAL_CURRENCY_WEEKLY':
      timeSeriesKey = 'Time Series (Digital Currency Weekly)';
      break;
    case 'DIGITAL_CURRENCY_MONTHLY':
      timeSeriesKey = 'Time Series (Digital Currency Monthly)';
      break;
    default:
      throw new Error('Invalid Alpha Vantage function');
  }

  const timeSeries = data[timeSeriesKey];
  if (!timeSeries) {
    return { meta: {}, quotes: [] };
  }

  const quotes = Object.entries(timeSeries)
    .map(([dateStr, values]: [string, any]) => {
      const date = new Date(dateStr.includes(' ') ? dateStr + ' UTC' : dateStr);
      return {
        date: date,
        open: parseFloat(values['1. open'] || values['1a. open (USD)']),
        high: parseFloat(values['2. high'] || values['2a. high (USD)']),
        low: parseFloat(values['3. low'] || values['3a. low (USD)']),
        close: parseFloat(values['4. close'] || values['4a. close (USD)']),
        volume: parseFloat(values['5. volume'] || values['5. volume']),
        adjclose: parseFloat(values['4. close'] || values['4a. close (USD)'])
      };
    })
    .filter(q => q.date >= start)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    meta: {
      currency: meta['3. Digital Currency Code'] || meta['6. Market Code'],
      exchangeName: meta['5. Market Name'],
      instrumentType: 'DIGITAL_CURRENCY',
      validRanges: PRESETS
    },
    quotes
  };
}

export const GET: RequestHandler = async ({ url, setHeaders }) => {
  try {
    const preset = (url.searchParams.get("preset") ?? "1Y").toUpperCase();
    const includePrePost = url.searchParams.get("includePrePost") === "true";

    // Custom ranges are not supported with AlphaVantage free tier easily.
    // We will ignore p1, p2, qpInterval for now.
    const w = PRESETS.has(preset) ? presetToWindow(preset)! : presetToWindow("1Y")!;
    const { start, interval, av_function } = w;

    const avData = await fetchAlphaVantageData(av_function, interval);
    const parsedData = parseAlphaVantageData(avData, av_function, start);

    const out = {
      symbol: "ETH-USD",
      meta: parsedData.meta,
      interval,
      includePrePost,
      quotes: parsedData.quotes,
      events: null
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
