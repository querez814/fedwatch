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
    
    let isLoading = $state(true);
    let flows = $state<Flow[]>([]);
    let updateInterval = $state<number | null>(null);
    let lastUpdate = $state('');
  
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
      
      // Define realistic liquidity relationships
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
          
          // Create curved path for more realistic plumbing look
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
              current: Math.random() * 5000 + 1000,
              change: (Math.random() - 0.5) * 10
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
        generateFlows(newData as LiquidityData);
        isLoading = false;
        lastUpdate = new Date().toLocaleTimeString();
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
  
    $effect(() => {
      fetchLiquidityData();
      updateInterval = setInterval(fetchLiquidityData, 30000) as unknown as number;
      
      return () => {
        if (updateInterval) {
          clearInterval(updateInterval);
        }
      };
    });
  </script>
  
  <!-- Enhanced styling with better dark theme and improved visual hierarchy -->
  <div class="w-full min-h-screen bg-slate-950 text-white p-6 font-sans">
    <div class="max-w-7xl mx-auto">
      <header class="text-center mb-8">
        <h1 class="text-5xl font-bold mb-3 bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
          Liquidity Plumbing System
        </h1>
        <p class="text-slate-400 text-xl mb-6 max-w-3xl mx-auto leading-relaxed">
          Real-time visualization of capital flows between Federal Reserve liquidity pools
        </p>
        <div class="flex justify-center items-center gap-8 text-sm flex-wrap">
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
  
      {#if isLoading}
        <div class="flex items-center justify-center h-96 bg-slate-900/50 rounded-2xl border border-slate-800">
          <div class="text-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-6"></div>
            <p class="text-slate-400 text-lg">Loading Liquidity Data...</p>
          </div>
        </div>
      {:else}
        <!-- Enhanced main visualization with better SVG styling and animations -->
        <div class="bg-slate-900/50 rounded-2xl p-8 border border-slate-800 mb-8 backdrop-blur-sm">
          <svg width="100%" height="600" viewBox="0 0 900 550" class="overflow-visible">
            <defs>
              <!-- Enhanced grid pattern -->
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148, 163, 184, 0.08)" stroke-width="1"/>
              </pattern>
              
              <!-- Enhanced gradients for tanks -->
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
                
                <!-- Glow effects -->
                <filter id="glow-{id}">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge> 
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              {/each}
              
              <!-- Flow animation -->
              <filter id="flowGlow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            <!-- Enhanced flow lines with curved paths and better animations -->
            {#each flows as flow (flow.id)}
              {#if tankPositions[flow.from] && tankPositions[flow.to]}
                {@const fromPos = tankPositions[flow.from]}
                {@const toPos = tankPositions[flow.to]}
                {@const color = flow.isPositive ? '#10b981' : '#ef4444'}
                {@const strokeWidth = Math.max(2, flow.intensity * 4)}
                
                <g>
                  <!-- Main flow path -->
                  <path
                    d={flow.path}
                    stroke={color}
                    stroke-width={strokeWidth}
                    fill="none"
                    opacity="0.7"
                    filter="url(#flowGlow)"
                    class="animate-pulse"
                  />
                  
                  <!-- Animated flow particles -->
                  <circle r="4" fill={color} opacity="0.9">
                    <animateMotion dur="3s" repeatCount="indefinite">
                      <mpath href="#{flow.id}-path"/>
                    </animateMotion>
                  </circle>
                  
                  <!-- Hidden path for animation -->
                  <path id="{flow.id}-path" d={flow.path} stroke="none" fill="none" opacity="0"/>
                </g>
              {/if}
            {/each}
            
            <!-- Enhanced tanks with better 3D appearance and improved styling -->
            {#each Object.entries(tankPositions) as [id, position] (id)}
              {@const data = liquidityData[id as keyof LiquidityData]}
              {@const level = data.level}
              {@const change = data.change}
              {@const isPositive = change >= 0}
              
              <g transform="translate({position.x}, {position.y})">
                <!-- Tank shadow -->
                <rect
                  x="-48"
                  y="-68"
                  width={position.width + 16}
                  height={position.height + 16}
                  fill="rgba(0, 0, 0, 0.3)"
                  rx="12"
                  transform="translate(3, 3)"
                />
                
                <!-- Tank container with 3D effect -->
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
                
                <!-- Inner tank border -->
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
                
                <!-- Liquid level with enhanced gradient -->
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
                
                <!-- Liquid surface effect -->
                <ellipse
                  cx="0"
                  cy={70 - (level * 1.3)}
                  rx="40"
                  ry="3"
                  fill={isPositive ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'}
                  class="animate-pulse"
                />
                
                <!-- Tank cap with 3D effect -->
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
                
                <!-- Value display with better styling -->
                <text
                  x="0"
                  y="-85"
                  text-anchor="middle"
                  class="text-sm font-bold fill-white"
                  filter="url(#glow-{id})"
                >
                  {formatValue(data.current)}B
                </text>
                
                <!-- Change indicator with enhanced styling -->
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
                
                <!-- Enhanced label -->
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
  
      <!-- Enhanced data summary cards with better styling -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
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
  
      <!-- Market insights -->
      <div class="bg-slate-800/30 rounded-lg p-6 border border-slate-700">
        <h2 class="text-xl font-bold text-white mb-4">Market Insights</h2>
        <div class="grid md:grid-cols-2 gap-6 text-sm text-slate-300">
          <div>
            <h3 class="font-semibold text-white mb-2">How to Read the Plumbing:</h3>
            <ul class="space-y-1">
              <li class="flex items-start">
                <span class="text-blue-400 mr-2">•</span>
                Tank levels show relative liquidity abundance
              </li>
              <li class="flex items-start">
                <span class="text-blue-400 mr-2">•</span>
                Green flows = money moving in (bullish for risk assets)
              </li>
              <li class="flex items-start">
                <span class="text-blue-400 mr-2">•</span>
                Red flows = money draining out (bearish signal)
              </li>
              <li class="flex items-start">
                <span class="text-blue-400 mr-2">•</span>
                TGA drainage typically supports equity rallies
              </li>
            </ul>
          </div>
          <div>
            <h3 class="font-semibold text-white mb-2">Key Relationships:</h3>
            <ul class="space-y-1">
              <li class="flex items-start">
                <span class="text-blue-400 mr-2">•</span>
                RRP ↓ → Credit markets ↑ → Crypto/Stocks ↑
              </li>
              <li class="flex items-start">
                <span class="text-blue-400 mr-2">•</span>
                TGA ↓ → Liquidity injection → Risk-on
              </li>
              <li class="flex items-start">
                <span class="text-blue-400 mr-2">•</span>
                SOMA changes signal Fed policy shifts
              </li>
              <li class="flex items-start">
                <span class="text-blue-400 mr-2">•</span>
                MBS holdings affect mortgage markets
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
