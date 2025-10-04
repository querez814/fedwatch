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
  auctions: {
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
  description: 'Fetches comprehensive liquidity data from all major nodes including TGA, RRP, WALCL, SOMA, and Treasury Auctions, then calculates net liquidity',
  inputSchema,
  execute: async () => {
    try {
      // Fetch data from individual endpoints
      const endpoints = [
        { key: 'tga', url: 'http://localhost:5173/api/tga-recent' },
        { key: 'rrp', url: 'http://localhost:5173/api/rrp-recent' },
        { key: 'walcl', url: 'http://localhost:5173/api/walcl-recent' },
        { key: 'soma', url: 'http://localhost:5173/api/soma-recent' },
        { key: 'somaTreasuries', url: 'http://localhost:5173/api/soma-treasuries-recent' },
        { key: 'somaMbs', url: 'http://localhost:5173/api/soma-mbs-recent' },
        { key: 'auctions', url: 'http://localhost:5173/api/auctions' }
      ];

      const fetchPromises = endpoints.map(async (endpoint) => {
        const res = await fetch(endpoint.url);
        if (!res.ok) {
          throw new Error(`Failed to fetch ${endpoint.key} data`);
        }
        const json = await res.json();
        return { key: endpoint.key, data: json.output };
      });

      const results = await Promise.all(fetchPromises);
      const dataMap = results.reduce((acc, result) => {
        acc[result.key] = result.data;
        return acc;
      }, {} as Record<string, any[]>);

      // Process each liquidity node
      const processNode = (nodeData: any[], nodeName: string, valueField: string = 'value') => {
        if (!nodeData || nodeData.length < 2) {
          throw new Error(`Incomplete or missing data for node: ${nodeName}`);
        }
        
        const current = nodeData[nodeData.length - 1];
        const previous = nodeData[nodeData.length - 2];
        
        return {
          current: {
            date: current.date || current.settlementDate,
            value: current[valueField],
            pct_change: current.pct_change
          },
          previous: {
            date: previous.date || previous.settlementDate,
            value: previous[valueField],
            pct_change: previous.pct_change
          },
          trend: determineTrend(current[valueField], previous[valueField])
        };
      };

      const tga = processNode(dataMap.tga, 'tga');
      const rrp = processNode(dataMap.rrp, 'rrp');
      const walcl = processNode(dataMap.walcl, 'walcl');
      const soma = processNode(dataMap.soma, 'soma');
      const somaTreasuries = processNode(dataMap.somaTreasuries, 'somaTreasuries');
      const somaMbs = processNode(dataMap.somaMbs, 'somaMbs');
      
      // Auctions use 'total_outflow' field instead of 'value'
      const auctions = processNode(dataMap.auctions, 'auctions', 'total_outflow');

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
        auctions,
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