// src/lib/agents/tools/holisticLiquidityAssessor.ts
import { tool, zodSchema } from 'ai';
import { z } from 'zod';

const liquidityNodeSchema = z.object({
  current: z.object({
    date: z.string(),
    value: z.number(),
    pct_change: z.number().nullable()
  }),
  previous: z.object({
    date: z.string(),
    value: z.number(),
    pct_change: z.number().nullable()
  }),
  trend: z.enum(['inflow', 'outflow', 'neutral'])
});

const rawSchema = z.object({
  tga: liquidityNodeSchema,
  rrp: liquidityNodeSchema,
  walcl: liquidityNodeSchema,
  soma: liquidityNodeSchema,
  somaTreasuries: liquidityNodeSchema,
  somaMbs: liquidityNodeSchema,
  netLiquidity: z.object({
    current: z.number(),
    previous: z.number(),
    change: z.number(),
    pctChange: z.number()
  })
});

type LiquidityAssessment = {
  overallCondition: 'expansionary' | 'contractionary' | 'neutral';
  netLiquidityTrend: string;
  keyDrivers: string[];
  nodeAnalysis: {
    [key: string]: {
      status: string;
      impact: string;
      value: number;
      change: number;
    };
  };
  flowDynamics: string[];
  marketImplications: {
    stocks: string;
    crypto: string;
    bonds: string;
    dollar: string;
  };
  riskSignals: string[];
  actionableInsights: string[];
  technicalLevels: {
    support: number;
    resistance: number;
    criticalLevel: number;
  };
};

