<script lang="ts">
    interface LiquidityDataItem {
      current: number;
      change: number;
      level: number;
    }
  
    interface LiquidityData {
      tga: LiquidityDataItem;
      rrp: LiquidityDataItem;
      soma: LiquidityDataItem;
      somaMbs: LiquidityDataItem;
      somaTreasuries: LiquidityDataItem;
      walcl: LiquidityDataItem;
    }

    interface AgentAnalysis {
      ok: boolean;
      summary: string;
      timestamp?: string;
      analysisType?: string;
      steps?: any[];
    }
  
    interface Flow {
      id: string;
      from: string;
      to: string;
      intensity: number;
      isPositive: boolean;
      startTime: number;
      path: string;
    }
  
    interface TankPosition {
      x: number;
      y: number;
      label: string;
      width: number;
      height: number;
    }
  
    interface TankPositions {
      [key: string]: TankPosition;
    }
  
    let liquidityData = $state<LiquidityData>({
      tga: { current: 0, change: 0, level: 50 },
      rrp: { current: 0, change: 0, level: 30 },
      soma: { current: 0, change: 0, level: 70 },
      somaMbs: { current: 0, change: 0, level: 60 },
      somaTreasuries: { current: 0, change: 0, level: 65 },
      walcl: { current: 0, change: 0, level: 80 }
    });

    let agentAnalysis = $state<AgentAnalysis | null>(null);
    let isLoadingAnalysis = $state(false);
    let analysisError = $state<string | null>(null);
    
    let isLoading = $state(true);
    let flows = $state<Flow[]>([]);
    let updateInterval = $state<number | null>(null);
    let lastUpdate = $state('');
    let netLiquidity = $state({ value: 0, change: 0 });
  
    const tankPositions: TankPositions = {
      tga: { x: 200, y: 150, label: 'TGA\n(Treasury General Account)', width: 100, height: 140 },
      rrp: { x: 450, y: 100, label: 'RRP\n(Reverse Repo)', width: 100, height: 140 },
      walcl: { x: 700, y: 180, label: 'Fed Balance Sheet\n(WALCL)', width: 100, height: 140 },
      soma: { x: 350, y: 300, label: 'SOMA Holdings', width: 100, height: 140 },
      somaTreasuries: { x: 550, y: 380, label: 'SOMA Treasuries', width: 100, height: 140 },
      somaMbs: { x: 150, y: 400, label: 'SOMA MBS', width: 100, height: 140 }
    };
  
    function generateFlows(data: LiquidityData): void {
      const newFlows: Flow[] = [];
      const currentTime = Date.now();
      
      const relationships = [
        { from: 'tga', to: 'rrp', condition: () => data.tga.change < 0 && data.rrp.change > 0 },
        { from: 'rrp', to: 'soma', condition: () => data.rrp.change < 0 && data.soma.change > 0 },
        { from: 'soma', to: 'somaTreasuries', condition: () => data.soma.change > 0 },
        { from: 'soma', to: 'somaMbs', condition: () => data.soma.change > 0 },
        { from: 'walcl', to: 'soma', condition: () => data.walcl.change > 0 },
        { from: 'tga', to: 'walcl', condition: () => data.tga.change < 0 && data.walcl.change > 0 }
      ];

      relationships.forEach((rel, index) => {
        if (rel.condition()) {
          const fromPos = tankPositions[rel.from];
          const toPos = tankPositions[rel.to];
          const intensity = Math.abs(data[rel.from as keyof LiquidityData].change) / 5;
          const isPositive = data[rel.to as keyof LiquidityData].change > 0;
          
          const midX = (fromPos.x + toPos.x) / 2;
          const midY = Math.min(fromPos.y, toPos.y) - 50;
          const path = `M ${fromPos.x} ${fromPos.y} Q ${midX} ${midY} ${toPos.x} ${toPos.y}`;
          
          newFlows.push({
            id: `${rel.from}-${rel.to}-${currentTime}-${index}`,
            from: rel.from,
            to: rel.to,
            intensity: Math.max(0.5, intensity),
            isPositive,
            startTime: currentTime,
            path
          });
        }
      });
      
      flows = newFlows;
    }

    async function fetchAgentAnalysis(): Promise<void> {
      isLoadingAnalysis = true;
      analysisError = null;
      
      try {
        const response = await fetch('/api/chat');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        agentAnalysis = data;
        
      } catch (error) {
        console.error('Error fetching agent analysis:', error);
        analysisError = 'Failed to fetch AI analysis';
      } finally {
        isLoadingAnalysis = false;
      }
    }
  
    async function fetchLiquidityData(): Promise<void> {
      try {
        const endpoints = [
          { key: 'tga', url: '/api/tga-recent' },
          { key: 'rrp', url: '/api/rrp-recent' },
          { key: 'soma', url: '/api/soma-recent' },
          { key: 'somaMbs', url: '/api/soma-mbs-recent' },
          { key: 'somaTreasuries', url: '/api/soma-treasuries-recent' },
          { key: 'walcl', url: '/api/walcl-recent' }
        ];

        const promises = endpoints.map(async (endpoint) => {
          try {
            const response = await fetch(endpoint.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            const latest = data.output[data.output.length - 1];
            let change = latest?.pct_change;
            
            if (change === null || change === undefined) {
              for (let i = data.output.length - 2; i >= 0; i--) {
                if (data.output[i].pct_change !== null && data.output[i].pct_change !== undefined) {
                  change = data.output[i].pct_change;
                  break;
                }
              }
              change = change || 0;
            }
            
            return {
              key: endpoint.key,
              current: parseFloat(latest?.value) || 0,
              change: parseFloat(change) || 0
            };
          } catch (error) {
            console.error(`Error fetching ${endpoint.key}:`, error);
            return {
              key: endpoint.key,
              current: 0,
              change: 0
            };
          }
        });

        const results = await Promise.all(promises);
        
        const newData: Partial<LiquidityData> = {};
        results.forEach(result => {
          const key = result.key as keyof LiquidityData;
          newData[key] = {
            current: result.current,
            change: result.change,
            level: Math.max(15, Math.min(85, 50 + result.change * 3))
          };
        });

        liquidityData = newData as LiquidityData;
        
        // Calculate net liquidity: WALCL - TGA - RRP
        const walcl = newData.walcl?.current || 0;
        const tga = newData.tga?.current || 0;
        const rrp = newData.rrp?.current || 0;
        
        const currentNet = walcl - tga - rrp;
        netLiquidity = {
          value: currentNet,
          change: (newData.walcl?.change || 0) - (newData.tga?.change || 0) - (newData.rrp?.change || 0)
        };
        
        generateFlows(newData as LiquidityData);
        isLoading = false;
        lastUpdate = new Date().toLocaleTimeString();
        
        // Fetch AI analysis after data update
        if (!agentAnalysis) {
          await fetchAgentAnalysis();
        }
      } catch (error) {
        console.error('Error fetching liquidity data:', error);
        isLoading = false;
      }
    }
  
    function formatValue(value: number): string {
      return (value / 1000).toFixed(0);
    }
  
    function formatChange(change: number): string {
      return `${change >= 0 ? '+' : ''}${change.toFixed(3)}%`;
    }

    function getConditionColor(condition: string): string {
      if (condition.includes('inflow') || condition.includes('expanding')) return 'text-emerald-400';
      if (condition.includes('outflow') || condition.includes('contracting')) return 'text-red-400';
      return 'text-yellow-400';
    }

    function parseAgentSummary(summary: string) {
      // Extract key metrics from the summary text
      const lines = summary.split('\n').filter(line => line.trim());
      
      const sections: { [key: string]: string[] } = {
        overview: [],
        keyDrivers: [],
        marketImplications: [],
        actionableInsights: []
      };
      
      let currentSection = 'overview';
      
      for (const line of lines) {
        if (line.includes('KEY') || line.includes('DRIVER')) {
          currentSection = 'keyDrivers';
        } else if (line.includes('MARKET') || line.includes('IMPLICATION')) {
          currentSection = 'marketImplications';
        } else if (line.includes('ACTION') || line.includes('INSIGHT')) {
          currentSection = 'actionableInsights';
        } else if (line.trim() && !line.includes('═') && !line.includes('─')) {
          sections[currentSection].push(line);
        }
      }
      
      return sections;
    }
  
    $effect(() => {
      fetchLiquidityData();
      updateInterval = setInterval(() => {
        fetchLiquidityData();
        fetchAgentAnalysis();
      }, 30000) as unknown as number;
      
      return () => {
        if (updateInterval) {
          clearInterval(updateInterval);
        }
      };
    });
  </script>
  
  <div class="w-full min-h-screen bg-slate-950 text-white p-6 font-sans">
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <header class="text-center mb-8">
        <h1 class="text-5xl font-bold mb-3 bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Liquidity Flow Engine (LFE)
        </h1>
        <p class="text-slate-400 text-xl mb-2 max-w-3xl mx-auto">
          Real-time Federal Reserve liquidity visualization & AI-powered analysis
        </p>
        <div class="flex justify-center items-center gap-8 text-sm flex-wrap mt-4">
          <div class="flex items-center gap-3">
            <div class="w-4 h-4 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50"></div>
            <span class="text-slate-300 font-medium">Inflow</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="w-4 h-4 bg-red-500 rounded-full shadow-lg shadow-red-500/50"></div>
            <span class="text-slate-300 font-medium">Outflow</span>
          </div>
          {#if lastUpdate}
            <div class="text-slate-500 text-sm bg-slate-800/50 px-3 py-1 rounded-full">
              Last updated: {lastUpdate}
            </div>
          {/if}
        </div>
      </header>

      <!-- Net Liquidity Banner -->
      <div class="bg-gradient-to-r from-blue-900/30 to-emerald-900/30 rounded-xl p-4 mb-6 border border-blue-800/50">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm text-slate-400 mb-1">NET LIQUIDITY (WALCL - TGA - RRP)</h3>
            <div class="flex items-baseline gap-4">
              <span class="text-3xl font-bold text-white">
                ${formatValue(netLiquidity.value)}B
              </span>
              <span class={`text-xl font-semibold ${netLiquidity.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {formatChange(netLiquidity.change)}
              </span>
              <span class={`text-sm ${netLiquidity.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {netLiquidity.change >= 0 ? '↑ EXPANDING' : '↓ CONTRACTING'}
              </span>
            </div>
          </div>
          <button 
            onclick={fetchAgentAnalysis} 
            disabled={isLoadingAnalysis}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoadingAnalysis ? 'Analyzing...' : '🤖 Refresh Analysis'}
          </button>
        </div>
      </div>

      <!-- AI Agent Analysis Panel -->
      {#if agentAnalysis}
        <div class="bg-slate-900/50 rounded-2xl p-6 mb-8 border border-slate-800">
          <h2 class="text-2xl font-bold mb-4 flex items-center gap-3">
            <span class="animate-pulse">🤖</span>
            AI Liquidity Assessment
          </h2>
          
          {#if agentAnalysis.ok && agentAnalysis.summary}
            {@const sections = parseAgentSummary(agentAnalysis.summary)}
            
            <div class="grid md:grid-cols-2 gap-6">
              <!-- Left Column - Current Status -->
              <div>
                <h3 class="text-lg font-semibold text-cyan-400 mb-3">Current Conditions</h3>
                <div class="bg-slate-800/50 rounded-lg p-4">
                  <p class="text-slate-300 text-sm leading-relaxed">
                    {agentAnalysis.summary.split('.')[0]}.
                  </p>
                  {#if sections.overview.length > 0}
                    <ul class="mt-3 space-y-1">
                      {#each sections.overview.slice(0, 3) as item}
                        <li class="text-sm text-slate-400 flex items-start">
                          <span class="text-blue-400 mr-2">→</span>
                          {item}
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              </div>
              
              <!-- Right Column - What It Means -->
              <div>
                <h3 class="text-lg font-semibold text-emerald-400 mb-3">Market Implications</h3>
                <div class="bg-slate-800/50 rounded-lg p-4 space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-400">Stocks:</span>
                    <span class={`text-sm font-medium ${agentAnalysis.summary.includes('inflow') ? 'text-emerald-400' : 'text-red-400'}`}>
                      {agentAnalysis.summary.includes('inflow') ? '📈 Bullish' : '📉 Cautious'}
                    </span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-400">Crypto:</span>
                    <span class={`text-sm font-medium ${agentAnalysis.summary.includes('inflow') ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {agentAnalysis.summary.includes('inflow') ? '🚀 Risk-On' : '➡️ Neutral'}
                    </span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-400">Dollar:</span>
                    <span class={`text-sm font-medium ${agentAnalysis.summary.includes('inflow') ? 'text-red-400' : 'text-emerald-400'}`}>
                      {agentAnalysis.summary.includes('inflow') ? '📉 Weakening' : '💪 Strengthening'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Full Summary -->
            <details class="mt-4">
              <summary class="cursor-pointer text-sm text-slate-500 hover:text-slate-400">
                View Full Analysis →
              </summary>
              <pre class="mt-3 p-4 bg-slate-800/30 rounded-lg text-xs text-slate-400 whitespace-pre-wrap">
                {agentAnalysis.summary}
              </pre>
            </details>
          {:else}
            <p class="text-slate-400">
              Analysis unavailable. The agent reported: "{agentAnalysis.summary || 'No data'}"
            </p>
          {/if}
        </div>
      {:else if isLoadingAnalysis}
        <div class="bg-slate-900/50 rounded-2xl p-6 mb-8 border border-slate-800">
          <div class="flex items-center gap-3">
            <div class="animate-spin h-5 w-5 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
            <span class="text-slate-400">AI Agent analyzing liquidity conditions...</span>
          </div>
        </div>
      {:else if analysisError}
        <div class="bg-red-900/20 rounded-2xl p-4 mb-8 border border-red-800/50">
          <p class="text-red-400">{analysisError}</p>
        </div>
      {/if}
  
      {#if isLoading}
        <div class="flex items-center justify-center h-96 bg-slate-900/50 rounded-2xl border border-slate-800">
          <div class="text-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-6"></div>
            <p class="text-slate-400 text-lg">Loading Liquidity Data...</p>
          </div>
        </div>
      {:else}
        <!-- Main visualization -->
        <div class="bg-slate-900/50 rounded-2xl p-8 border border-slate-800 mb-8 backdrop-blur-sm">
          <svg width="100%" height="600" viewBox="0 0 900 550" class="overflow-visible">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148, 163, 184, 0.08)" stroke-width="1"/>
              </pattern>
              
              {#each Object.keys(tankPositions) as id}
                <linearGradient id="greenGradient-{id}" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="rgba(16, 185, 129, 0.9)" />
                  <stop offset="50%" stop-color="rgba(5, 150, 105, 0.8)" />
                  <stop offset="100%" stop-color="rgba(4, 120, 87, 0.9)" />
                </linearGradient>
                <linearGradient id="redGradient-{id}" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="rgba(239, 68, 68, 0.9)" />
                  <stop offset="50%" stop-color="rgba(220, 38, 38, 0.8)" />
                  <stop offset="100%" stop-color="rgba(185, 28, 28, 0.9)" />
                </linearGradient>
                
                <filter id="glow-{id}">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge> 
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              {/each}
              
              <filter id="flowGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            <!-- Flow lines -->
            {#each flows as flow (flow.id)}
              {#if tankPositions[flow.from] && tankPositions[flow.to]}
                {@const fromPos = tankPositions[flow.from]}
                {@const toPos = tankPositions[flow.to]}
                {@const color = flow.isPositive ? '#10b981' : '#ef4444'}
                {@const strokeWidth = Math.max(2, flow.intensity * 4)}
                
                <g>
                  <path
                    d={flow.path}
                    stroke={color}
                    stroke-width={strokeWidth}
                    fill="none"
                    opacity="0.7"
                    filter="url(#flowGlow)"
                    class="animate-pulse"
                  />
                  
                  <circle r="4" fill={color} opacity="0.9">
                    <animateMotion dur="3s" repeatCount="indefinite">
                      <mpath href="#{flow.id}-path"/>
                    </animateMotion>
                  </circle>
                  
                  <path id="{flow.id}-path" d={flow.path} stroke="none" fill="none" opacity="0"/>
                </g>
              {/if}
            {/each}
            
            <!-- Tanks -->
            {#each Object.entries(tankPositions) as [id, position] (id)}
              {@const data = liquidityData[id as keyof LiquidityData]}
              {@const level = data.level}
              {@const change = data.change}
              {@const isPositive = change >= 0}
              
              <g transform="translate({position.x}, {position.y})">
                <rect
                  x="-48"
                  y="-68"
                  width={position.width + 16}
                  height={position.height + 16}
                  fill="rgba(0, 0, 0, 0.3)"
                  rx="12"
                  transform="translate(3, 3)"
                />
                
                <rect
                  x="-50"
                  y="-70"
                  width={position.width}
                  height={position.height}
                  fill="rgba(15, 23, 42, 0.9)"
                  stroke="rgba(148, 163, 184, 0.4)"
                  stroke-width="2"
                  rx="10"
                />
                
                <rect
                  x="-45"
                  y="-65"
                  width={position.width - 10}
                  height={position.height - 10}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.2)"
                  stroke-width="1"
                  rx="8"
                />
                
                <rect
                  x="-42"
                  y={70 - (level * 1.3)}
                  width={position.width - 16}
                  height={level * 1.3}
                  fill={isPositive ? `url(#greenGradient-${id})` : `url(#redGradient-${id})`}
                  rx="4"
                  filter="url(#glow-{id})"
                  class="transition-all duration-1000 ease-in-out"
                />
                
                <ellipse
                  cx="0"
                  cy={70 - (level * 1.3)}
                  rx="40"
                  ry="3"
                  fill={isPositive ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'}
                  class="animate-pulse"
                />
                
                <rect
                  x="-50"
                  y="-75"
                  width={position.width}
                  height="12"
                  fill="rgba(51, 65, 85, 0.9)"
                  stroke="rgba(148, 163, 184, 0.6)"
                  stroke-width="2"
                  rx="6"
                />
                
                <text
                  x="0"
                  y="-85"
                  text-anchor="middle"
                  class="text-sm font-bold fill-white"
                  filter="url(#glow-{id})"
                >
                  {formatValue(data.current)}B
                </text>
                
                <rect
                  x="-25"
                  y="78"
                  width="50"
                  height="18"
                  fill={isPositive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}
                  stroke={isPositive ? '#10b981' : '#ef4444'}
                  stroke-width="1"
                  rx="9"
                />
                <text
                  x="0"
                  y="90"
                  text-anchor="middle"
                  class="text-xs font-semibold"
                  fill={isPositive ? '#10b981' : '#ef4444'}
                >
                  {formatChange(change)}
                </text>
                
                <text
                  x="0"
                  y="110"
                  text-anchor="middle"
                  class="text-xs fill-slate-400 font-medium"
                >
                  {#each position.label.split('\n') as line, i}
                    <tspan x="0" dy={i === 0 ? 0 : 14}>
                      {line}
                    </tspan>
                  {/each}
                </text>
              </g>
            {/each}
          </svg>
        </div>
      {/if}
  
      <!-- Data summary cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {#each Object.entries(liquidityData) as [key, data] (key)}
          <div class="bg-slate-900/70 rounded-xl p-5 border border-slate-800 backdrop-blur-sm hover:bg-slate-900/90 transition-all duration-300">
            <h3 class="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
              {key}
            </h3>
            <div class="text-2xl font-bold text-white mb-2">
              ${formatValue(data.current)}B
            </div>
            <div class="text-sm font-medium px-2 py-1 rounded-full inline-block {data.change >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}">
              {formatChange(data.change)}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>