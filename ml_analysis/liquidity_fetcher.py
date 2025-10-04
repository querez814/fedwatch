import requests
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import numpy as np

class LiquidityDataFetcher:
    """Fetch liquidity and market data from SvelteKit API"""
    
    def __init__(self, base_url: str = "http://localhost:5173"):
        self.base_url = base_url
        
    def fetch_liquidity_data(self) -> pd.DataFrame:
        """Fetch all liquidity metrics"""
        endpoints = {
            'tga': '/api/tga-all',
            'rrp': '/api/rrp-all',
            'walcl': '/api/walcl-all',
            'soma': '/api/soma-all',
            'soma_treasuries': '/api/soma-treasuries-all',
            'soma_mbs': '/api/soma-mbs-all',
            'auctions': '/api/auctions'
        }
        
        dfs = []
        for name, endpoint in endpoints.items():
            try:
                print(f"  → Fetching {name} from {self.base_url}{endpoint}")
                response = requests.get(f"{self.base_url}{endpoint}")
                response.raise_for_status()
                data = response.json()
                
                # Handle different response structures
                if 'output' in data:
                    df = pd.DataFrame(data['output'])
                else:
                    df = pd.DataFrame(data)
                
                # Skip if empty
                if df.empty:
                    print(f"    ⚠ {name} returned empty data")
                    continue
                
                print(f"    ✓ Got {len(df)} rows for {name}")
                
                # Standardize column names
                if 'settlementDate' in df.columns:
                    df.rename(columns={'settlementDate': 'date'}, inplace=True)
                if 'total_outflow' in df.columns:
                    df.rename(columns={'total_outflow': 'value'}, inplace=True)
                
                # Convert to datetime first
                df['date'] = pd.to_datetime(df['date'], errors='coerce')
                
                # Drop rows where date is NaT
                df = df.dropna(subset=['date'])
                
                # Handle value column - convert to float, null becomes NaN
                if 'value' in df.columns:
                    df['value'] = pd.to_numeric(df['value'], errors='coerce')
                if 'pct_change' in df.columns:
                    df['pct_change'] = pd.to_numeric(df['pct_change'], errors='coerce')
                
                # Rename with prefix
                df = df.rename(columns={
                    'value': f'{name}_value',
                    'pct_change': f'{name}_pct_change'
                })
                
                # Only keep rows with valid values
                df = df.dropna(subset=[f'{name}_value'])
                
                dfs.append(df[['date', f'{name}_value', f'{name}_pct_change']])
                
            except Exception as e:
                print(f"    ✗ Error fetching {name}: {e}")
                continue
        
        # Merge all dataframes on date
        if dfs:
            result = dfs[0]
            for df in dfs[1:]:
                result = pd.merge(result, df, on='date', how='outer')
            result = result.sort_values('date').reset_index(drop=True)
            
            # Calculate net liquidity: WALCL - TGA - RRP
            if all(col in result.columns for col in ['walcl_value', 'tga_value', 'rrp_value']):
                # Only calculate where all three exist
                mask = result['walcl_value'].notna() & result['tga_value'].notna() & result['rrp_value'].notna()
                result.loc[mask, 'net_liquidity'] = (
                    result.loc[mask, 'walcl_value'] - 
                    result.loc[mask, 'tga_value'] - 
                    result.loc[mask, 'rrp_value']
                )
                result['net_liquidity_pct_change'] = result['net_liquidity'].pct_change(fill_method=None) * 100
            
            print(f"  Final liquidity dataset: {len(result)} rows, {len(result.columns)} columns")
            return result
        
        return pd.DataFrame()
    
    def fetch_market_data(self, symbol: str, preset: str = "MAX") -> pd.DataFrame:
        """Fetch market price data"""
        symbol_map = {
            'SPX': '/api/indicies/spx',
            'DJIA': '/api/indicies/djia',
            'NASDAQ': '/api/indicies/ndaq',
            'RUSSELL': '/api/indicies/russell',
            'BTC': '/api/crypto/btc'
        }
        
        endpoint = symbol_map.get(symbol.upper())
        if not endpoint:
            raise ValueError(f"Unknown symbol: {symbol}")
        
        try:
            print(f"  → Fetching {symbol} from {self.base_url}{endpoint}")
            response = requests.get(
                f"{self.base_url}{endpoint}",
                params={'preset': preset}
            )
            response.raise_for_status()
            data = response.json()
            
            df = pd.DataFrame(data['quotes'])
            df['date'] = pd.to_datetime(df['date'])
            df['symbol'] = symbol
            
            # Calculate returns
            df['daily_return'] = df['close'].pct_change() * 100
            df['weekly_return'] = df['close'].pct_change(5) * 100
            
            print(f"    ✓ Got {len(df)} rows for {symbol}")
            
            return df[['date', 'symbol', 'open', 'high', 'low', 'close', 
                      'volume', 'daily_return', 'weekly_return']]
            
        except Exception as e:
            print(f"    ✗ Error fetching {symbol}: {e}")
            return pd.DataFrame()
    
    def fetch_all_markets(self) -> pd.DataFrame:
        """Fetch all market data"""
        markets = ['SPX', 'DJIA', 'NASDAQ', 'RUSSELL', 'BTC']
        dfs = []
        
        for market in markets:
            df = self.fetch_market_data(market)
            if not df.empty:
                dfs.append(df)
        
        if dfs:
            return pd.concat(dfs, ignore_index=True)
        return pd.DataFrame()
    
    def merge_liquidity_and_markets(self, liquidity_df: pd.DataFrame, 
                                     market_df: pd.DataFrame) -> pd.DataFrame:
        """Merge liquidity data with market data"""
        print(f"  Merging: {len(liquidity_df)} liquidity rows with {len(market_df)} market rows")
        
        # Ensure both dates are timezone-naive for merging
        liquidity_df['date'] = pd.to_datetime(liquidity_df['date']).dt.tz_localize(None)
        market_df['date'] = pd.to_datetime(market_df['date']).dt.tz_localize(None)
        
        # Merge on date - use 'left' to keep all market data
        merged = pd.merge(market_df, liquidity_df, on='date', how='left')
        print(f"  After merge: {len(merged)} rows")
        
        # Get liquidity columns
        liquidity_cols = [col for col in merged.columns if any(
            x in col for x in ['tga_', 'rrp_', 'walcl_', 'soma_', 'auction', 'net_liquidity']
        )]
        
        print(f"  Forward filling {len(liquidity_cols)} liquidity columns...")
        
        # Forward fill AND backward fill liquidity data
        # This handles both leading and trailing NaN values
        for col in liquidity_cols:
            merged[col] = merged[col].ffill().bfill()
        
        # Only drop rows where we have no price data
        result = merged.dropna(subset=['close', 'symbol'])
        print(f"  After removing rows with missing price data: {len(result)} rows")
        
        # Fill any remaining NaN in returns with 0
        if 'daily_return' in result.columns:
            result['daily_return'] = result['daily_return'].fillna(0)
        if 'weekly_return' in result.columns:
            result['weekly_return'] = result['weekly_return'].fillna(0)
        
        return result

if __name__ == "__main__":
    # Example usage
    fetcher = LiquidityDataFetcher()
    
    print("Fetching liquidity data...")
    liquidity = fetcher.fetch_liquidity_data()
    print(f"Liquidity data shape: {liquidity.shape}")
    
    print("\nFetching market data...")
    markets = fetcher.fetch_all_markets()
    print(f"Market data shape: {markets.shape}")
    
    print("\nMerging datasets...")
    merged = fetcher.merge_liquidity_and_markets(liquidity, markets)
    print(f"Merged data shape: {merged.shape}")
    
    # Save to CSV
    merged.to_csv('liquidity_market_data.csv', index=False)
    print("\nData saved to liquidity_market_data.csv")