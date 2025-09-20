// src/lib/agents/liquidityAgent.ts
// src/lib/agents/liquidityAgent.ts
import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import { VITE_OPENAI_API } from '$env/static/private';
import { createOpenAI } from '@ai-sdk/openai';

import { fetchLiquidity } from './tools/liquidityFetcher';
import { assessLiquidity } from './tools/liquidityAssessor';

// Initialize OpenAI client with API key
const openai = createOpenAI({ apiKey: VITE_OPENAI_API });

// ✅ Pass the OpenAI client as provider
export const liquidityAgent = new Agent({
  model: openai('gpt-4o'),
  tools: {
    fetch_liquidity: fetchLiquidity,
    assess_liquidity: assessLiquidity
  } as const,
  stopWhen: stepCountIs(10)
});
