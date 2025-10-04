
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
  auctions: nodeDataSchema,
  netLiquidity: z.object({
    current: z.number(),
    previous: z.number(),
    change: z.number(),
    pctChange: z.number()
  })
});

export const assessHolisticLiquidity = tool({
  name: 'assess_holistic_liquidity',
  description: 'Takes comprehensive liquidity data including Treasury auctions and returns a human-readable summary of inflows/outflows and market impact.',
  inputSchema: zodSchema(rawSchema),
  execute: async (data) => {
    const { tga, rrp, walcl, auctions, netLiquidity } = data;

    const formatNode = (name: string, node: { trend: string, current: { value: number, pct_change: number | null } }) => {
      const trendSymbol = node.trend === 'inflow' ? '↑' : node.trend === 'outflow' ? '↓' : '↔';
      const value = (node.current.value / 1_000_000_000_000).toFixed(2) + 'T';
      const pct = node.current.pct_change?.toFixed(2) ?? 'N/A';
      return `${name}: ${trendSymbol} ${value} (${pct}%)`;
    };

    const formatAuctions = (node: { trend: string, current: { value: number, pct_change: number | null } }) => {
      const trendSymbol = node.trend === 'inflow' ? '↑' : node.trend === 'outflow' ? '↓' : '↔';
      const value = (node.current.value / 1_000_000_000).toFixed(1) + 'B';
      const pct = node.current.pct_change?.toFixed(2) ?? 'N/A';
      const impact = node.trend === 'inflow' ? '(DRAINING)' : node.trend === 'outflow' ? '(SUPPORTIVE)' : '(NEUTRAL)';
      return `AUCTIONS: ${trendSymbol} ${value} (${pct}%) ${impact}`;
    };

    // Determine the primary liquidity driver
    const auctionChange = Math.abs(auctions.current.value - auctions.previous.value);
    const tgaChange = Math.abs(tga.current.value - tga.previous.value);
    const rrpChange = Math.abs(rrp.current.value - rrp.previous.value);
    
    const maxChange = Math.max(auctionChange, tgaChange, rrpChange);
    let primaryDriver = '';
    
    if (maxChange === auctionChange) {
      primaryDriver = auctions.trend === 'inflow' ? 'heavy Treasury issuance draining liquidity' : 'weak auction demand preserving liquidity';
    } else if (maxChange === tgaChange) {
      primaryDriver = tga.trend === 'outflow' ? 'Treasury account drainage injecting liquidity' : 'Treasury account filling absorbing liquidity';
    } else {
      primaryDriver = rrp.trend === 'outflow' ? 'RRP outflows seeking yield' : 'flight to RRP safety';
    }

    const summary = `
### Comprehensive Liquidity Analysis with Treasury Auction Impact:

**Net Liquidity:** ${(netLiquidity.current / 1_000_000_000_000).toFixed(2)}T (Change: ${(netLiquidity.change / 1_000_000_000).toFixed(2)}B, ${netLiquidity.pctChange.toFixed(2)}%)

**Core Liquidity Nodes:**
- ${formatNode('WALCL', walcl)}
- ${formatNode('TGA', tga)}
- ${formatNode('RRP', rrp)}

**Treasury Issuance Impact:**
- ${formatAuctions(auctions)}

**Flow Analysis:**
The primary driver of current liquidity conditions is ${primaryDriver}. 

${auctions.trend === 'inflow' && auctions.current.pct_change && auctions.current.pct_change > 20 ? 
  'Heavy auction activity is creating meaningful liquidity pressure as primary dealers and investors fund new Treasury purchases.' :
  auctions.trend === 'outflow' ? 
  'Light Treasury issuance is reducing typical funding pressure, allowing more liquidity to remain in the system.' :
  'Treasury auction activity is at normal levels with minimal additional liquidity impact.'
}

**Market Interpretation:**
Net liquidity has experienced a ${netLiquidity.change > 0 ? 'significant expansion' : 'meaningful contraction'} of $${Math.abs(netLiquidity.change / 1_000_000_000).toFixed(1)}B. 

${netLiquidity.change > 0 && auctions.trend !== 'inflow' ? 
  'This suggests a BULLISH outlook for risk assets with both systemic liquidity expansion and manageable Treasury supply.' :
  netLiquidity.change < 0 || auctions.trend === 'inflow' ?
  'This suggests a CAUTIOUS outlook for risk assets due to liquidity headwinds from either systemic contraction or heavy government borrowing.' :
  'Mixed signals suggest a NEUTRAL near-term outlook with liquidity conditions balancing between expansionary and contractionary forces.'
}

**Key Auction Dynamics:**
${auctions.trend === 'inflow' && tga.trend === 'inflow' ? 
  'The auction-TGA cycle is active: new issuance is directly refilling Treasury coffers, creating the classic liquidity drain pattern.' :
  auctions.trend === 'inflow' && rrp.trend === 'outflow' ?
  'Primary dealer funding flow detected: RRP money appears to be moving toward Treasury auction purchases.' :
  'Standard liquidity patterns with minimal auction-driven distortions.'
}
    `;

    return { summary: summary.trim() };
  }
});