export const assessHolisticLiquidity = tool<z.infer<typeof rawSchema>, LiquidityAssessment>({
  name: 'assess_holistic_liquidity',
  description: 'Performs comprehensive liquidity assessment across all nodes and provides market implications',
  inputSchema: zodSchema(rawSchema),
  execute: async (data) => {
    const { tga, rrp, walcl, soma, somaTreasuries, somaMbs, netLiquidity } = data;
    
    // Determine overall liquidity condition
    const overallCondition = netLiquidity.pctChange > 0.5 ? 'expansionary' :
                            netLiquidity.pctChange < -0.5 ? 'contractionary' : 'neutral';
    
    // Format net liquidity trend
    const netLiquidityTrend = netLiquidity.change > 0 
      ? `Net liquidity EXPANDING by $${Math.abs(netLiquidity.change / 1000).toFixed(1)}B (+${netLiquidity.pctChange.toFixed(2)}%)`
      : `Net liquidity CONTRACTING by $${Math.abs(netLiquidity.change / 1000).toFixed(1)}B (${netLiquidity.pctChange.toFixed(2)}%)`;
    
    // Identify key drivers
    const keyDrivers = [];
    
    if (tga.trend === 'outflow') {
      keyDrivers.push(`TGA drainage injecting $${Math.abs((tga.current.value - tga.previous.value) / 1000).toFixed(1)}B into system`);
    } else if (tga.trend === 'inflow') {
      keyDrivers.push(`TGA filling, removing $${Math.abs((tga.current.value - tga.previous.value) / 1000).toFixed(1)}B from system`);
    }
    
    if (rrp.trend === 'outflow') {
      keyDrivers.push(`RRP declining by $${Math.abs((rrp.current.value - rrp.previous.value) / 1000).toFixed(1)}B - money seeking yield`);
    } else if (rrp.trend === 'inflow') {
      keyDrivers.push(`RRP increasing by $${Math.abs((rrp.current.value - rrp.previous.value) / 1000).toFixed(1)}B - flight to safety`);
    }
    
    if (walcl.trend === 'inflow') {
      keyDrivers.push(`Fed Balance Sheet expanding by ${walcl.current.pct_change?.toFixed(2)}% - QE effects`);
    } else if (walcl.trend === 'outflow') {
      keyDrivers.push(`Fed Balance Sheet contracting by ${Math.abs(walcl.current.pct_change || 0).toFixed(2)}% - QT ongoing`);
    }
    
    // Node-by-node analysis
    const nodeAnalysis = {
      TGA: {
        status: tga.trend === 'outflow' ? '🟢 DRAINING (Bullish)' : tga.trend === 'inflow' ? '🔴 FILLING (Bearish)' : '⚪ STABLE',
        impact: tga.trend === 'outflow' ? 'Adding liquidity to markets' : 'Removing liquidity from markets',
        value: tga.current.value / 1000,
        change: ((tga.current.value - tga.previous.value) / 1000)
      },
      RRP: {
        status: rrp.trend === 'outflow' ? '🟢 DECLINING (Bullish)' : rrp.trend === 'inflow' ? '🔴 RISING (Bearish)' : '⚪ STABLE',
        impact: rrp.trend === 'outflow' ? 'Cash deploying to risk assets' : 'Cash parking in safety',
        value: rrp.current.value / 1000,
        change: ((rrp.current.value - rrp.previous.value) / 1000)
      },
      WALCL: {
        status: walcl.trend === 'inflow' ? '🟢 EXPANDING (Bullish)' : walcl.trend === 'outflow' ? '🔴 SHRINKING (Bearish)' : '⚪ STABLE',
        impact: walcl.trend === 'inflow' ? 'Fed adding reserves' : 'Fed draining reserves',
        value: walcl.current.value / 1000,
        change: ((walcl.current.value - walcl.previous.value) / 1000)
      },
      SOMA: {
        status: soma.trend === 'inflow' ? '🟢 GROWING' : soma.trend === 'outflow' ? '🔴 SHRINKING' : '⚪ STABLE',
        impact: 'Fed securities portfolio changes',
        value: soma.current.value / 1000,
        change: ((soma.current.value - soma.previous.value) / 1000)
      }
    };
    
    // Flow dynamics
    const flowDynamics = [];
    
    if (tga.trend === 'outflow' && rrp.trend === 'outflow') {
      flowDynamics.push('⚡ DOUBLE INJECTION: Both TGA and RRP releasing liquidity - HIGHLY BULLISH');
    }
    if (tga.trend === 'inflow' && rrp.trend === 'inflow') {
      flowDynamics.push('⚠️ DOUBLE DRAIN: Both TGA and RRP absorbing liquidity - RISK-OFF signal');
    }
    if (rrp.trend === 'outflow' && walcl.trend === 'inflow') {
      flowDynamics.push('🚀 RISK-ON FLOW: RRP → Credit → Crypto/Stocks rotation active');
    }
    if (soma.trend !== 'neutral') {
      flowDynamics.push(`📊 SOMA ${soma.trend === 'inflow' ? 'expansion' : 'reduction'} signaling Fed policy ${soma.trend === 'inflow' ? 'accommodation' : 'tightening'}`);
    }
    
    // Market implications
    const bullishFactors = [tga.trend === 'outflow', rrp.trend === 'outflow', walcl.trend === 'inflow'].filter(Boolean).length;
    const bearishFactors = [tga.trend === 'inflow', rrp.trend === 'inflow', walcl.trend === 'outflow'].filter(Boolean).length;
    
    const marketImplications = {
      stocks: bullishFactors > bearishFactors ? '📈 BULLISH - Liquidity supportive of equity rally' :
              bearishFactors > bullishFactors ? '📉 BEARISH - Liquidity headwinds for stocks' :
              '➡️ NEUTRAL - Mixed liquidity signals',
      
      crypto: rrp.trend === 'outflow' ? '🚀 BULLISH - RRP outflows favor risk-on crypto' :
              rrp.trend === 'inflow' ? '⬇️ BEARISH - Flight to safety away from crypto' :
              '➡️ NEUTRAL - No clear crypto signal',
      
      bonds: walcl.trend === 'outflow' ? '📈 BULLISH - QT supports higher yields' :
             walcl.trend === 'inflow' ? '📉 BEARISH - QE suppresses yields' :
             '➡️ NEUTRAL - Fed policy unclear',
      
      dollar: netLiquidity.change < 0 ? '💪 BULLISH - Liquidity contraction supports USD' :
              netLiquidity.change > 0 ? '📉 BEARISH - Liquidity expansion weakens USD' :
              '➡️ NEUTRAL - No clear dollar direction'
    };
    
    // Risk signals
    const riskSignals = [];
    
    if (rrp.current.value < 500000) {
      riskSignals.push('🎯 RRP approaching zero - final liquidity squeeze incoming');
    }
    if (tga.current.value > 1000000) {
      riskSignals.push('⚠️ TGA elevated above $1T - potential liquidity drain ahead');
    }
    if (netLiquidity.pctChange < -2) {
      riskSignals.push('🚨 Sharp liquidity contraction - risk-off event possible');
    }
    if (walcl.current.pct_change && Math.abs(walcl.current.pct_change) > 1) {
      riskSignals.push('📊 Unusual Fed balance sheet movement - policy shift detected');
    }
    
    // Actionable insights
    const actionableInsights = [];
    
    if (overallCondition === 'expansionary') {
      actionableInsights.push('✅ LONG BIAS: Favor risk assets (tech stocks, crypto, high-yield credit)');
      actionableInsights.push('📊 Add to positions on dips with liquidity tailwind support');
    } else if (overallCondition === 'contractionary') {
      actionableInsights.push('⛔ DEFENSIVE STANCE: Reduce risk, favor cash/short-duration bonds');
      actionableInsights.push('📉 Consider hedges or short positions in overvalued growth');
    }
    
    if (rrp.trend === 'outflow' && rrp.current.value > 100000) {
      actionableInsights.push('🎯 WATCH: RRP has more room to drain - sustained rally possible');
    }
    
    if (tga.trend === 'outflow' && tga.current.value < 500000) {
      actionableInsights.push('⏰ TIMING: TGA drainage limited - liquidity boost may be ending');
    }
    
    // Technical levels (simplified calculation based on net liquidity)
    const baseLevel = netLiquidity.current / 1000;
    const technicalLevels = {
      support: Math.round(baseLevel * 0.95),
      resistance: Math.round(baseLevel * 1.05),
      criticalLevel: Math.round(baseLevel)
    };
    
    return {
      overallCondition,
      netLiquidityTrend,
      keyDrivers,
      nodeAnalysis,
      flowDynamics,
      marketImplications,
      riskSignals,
      actionableInsights,
      technicalLevels
    };
  }
});