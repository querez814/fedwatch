import { VITE_FRED_API } from '$env/static/private';
import type { RequestHandler } from './$types';
import {json} from '@sveltejs/kit'
import * as dfd from 'danfojs'
import.meta.env.VITE_FRED_API


export const GET: RequestHandler = async () => {

    if (!VITE_FRED_API){
        return new Response('Fred API KEY NOT WORKING OR SET', {status: 500})
    }
    const today = new Date().toISOString().split('T')[0]; 
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=WTREGEN&api_key=${VITE_FRED_API}&file_type=json&observation_start=2020-01-01&observation_end=${today}`;
    const res = await fetch(url)
    if(!res.ok){
        return new Response('Failed to fetch WTREGEN', {status: 500})
    }
    const data = await res.json()
    const obs = data.observations
    const df = new dfd.DataFrame(obs)
    const dfFilter = df.loc({columns: ['date', 'value']})
    dfFilter.addColumn("value", dfFilter["value"].values.map(parseFloat), { inplace: true });
    
    const values = dfFilter["value"].values;
    const pctChange = values.map((current: any, index: any) => {
        if (index === 0) return null; 
        const previous = values[index - 1];
        if (previous !== 0) {
            const change = ((current - previous) / previous) * 100;
            return parseFloat(change.toFixed(2));
        }
        return null;
    });
    
    dfFilter.addColumn("pct_change", pctChange, { inplace: true });
    
    const output = dfd.toJSON(dfFilter)
    return json({output})
};
