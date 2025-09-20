import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { liquidityAgent } from '$lib/agents/liquidityAgent';

export const GET: RequestHandler = async () => {
	try {
		const result = await liquidityAgent.generate({
			messages: [
				{
					role: 'user',
					content: 'Assess the current USD liquidity conditions using the available tools.'
				}
			]
		});

		return json({
			ok: true,
			summary: result.text,
			steps: result.steps // Optional: use this to show tool reasoning steps in UI
		});
	} catch (error) {
		console.error('[Agent Error]', error);
		return new Response(
			JSON.stringify({
				ok: false,
				error: 'Agent failed to generate liquidity summary.'
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
