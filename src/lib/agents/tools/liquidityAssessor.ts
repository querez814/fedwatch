// src/lib/agents/tools/liquidityAssessor.ts

import { tool, zodSchema } from 'ai';
import { z } from 'zod';

const liquidityNodeSchema = z.object({
  date: z.string(),
  value: z.number(),
  pct_change: z.number().nullable(),
});

const nodeDataSchema = z.object({
  current: liquidityNodeSchema,
  previous: liquidityNodeSchema,
  trend: z.enum(['inflow', 'outflow', 'neutral'])
});

const rawSchema = z.object({
  tga: nodeDataSchema,
  rrp: nodeDataSchema,
  walcl: nodeDataSchema,
  soma: nodeDataSchema,
  somaTreasuries: nodeDataSchema,
  somaMbs: nodeDataSchema,
  netLiquidity: z.object({
    current: z.number(),
    previous: z.number(),
    change: z.number(),
    pctChange: z.number()
  })
});

export const assessHolisticLiquidity = tool({
  name: 'assess_holistic_liquidity',
  description: 'Takes comprehensive liquidity data and returns a human-readable summary of inflows/outflows and market impact.',
  inputSchema: zodSchema(rawSchema),
  execute: async (data) => {
    const { tga, rrp, walcl, netLiquidity } = data;

    const formatNode = (name: string, node: { trend: string, current: { value: number, pct_change: number | null } }) => {
      const trendSymbol = node.trend === 'inflow' ? '↑' : node.trend === 'outflow' ? '↓' : '↔';
      const value = (node.current.value / 1_000_000_000_000).toFixed(2) + 'T';
      const pct = node.current.pct_change?.toFixed(2) ?? 'N/A';
      return `${name}: ${trendSymbol} ${value} (${pct}%)`;
    };

    const summary = `
### Holistic Liquidity Analysis:
- **Net Liquidity:** ${(netLiquidity.current / 1_000_000_000_000).toFixed(2)}T (Change: ${(netLiquidity.change / 1_000_000_000).toFixed(2)}B, ${netLiquidity.pctChange.toFixed(2)}%)
- ${formatNode('WALCL', walcl)}
- ${formatNode('TGA', tga)}
- ${formatNode('RRP', rrp)}

**Interpretation:**
- Net liquidity has experienced a ${netLiquidity.change > 0 ? 'significant inflow' : 'withdrawal'}.
- The main driver is ${Math.abs(tga.current.pct_change || 0) > Math.abs(rrp.current.pct_change || 0) ? 'a shift in the TGA' : 'a change in RRP usage'}.
- This suggests a ${netLiquidity.change > 0 ? 'bullish' : 'bearish'} outlook for risk assets in the short term.
    `;

    return { summary: summary.trim() };
  }
});
