import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ fetch }) => {
  const endpoints = [
    { key: 'tga', url: '/api/tga-recent' },
    { key: 'rrp', url: '/api/rrp-recent' },
    { key: 'soma', url: '/api/soma-recent' },
    { key: 'somaMbs', url: '/api/soma-mbs-recent' },
    { key: 'somaTreasuries', url: '/api/soma-treasuries-recent' },
    { key: 'walcl', url: '/api/walcl-recent' }
  ];

  try {
    const promises = endpoints.map(async (endpoint) => {
      try {
        const response = await fetch(endpoint.url);
        if (!response.ok) {
          console.error(`Failed to fetch ${endpoint.url}: ${response.statusText}`);
          return { key: endpoint.key, data: null, error: `Failed to fetch data: ${response.statusText}` };
        }
        const data = await response.json();
        const recentData = data.output.slice(-5); // Get the last 5 items
        return { key: endpoint.key, data: recentData };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error processing ${endpoint.key}:`, errorMessage);
        return { key: endpoint.key, data: null, error: errorMessage };
      }
    });

    const results = await Promise.all(promises);

    const consolidatedData: { [key: string]: any } = {};
    results.forEach(result => {
      consolidatedData[result.key] = result.data ? { data: result.data } : { error: result.error };
    });

    return json({
      lastUpdated: new Date().toISOString(),
      ...consolidatedData
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch consolidated data:', errorMessage);
    return json({ error: 'Failed to fetch consolidated data', details: errorMessage }, { status: 500 });
  }
};
