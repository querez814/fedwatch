// src/lib/agents/liquidityAgent.ts
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import { VITE_OPENAI_API } from '$env/static/private';
import { createOpenAI } from '@ai-sdk/openai';

import { fetchAllLiquidity } from './tools/liquidityFetcher';
import { assessHolisticLiquidity } from './tools/liquidityAssessor';
import { analyzeFlowDynamics } from './tools/flowDynamicsAnalyzer';

const openai = createOpenAI({ apiKey: VITE_OPENAI_API });

// Enhanced system prompt with comprehensive analysis instructions
const LIQUIDITY_SYSTEM_PROMPT = `You are an advanced liquidity flow analyst for the Liquidity Flow Engine (LFE). Your role is to provide comprehensive macro liquidity analysis by examining capital flows across multiple financial nodes.

KEY LIQUIDITY NODES TO ANALYZE:
1. TGA (Treasury General Account) - Government cash holdings
2. RRP (Reverse Repo Facility) - Overnight parking for excess liquidity
3. WALCL (Fed Balance Sheet) - Total Fed assets
4. SOMA Holdings - Fed's securities portfolio
5. SOMA Treasuries - Fed's treasury holdings
6. SOMA MBS - Fed's mortgage-backed securities

CRITICAL RELATIONSHIPS TO ASSESS:
- TGA drainage → Liquidity injection → Bullish for risk assets
- RRP decline → Money seeking yield → Flows to credit/crypto/stocks
- WALCL expansion → QE effects → Asset price support
- SOMA changes → Fed policy stance → Market direction

ANALYSIS FRAMEWORK:
1. Calculate NET LIQUIDITY: (Fed Balance Sheet - TGA - RRP)
2. Identify FLOW DIRECTION: Are we in injection or withdrawal mode?
3. Assess VELOCITY: Rate of change matters more than absolute levels
4. Predict MARKET IMPACT: How will this affect risk assets?
5. Provide ACTIONABLE INSIGHTS: What should traders watch for?

When analyzing, always:
- Compare current vs previous period changes
- Identify the dominant liquidity trend
- Explain what's driving the flows
- Predict near-term market implications
- Use specific numbers and percentages
- Reference key thresholds and historical patterns`;

export const liquidityAgent = new Agent({
  model: openai('gpt-4o'),
  system: LIQUIDITY_SYSTEM_PROMPT,
  tools: {
    fetch_all_liquidity: fetchAllLiquidity,
    assess_holistic_liquidity: assessHolisticLiquidity,
    analyze_flow_dynamics: analyzeFlowDynamics
  } as const,
  stopWhen: stepCountIs(10)
});

// Enhanced chat endpoint handler
export async function generateLiquidityAnalysis() {
  const result = await liquidityAgent.generate({
    messages: [
      {
        role: 'user',
        content: `Provide a comprehensive liquidity analysis:
        1. Fetch all liquidity data across TGA, RRP, WALCL, SOMA nodes
        2. Calculate net liquidity position and trend
        3. Identify which nodes are experiencing inflows vs outflows
        4. Analyze the flow dynamics between nodes
        5. Provide market implications and actionable insights
        6. Include specific metrics, percentages, and flow directions
        7. Include the date the present value is from for all metrics as well as the previous date
        8. give a rationalized, thoughout forward looking trajectory for short, mid, and long term 
        `

      }
    ]
  });

  return result;
}