// src/lib/agents/tools/liquidityAssessor.ts

import { tool, zodSchema } from 'ai';
import { z } from 'zod';

const liquidityNodeSchema = z.object({
  date: z.string(),
  value: z.number(),
  pct_change: z.number().nullable(),
});

const rawSchema = z.object({
  current: liquidityNodeSchema,
  previous: liquidityNodeSchema
});

export const assessLiquidity = tool({
  name: 'assess_liquidity',
  description: 'Takes current and previous liquidity snapshot and returns a human-readable summary of inflows/outflows.',
  inputSchema: zodSchema(rawSchema),
  execute: async ({ current, previous }) => {
    const comparisons: string[] = [];
    
    const currPct = current.pct_change ?? (current.value && previous.value ? ((current.value - previous.value) / previous.value * 100) : null);
    
    if (currPct == null) {
      comparisons.push(`WALCL: no recent change data`);
    } else if (currPct > 0) {
      comparisons.push(`WALCL: ↑ ${currPct.toFixed(2)}% (inflow)`);
    } else if (currPct < 0) {
      comparisons.push(`WALCL: ↓ ${Math.abs(currPct).toFixed(2)}% (outflow)`);
    } else {
      comparisons.push(`WALCL: flat`);
    }

    // Then interpret
    const summary = `Liquidity recent comparison:\n` + comparisons.join('\n');

    // Could also classify net direction: but for now simple summary
    return { summary };
  }
});
