import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  try {
    const url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?sort=-record_date&format=json&page[number]=1&page[size]=200';

    const res = await fetch(url);
    if (!res.ok) {
      return new Response('Fetch for treasury auction data failed', { status: 500 });
    }

    const { data } = await res.json();

    // Filter and map relevant fields using correct field names
    const parsed = data.map((item: any) => ({
      // Use issue_date as the settlement date (or record_date if preferred)
      settlementDate: item.issue_date || item.record_date,
      // Use offering_amt as the auction amount
      auctionAmount: Number(item.offering_amt) || 0,
      securityType: item.security_type,
      maturityDate: item.maturity_date,
      issueDate: item.issue_date,
      cusip: item.cusip,
      auctionDate: item.auction_date
    }));

    console.log('Sample parsed item:', parsed[0]);

    // Group by settlementDate using native JavaScript
    const grouped = parsed.reduce((acc: any, item:any) => {
      const date = item.settlementDate;
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += item.auctionAmount;
      return acc;
    }, {});

    console.log('Grouped data:', grouped);

    // Convert to array and sort
    const sortedEntries = Object.entries(grouped)
      .map(([settlementDate, total_outflow]) => ({
        settlementDate,
        total_outflow: total_outflow as number
      }))
      .sort((a, b) => a.settlementDate.localeCompare(b.settlementDate));

    console.log('Sorted entries:', sortedEntries);

    // Calculate percentage change
    const output = sortedEntries.map((item, index) => {
      let pct_change = 0;
      if (index > 0) {
        const previous = sortedEntries[index - 1].total_outflow;
        if (previous !== 0) {
          pct_change = parseFloat((((item.total_outflow - previous) / previous) * 100).toFixed(2));
        }
      }
      return {
        ...item,
        pct_change
      };
    });

    console.log('Final output:', output);

    return json({ output });

  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(`Internal server error: ${errorMessage}`, { status: 500 });
  }
};