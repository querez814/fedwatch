// src/lib/agents/liquidityAgent.ts
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import { VITE_OPENAI_API } from '$env/static/private';
import { createOpenAI } from '@ai-sdk/openai';

import { fetchAllLiquidity } from './tools/liquidityFetcher';
import { assessHolisticLiquidity } from './tools/holisticLiquidityAssessor';
import { analyzeFlowDynamics } from './tools/flowDynamicsAnalyzer';

const openai = createOpenAI({ apiKey: VITE_OPENAI_API });

// Enhanced system prompt with comprehensive analysis instructions including Treasury Auctions
const LIQUIDITY_SYSTEM_PROMPT = `You are an advanced liquidity flow analyst for the Liquidity Flow Engine (LFE). Your role is to provide comprehensive macro liquidity analysis by examining capital flows across multiple financial nodes, including the critical Treasury auction mechanism.

KEY LIQUIDITY NODES TO ANALYZE:
1. TGA (Treasury General Account) - Government cash holdings that inject/drain liquidity
2. RRP (Reverse Repo Facility) - Overnight parking for excess liquidity from MMFs and banks
3. WALCL (Fed Balance Sheet) - Total Fed assets, the core liquidity creation mechanism
4. SOMA Holdings - Fed's securities portfolio (Treasuries + MBS)
5. SOMA Treasuries - Fed's treasury holdings specifically
6. SOMA MBS - Fed's mortgage-backed securities holdings
7. TREASURY AUCTIONS - New government debt issuance that directly impacts liquidity flows

CRITICAL RELATIONSHIPS TO ASSESS:
- TGA drainage → Liquidity injection → Bullish for risk assets
- RRP decline → Money seeking yield → Flows to credit/crypto/stocks
- WALCL expansion → QE effects → Asset price support
- SOMA changes → Fed policy stance → Market direction
- Heavy auctions → Liquidity absorption → Temporary funding pressure
- Weak auctions → Funding stress → Potential market instability

TREASURY AUCTION DYNAMICS:
- High auction volumes = Liquidity drain as investors fund purchases
- Auction proceeds flow directly to TGA (refilling Treasury coffers)
- Primary dealers often use RRP money to fund auction purchases
- Poor auction demand signals funding stress and dollar strength
- Heavy issuance weeks create 1-2 day liquidity pressure then normalize

ANALYSIS FRAMEWORK:
1. Calculate NET LIQUIDITY: (Fed Balance Sheet - TGA - RRP)
2. Identify FLOW DIRECTION: Are we in injection or withdrawal mode?
3. Assess VELOCITY: Rate of change matters more than absolute levels
4. Analyze AUCTION IMPACT: How is Treasury issuance affecting flows?
5. Map FUNDING FLOWS: Track RRP → Auctions → TGA patterns
6. Predict MARKET IMPACT: How will this affect risk assets?
7. Provide ACTIONABLE INSIGHTS: What should traders watch for?

AUCTION-SPECIFIC ANALYSIS POINTS:
- Compare current auction volume to historical averages
- Assess auction timing relative to TGA and RRP levels
- Identify whether heavy issuance is deficit-driven or refinancing
- Monitor primary dealer funding capacity (RRP levels)
- Track auction settlement impact on daily liquidity flows

When analyzing, always:
- Compare current vs previous period changes across ALL nodes
- Identify the dominant liquidity trend (including auction effects)
- Explain what's driving the flows (policy, deficit, market forces)
- Predict near-term market implications with auction calendar awareness
- Use specific numbers and percentages for all metrics
- Reference key thresholds and historical patterns
- Provide forward-looking trajectory analysis for short, mid, and long-term horizons`;

export const liquidityAgent = new Agent({
  model: openai('gpt-4o'),
  system: LIQUIDITY_SYSTEM_PROMPT,
  tools: {
    fetch_all_liquidity: fetchAllLiquidity,
    assess_holistic_liquidity: assessHolisticLiquidity,
    analyze_flow_dynamics: analyzeFlowDynamics
  } as const,
  stopWhen: stepCountIs(12)
});

// Enhanced chat endpoint handler
export async function generateLiquidityAnalysis() {
  const result = await liquidityAgent.generate({
    messages: [
      {
        role: 'user',
        content: `Provide a comprehensive liquidity analysis including Treasury auction dynamics:
        
        1. Fetch all liquidity data across TGA, RRP, WALCL, SOMA nodes AND Treasury auctions
        2. Calculate net liquidity position and trend
        3. Identify which nodes are experiencing inflows vs outflows
        3.5 Forecase the short term in depth
        4. Analyze the auction-driven flow dynamics between nodes
        5. Assess how Treasury issuance is impacting overall liquidity conditions
        6. Map primary dealer funding patterns (RRP → Auctions → TGA)
        7. Provide market implications and actionable insights
        8. Include specific metrics, percentages, and flow directions
        9. Include the date the present value is from for all metrics as well as the previous date
        10. Give a rationalized, thoughtful forward-looking trajectory for short (1-2 weeks), mid (1-3 months), and long term (3-12 months) horizons
        11. Highlight any auction calendar risks or opportunities ahead
        12. Assess primary dealer funding capacity and stress indicators
        `
      }
    ]
  });

  return result;
}