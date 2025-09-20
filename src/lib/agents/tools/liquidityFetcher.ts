import { tool, zodSchema } from 'ai';
import {z} from 'zod'

// Type for the returned snapshot
type LiquidityNode = {
  date: string;
  value: number;
  pct_change: number;
};

type LiquiditySnapshot = {
  current: LiquidityNode;
  previous: LiquidityNode;
};

// ✅ MUST be called `inputSchema` not `parameters`
const rawSchema = z.object({});
const inputSchema = zodSchema(rawSchema)

export const fetchLiquidity = tool<z.infer<typeof rawSchema>, LiquiditySnapshot>({
  name: 'fetch_liquidity',
  description: 'Fetches liquidity snapshot from internal endpoint and returns current + previous WALCL data points.',
  inputSchema,
  execute: async () => {
    const res = await fetch('http://localhost:5173/api/consolidated-recent');
    if (!res.ok) {
      throw new Error('Failed to fetch liquidity data');
    }

    const json = await res.json();
    const walcl = json?.walcl?.data;

    if (!walcl || walcl.length < 2) {
      throw new Error('Not enough WALCL data to compute change');
    }

    const current = walcl.at(-1);
    const previous = walcl.at(-2);

    return { current, previous };
  }
});
