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
  auctions: nodeDataSchema,
  netLiquidity: z.object({
    current: z.number(),
    previous: z.number(),
    change: z.number(),
    pctChange: z.number()
  })
});

export const analyzeFlowDynamics = tool({
  name: 'analyze_flow_dynamics',
  description: 'Analyzes the interplay between TGA, RRP, WALCL, and Treasury Auctions to determine the primary drivers of net liquidity changes and funding flow patterns.',
  inputSchema: zodSchema(rawSchema),
  execute: async ({ tga, rrp, walcl, auctions, netLiquidity }) => {
    const tgaChange = tga.current.value - tga.previous.value;
    const rrpChange = rrp.current.value - rrp.previous.value;
    const walclChange = walcl.current.value - walcl.previous.value;
    const auctionChange = auctions.current.value - auctions.previous.value;

    let dynamics = '';

    // Net Liquidity = WALCL - TGA - RRP
    // Change in Net Liq = Change in WALCL - Change in TGA - Change in RRP
    
    const tgaImpact = -tgaChange; // Decrease in TGA is an inflow
    const rrpImpact = -rrpChange; // Decrease in RRP is an inflow
    const auctionImpact = -auctionChange; // Higher auctions = more liquidity drain

    const drivers = [
      { name: 'WALCL', impact: walclChange, description: 'Fed Balance Sheet' },
      { name: 'TGA', impact: tgaImpact, description: 'Treasury Account' },
      { name: 'RRP', impact: rrpImpact, description: 'Reverse Repo' },
      { name: 'AUCTIONS', impact: auctionImpact, description: 'Treasury Issuance' }
    ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    const primaryDriver = drivers[0];
    const secondaryDriver = drivers[1];

    dynamics = `The primary driver of the ${netLiquidity.change > 0 ? 'liquidity inflow' : 'liquidity outflow'} is ${primaryDriver.description} with a ${primaryDriver.impact > 0 ? 'positive' : 'negative'} impact of $${Math.abs(primaryDriver.impact / 1000).toFixed(1)}B. `;
    
    if (Math.abs(secondaryDriver.impact) > Math.abs(netLiquidity.change) * 0.15) {
      dynamics += `This was ${secondaryDriver.impact * primaryDriver.impact > 0 ? 'reinforced' : 'partially offset'} by ${secondaryDriver.description} (${secondaryDriver.impact > 0 ? '+' : ''}$${(secondaryDriver.impact / 1000).toFixed(1)}B). `;
    }

    // Specific flow pattern analysis
    if (primaryDriver.name === 'TGA' && tgaImpact > 0) {
      dynamics += "\n\n🔵 TGA DRAINAGE PATTERN: Treasury spending is injecting cash directly into the financial system. This cash typically flows first to bank reserves, then gets deployed to risk assets as institutions seek yield.";
    } else if (primaryDriver.name === 'RRP' && rrpImpact > 0) {
      dynamics += "\n\n🟢 RRP OUTFLOW PATTERN: Money market funds and banks are pulling cash from the Fed's overnight facility. This capital is now seeking higher returns in credit markets, potentially flowing to stocks and crypto.";
    } else if (primaryDriver.name === 'WALCL' && walclChange < 0) {
      dynamics += "\n\n🔴 QUANTITATIVE TIGHTENING: The Fed's balance sheet reduction is the dominant force draining system liquidity. This typically pressures all risk assets as the monetary base contracts.";
    } else if (primaryDriver.name === 'AUCTIONS' && auctionImpact < 0) {
      dynamics += "\n\n📈 HEAVY ISSUANCE CYCLE: Large Treasury auction volumes are absorbing significant liquidity as primary dealers and investors fund new purchases. This creates temporary but meaningful funding pressure.";
    }

    // Multi-factor flow interactions
    if (tgaImpact > 0 && rrpImpact > 0) {
      dynamics += "\n\n⚡ DOUBLE INJECTION: Both TGA drainage and RRP outflows are occurring simultaneously. This is the most bullish liquidity configuration for risk assets.";
    }
    
    if (auctionChange > 0 && tgaChange > 0) {
      dynamics += "\n\n🔄 AUCTION-TGA CYCLE: Heavy Treasury issuance is directly refilling the Treasury's account. This is the classic government funding mechanism that temporarily drains private sector liquidity.";
    }
    
    if (auctionChange > 0 && rrpChange < 0) {
      dynamics += "\n\n💰 PRIMARY DEALER FUNDING: RRP money appears to be flowing toward Treasury auction purchases. This suggests primary dealers are using overnight funds to finance new government debt.";
    }

    if (Math.abs(auctionChange) > Math.abs(tgaChange) * 0.5 && auctionChange > 0) {
      dynamics += "\n\n⚠️ AUCTION STRESS SIGNAL: Treasury issuance volume is unusually high relative to TGA movements, suggesting either poor auction demand or aggressive deficit financing needs.";
    }

    // Forward-looking implications
    dynamics += "\n\n📊 FLOW TRAJECTORY: ";
    if (netLiquidity.change > 0) {
      dynamics += "The current inflow pattern supports continued risk-on positioning, but monitor TGA refill timing and upcoming auction calendar for potential reversals.";
    } else {
      dynamics += "The liquidity drain suggests defensive positioning is warranted. Watch for TGA drainage resumption or RRP decline to signal the next inflow cycle.";
    }

    return { analysis: dynamics };
  }
});