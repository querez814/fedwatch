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
  netLiquidity: z.object({
    current: z.number(),
    previous: z.number(),
    change: z.number(),
    pctChange: z.number()
  })
});

export const analyzeFlowDynamics = tool({
  name: 'analyze_flow_dynamics',
  description: 'Analyzes the interplay between TGA, RRP, and WALCL to determine the primary drivers of net liquidity changes.',
  inputSchema: zodSchema(rawSchema),
  execute: async ({ tga, rrp, walcl, netLiquidity }) => {
    const tgaChange = tga.current.value - tga.previous.value;
    const rrpChange = rrp.current.value - rrp.previous.value;
    const walclChange = walcl.current.value - walcl.previous.value;

    let dynamics = '';

    // Net Liquidity = WALCL - TGA - RRP
    // Change in Net Liq = Change in WALCL - Change in TGA - Change in RRP
    
    const tgaImpact = -tgaChange; // Decrease in TGA is an inflow
    const rrpImpact = -rrpChange; // Decrease in RRP is an inflow

    const drivers = [
      { name: 'WALCL', impact: walclChange },
      { name: 'TGA', impact: tgaImpact },
      { name: 'RRP', impact: rrpImpact }
    ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    const primaryDriver = drivers[0];
    const secondaryDriver = drivers[1];

    dynamics = `The primary driver of the ${netLiquidity.change > 0 ? 'inflow' : 'outflow'} is a ${primaryDriver.impact > 0 ? 'positive' : 'negative'} shift in ${primaryDriver.name}. `;
    dynamics += `This was ${Math.abs(secondaryDriver.impact) > Math.abs(netLiquidity.change) * 0.2 ? 'supported' : 'partially offset'} by changes in ${secondaryDriver.name}.`;

    if (primaryDriver.name === 'TGA' && tgaImpact > 0) {
      dynamics += " A draining TGA is injecting cash into the system, which is bullish for markets.";
    } else if (primaryDriver.name === 'RRP' && rrpImpact > 0) {
      dynamics += " Funds leaving the RRP facility are seeking yield elsewhere, likely flowing into risk assets.";
    } else if (primaryDriver.name === 'WALCL' && walclChange < 0) {
      dynamics += " The Fed's balance sheet reduction (QT) is the main force draining liquidity.";
    }

    return { analysis: dynamics };
  }
});
