"""
Main Runner for Liquidity-Market ML Analysis
Complete pipeline from data fetching to predictive modeling
"""

import sys
import os
from datetime import datetime
import pandas as pd
import numpy as np

# Assuming the modules are in the same directory
# from liquidity_fetcher import LiquidityDataFetcher
# from liquidity_ml_analyzer import LiquidityMLAnalyzer
# from advanced_liquidity_analysis import AdvancedLiquidityAnalysis

def run_full_analysis(base_url: str = "http://localhost:5173", symbols: list = None):
    """
    Run complete liquidity analysis pipeline
    
    Args:
        base_url: Base URL for your SvelteKit API
        symbols: List of market symbols to analyze (default: ['SPX', 'BTC'])
    """
    
    if symbols is None:
        symbols = ['SPX', 'BTC']
    
    print("="*80)
    print("LIQUIDITY FLOW ENGINE - ML ANALYSIS PIPELINE")
    print("="*80)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Step 1: Data Collection
    print("STEP 1: Fetching Data from APIs...")
    print("-" * 40)
    
    try:
        from liquidity_fetcher import LiquidityDataFetcher
        fetcher = LiquidityDataFetcher(base_url)
        
        # Fetch liquidity data
        print("  ✓ Fetching liquidity data (TGA, RRP, WALCL, SOMA, Auctions)...")
        liquidity_data = fetcher.fetch_liquidity_data()
        print(f"    - Liquidity data points: {len(liquidity_data)}")
        
        # Fetch market data
        print("  ✓ Fetching market data...")
        market_data = fetcher.fetch_all_markets()
        print(f"    - Market data points: {len(market_data)}")
        
        # Merge datasets
        print("  ✓ Merging datasets...")
        merged_data = fetcher.merge_liquidity_and_markets(liquidity_data, market_data)
        print(f"    - Merged dataset size: {len(merged_data)} rows x {len(merged_data.columns)} cols")
        
        # Save raw data
        merged_data.to_csv('liquidity_market_data.csv', index=False)
        print("  ✓ Data saved to: liquidity_market_data.csv\n")
        
    except Exception as e:
        print(f"  ✗ Error in data fetching: {e}")
        print("  Using existing data file if available...\n")
        try:
            merged_data = pd.read_csv('liquidity_market_data.csv')
            merged_data['date'] = pd.to_datetime(merged_data['date'])
        except:
            print("  ✗ No existing data found. Exiting.")
            return
    
    # Step 2: Correlation Analysis
    print("STEP 2: Enhanced Correlation Analysis...")
    print("-" * 40)
    
    try:
        # Import the enhanced analyzer
        import sys
        sys.path.insert(0, '.')
        from enhanced_correlation_analysis import EnhancedCorrelationAnalysis
        
        enhanced = EnhancedCorrelationAnalysis(merged_data)
        
        # Generate comprehensive report
        report = enhanced.generate_comprehensive_report()
        print(report)
        
        # Save report
        with open('enhanced_correlation_report.txt', 'w') as f:
            f.write(report)
        print("\n  ✓ Enhanced report saved to: enhanced_correlation_report.txt")
        
        # Create visualizations
        enhanced.visualize_results()
        
        # Save detailed CSVs
        lagged = enhanced.analyze_lagged_correlations()
        if not lagged.empty:
            lagged.to_csv('lagged_correlations.csv', index=False)
            print("  ✓ Saved: lagged_correlations.csv")
        
        regime_results = enhanced.analyze_regime_correlations()
        for regime, df in regime_results.items():
            df.to_csv(f'correlations_{regime.lower()}_market.csv', index=False)
            print(f"  ✓ Saved: correlations_{regime.lower()}_market.csv")
        
        timeframe_results = enhanced.analyze_multiple_timeframes()
        for period, df in timeframe_results.items():
            period_name = period.replace('_', '')
            df.to_csv(f'correlations_{period_name}.csv', index=False)
            print(f"  ✓ Saved: correlations_{period_name}.csv")
        
    except Exception as e:
        print(f"  ✗ Error in enhanced correlation analysis: {e}")
        # Fallback to basic analysis
        from liquidity_ml_analyzer import LiquidityMLAnalyzer
        analyzer = LiquidityMLAnalyzer(merged_data)
        corr_report = analyzer.analyze_correlations()
        print("  Top 10 Correlations with Weekly Returns:")
        print(corr_report.head(10).to_string(index=False))
        corr_report.to_csv('correlation_analysis.csv', index=False)
        print("  ✓ Saved to: correlation_analysis.csv\n")
    
    # Step 3: ML Model Training
    print("STEP 3: Training Predictive Models...")
    print("-" * 40)
    
    model_results = {}
    for symbol in symbols:
        print(f"\n  Training model for {symbol}...")
        try:
            results = analyzer.train_model(symbol, model_type='rf')
            model_results[symbol] = results
            
            print(f"    - Accuracy: {results['accuracy']:.4f}")
            print(f"    - Top 5 Features:")
            for idx, row in results['feature_importance'].head(5).iterrows():
                print(f"      {idx+1}. {row['feature']}: {row['importance']:.4f}")
            
            # Save feature importance
            results['feature_importance'].to_csv(
                f'{symbol}_feature_importance.csv', index=False
            )
            
        except Exception as e:
            print(f"    ✗ Error training {symbol}: {e}")
    
    # Step 4: Backtesting
    print("\nSTEP 4: Running Backtests...")
    print("-" * 40)
    
    for symbol in symbols:
        if symbol in model_results:
            print(f"\n  Backtesting {symbol}...")
            try:
                backtest_df = analyzer.backtest_strategy(symbol)
                
                # Calculate metrics
                total_return = (backtest_df['cumulative_return'].iloc[-1] - 1) * 100
                strategy_return = (backtest_df['cumulative_strategy'].iloc[-1] - 1) * 100
                
                print(f"    - Buy & Hold Return: {total_return:.2f}%")
                print(f"    - Strategy Return: {strategy_return:.2f}%")
                print(f"    - Alpha: {strategy_return - total_return:.2f}%")
                
                # Save backtest results
                backtest_df.to_csv(f'{symbol}_backtest.csv', index=False)
                
                # Generate plots
                analyzer.plot_results(backtest_df, symbol)
                print(f"    ✓ Results saved to: {symbol}_backtest.csv")
                print(f"    ✓ Chart saved to: {symbol}_backtest_results.png")
                
            except Exception as e:
                print(f"    ✗ Error in backtest: {e}")
    
    # Step 5: Advanced Analysis
    print("\nSTEP 5: Advanced Statistical Analysis...")
    print("-" * 40)
    
    try:
        from advanced_liquidity_analysis import AdvancedLiquidityAnalysis
        advanced = AdvancedLiquidityAnalysis(merged_data)
        
        # Generate comprehensive report
        report = advanced.generate_report('SPX')
        print(report)
        
        # Save report
        with open('liquidity_analysis_report.txt', 'w') as f:
            f.write(report)
        print("\n  ✓ Full report saved to: liquidity_analysis_report.txt")
        
        # Generate visualizations
        advanced.visualize_key_findings()
        print("  ✓ Visualizations saved to: comprehensive_liquidity_analysis.png")
        
    except Exception as e:
        print(f"  ✗ Error in advanced analysis: {e}")
    
    # Summary
    print("\n" + "="*80)
    print("ANALYSIS COMPLETE")
    print("="*80)
    print("\nGenerated Files:")
    print("  1. liquidity_market_data.csv - Raw merged dataset")
    print("  2. correlation_analysis.csv - Correlation analysis")
    print("  3. *_feature_importance.csv - ML feature rankings")
    print("  4. *_backtest.csv - Backtest results")
    print("  5. *_backtest_results.png - Performance charts")
    print("  6. liquidity_analysis_report.txt - Comprehensive report")
    print("  7. comprehensive_liquidity_analysis.png - Advanced visualizations")
    print(f"\nFinished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)

def quick_analysis(data_file: str = 'liquidity_market_data.csv'):
    """Quick analysis using existing data"""
    
    print("Running quick analysis on existing data...")
    
    df = pd.read_csv(data_file)
    df['date'] = pd.to_datetime(df['date'])
    
    from liquidity_ml_analyzer import LiquidityMLAnalyzer
    analyzer = LiquidityMLAnalyzer(df)
    
    # Quick correlation check
    corr = analyzer.analyze_correlations()
    print("\nTop 5 Correlations:")
    print(corr.head(5))
    
    # Quick model
    results = analyzer.train_model('SPX')
    print(f"\nModel Accuracy: {results['accuracy']:.4f}")
    print("\nTop 5 Features:")
    print(results['feature_importance'].head(5))

if __name__ == "__main__":
    # Parse command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == 'quick':
            quick_analysis()
        elif sys.argv[1] == 'full':
            symbols = ['SPX', 'DJIA', 'NASDAQ', 'RUSSELL', 'BTC']
            run_full_analysis(symbols=symbols)
        else:
            print("Usage:")
            print("  python main_runner.py full    # Full analysis with all markets")
            print("  python main_runner.py quick   # Quick analysis with existing data")
            print("\nMake sure your SvelteKit server is running on http://localhost:5173")
    else:
        # Default: run full analysis with SPX and BTC
        print("Starting analysis...")
        print("Make sure your SvelteKit server is running: npm run dev")
        print()
        run_full_analysis(symbols=['SPX', 'BTC'])