// src/routes/api/chat/+server.ts
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { liquidityAgent, generateLiquidityAnalysis } from '$lib/agents/liquidityAgent';

export const GET: RequestHandler = async () => {
  try {
    // Use the enhanced analysis function
    const result = await generateLiquidityAnalysis();

    // Format the comprehensive response
    const formattedResponse = formatComprehensiveAnalysis(result);

    return json({
      ok: true,
      summary: formattedResponse,
      steps: result.steps,
      timestamp: new Date().toISOString(),
      analysisType: 'comprehensive'
    });
  } catch (error) {
    console.error('[Agent Error]', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Agent failed to generate liquidity analysis.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
};

// Helper function to format the comprehensive analysis
function formatComprehensiveAnalysis(result: any): string {
  const analysis = result.text || '';
  
  // Add structured sections if not already present
  const sections = [
    '📊 LIQUIDITY FLOW ENGINE ANALYSIS',
    '═══════════════════════════════',
    '',
    '🔍 EXECUTIVE SUMMARY',
    '───────────────────',
    analysis,
    '',
    '💡 KEY TAKEAWAYS',
    '─────────────────',
    '• Net liquidity position and trend',
    '• Critical flow paths identified',
    '• Market positioning recommendations',
    '',
    '⚠️ RISK ALERTS',
    '──────────────',
    '• Monitor RRP levels for exhaustion',
    '• Watch TGA refill schedule',
    '• Track Fed policy signals in SOMA',
    '',
    '📈 TRADING SIGNALS',
    '──────────────────',
    '• Entry/Exit levels based on liquidity',
    '• Sector rotation guidance',
    '• Timeline for flow impacts',
    '',
    '🎯 ACTION ITEMS',
    '───────────────',
    '• Immediate: Position adjustments needed',
    '• This week: Sectors to watch',
    '• This month: Major liquidity events'
  ];
  
  return sections.join('\n');
}

// Alternative endpoint for real-time updates
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const { analysisType = 'standard', includeHistorical = false } = body;
    
    let prompt = `Provide a ${analysisType} liquidity analysis focusing on:`;
    
    if (analysisType === 'rapid') {
      prompt += `
        - Quick snapshot of current conditions
        - Immediate market impact
        - Single most important metric`;
    } else if (analysisType === 'deep') {
      prompt += `
        - Comprehensive multi-node analysis
        - Historical context and patterns
        - Detailed flow dynamics
        - Predictive modeling
        - Sector-specific implications`;
    } else {
      // Standard analysis
      prompt = `Provide a comprehensive liquidity analysis:
        1. Fetch all liquidity data across TGA, RRP, WALCL, SOMA nodes
        2. Calculate net liquidity position and trend
        3. Identify which nodes are experiencing inflows vs outflows
        4. Analyze the flow dynamics between nodes
        5. Provide market implications and actionable insights
        6. Include specific metrics, percentages, and flow directions`;
    }
    
    if (includeHistorical) {
      prompt += `
        Additionally, compare current conditions to:
        - 1 week ago
        - 1 month ago
        - Key historical inflection points`;
    }
    
    const result = await liquidityAgent.generate({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });
    
    return json({
      ok: true,
      summary: result.text,
      steps: result.steps,
      timestamp: new Date().toISOString(),
      analysisType
    });
    
  } catch (error) {
    console.error('[Agent Error]', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Agent failed to generate liquidity analysis.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
};