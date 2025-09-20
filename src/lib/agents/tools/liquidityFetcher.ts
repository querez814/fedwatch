// src/lib/agents/tools/liquidityFetcher.ts
import { tool, zodSchema } from 'ai';
import { z } from 'zod';

type LiquidityNode = {
  date: string;
  value: number;
  pct_change: number | null;
};

type ComprehensiveLiquidityData = {
  tga: {
    current: LiquidityNode;
    previous: LiquidityNode;
    trend: 'inflow' | 'outflow' | 'neutral';
  };
  rrp: {
    current: LiquidityNode;
    previous: LiquidityNode;
    trend: 'inflow' | 'outflow' | 'neutral';
  };
  walcl: {
    current: LiquidityNode;
    previous: LiquidityNode;
    trend: 'inflow' | 'outflow' | 'neutral';
  };
  soma: {
    current: LiquidityNode;
    previous: LiquidityNode;
    trend: 'inflow' | 'outflow' | 'neutral';
  };
  somaTreasuries: {
    current: LiquidityNode;
    previous: LiquidityNode;
    trend: 'inflow' | 'outflow' | 'neutral';
  };
  somaMbs: {
    current: LiquidityNode;
    previous: LiquidityNode;
    trend: 'inflow' | 'outflow' | 'neutral';
  };
  netLiquidity: {
    current: number;
    previous: number;
    change: number;
    pctChange: number;
  };
};

const rawSchema = z.object({});
const inputSchema = zodSchema(rawSchema);

function determineTrend(current: number, previous: number): 'inflow' | 'outflow' | 'neutral' {
  const threshold = 0.1; // 0.1% threshold for neutral
  const pctChange = ((current - previous) / previous) * 100;
  
  if (Math.abs(pctChange) < threshold) return 'neutral';
  return pctChange > 0 ? 'inflow' : 'outflow';
}

export const fetchAllLiquidity = tool<z.infer<typeof rawSchema>, ComprehensiveLiquidityData>({
  name: 'fetch_all_liquidity',
  description: 'Fetches comprehensive liquidity data from all major nodes including TGA, RRP, WALCL, SOMA and calculates net liquidity',
  inputSchema,
  execute: async () => {
    try {
      // Fetch consolidated data from the API
      const res = await fetch('http://localhost:5173/api/consolidated-recent');
      if (!res.ok) {
        throw new Error('Failed to fetch consolidated liquidity data');
      }

      const json = await res.json();
      
      // Process each liquidity node
      const processNode = (nodeData: any, nodeName: string) => {
        if (!nodeData?.data || nodeData.data.length < 2) {
          throw new Error(`Incomplete or missing data for node: ${nodeName}`);
        }
        
        const current = nodeData.data[nodeData.data.length - 1];
        const previous = nodeData.data[nodeData.data.length - 2];
        
        return {
          current: {
            date: current.date,
            value: current.value,
            pct_change: current.pct_change
          },
          previous: {
            date: previous.date,
            value: previous.value,
            pct_change: previous.pct_change
          },
          trend: determineTrend(current.value, previous.value)
        };
      };

      const tga = processNode(json.tga, 'tga');
      const rrp = processNode(json.rrp, 'rrp');
      const walcl = processNode(json.walcl, 'walcl');
      const soma = processNode(json.soma, 'soma');
      const somaTreasuries = processNode(json.somaTreasuries, 'somaTreasuries');
      const somaMbs = processNode(json.somaMbs, 'somaMbs');

      // Calculate Net Liquidity: WALCL - TGA - RRP
      // This is the key metric for overall liquidity conditions
      const currentNetLiquidity = walcl.current.value - tga.current.value - rrp.current.value;
      const previousNetLiquidity = walcl.previous.value - tga.previous.value - rrp.previous.value;
      const netLiquidityChange = currentNetLiquidity - previousNetLiquidity;
      const netLiquidityPctChange = (netLiquidityChange / previousNetLiquidity) * 100;

      return {
        tga,
        rrp,
        walcl,
        soma,
        somaTreasuries,
        somaMbs,
        netLiquidity: {
          current: currentNetLiquidity,
          previous: previousNetLiquidity,
          change: netLiquidityChange,
          pctChange: netLiquidityPctChange
        }
      };
    } catch (error) {
      console.error('Error fetching comprehensive liquidity data:', error);
      throw error;
    }
  }
});