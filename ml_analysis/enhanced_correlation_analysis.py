"""
Enhanced Correlation Analysis with Lags, Regimes, and Multiple Timeframes
"""

import pandas as pd
import numpy as np
from scipy import stats
import matplotlib.pyplot as plt
import seaborn as sns

class EnhancedCorrelationAnalysis:
    
    def __init__(self, data: pd.DataFrame):
        self.data = data.copy()
        self.results = {}
        
    def add_lag_features(self, weeks=[1, 2, 4]) -> pd.DataFrame:
        """Add lagged liquidity features"""
        df = self.data.copy()
        
        liquidity_cols = [col for col in df.columns if any(
            x in col for x in ['tga_', 'rrp_', 'walcl_', 'soma_', 'auction', 'net_liquidity']
        ) and 'pct_change' not in col]
        
        print(f"  Adding lag features for {len(liquidity_cols)} metrics...")
        
        for col in liquidity_cols:
            for lag in weeks:
                df[f'{col}_lag_{lag}w'] = df[col].shift(lag * 5)  # 5 days = 1 week
        
        return df
    
    def add_velocity_features(self) -> pd.DataFrame:
        """Add rate of change (velocity) features"""
        df = self.data.copy()
        
        liquidity_cols = [col for col in df.columns if any(
            x in col for x in ['tga_', 'rrp_', 'walcl_', 'net_liquidity']
        ) and 'pct_change' not in col and 'lag' not in col]
        
        print(f"  Adding velocity features for {len(liquidity_cols)} metrics...")
        
        for col in liquidity_cols:
            # 1-week velocity
            df[f'{col}_velocity_1w'] = df[col].pct_change(5) * 100
            # 2-week velocity
            df[f'{col}_velocity_2w'] = df[col].pct_change(10) * 100
            # 1-month velocity
            df[f'{col}_velocity_1m'] = df[col].pct_change(20) * 100
        
        return df
    
    def add_multiple_return_periods(self) -> pd.DataFrame:
        """Add different return timeframes"""
        df = self.data.copy()
        
        if 'close' in df.columns:
            print("  Adding multiple return periods...")
            # 2-week returns
            df['return_2w'] = df['close'].pct_change(10) * 100
            # 1-month returns
            df['return_1m'] = df['close'].pct_change(20) * 100
            # 3-month returns
            df['return_3m'] = df['close'].pct_change(60) * 100
        
        return df
    
    def identify_market_regime(self) -> pd.DataFrame:
        """Identify bull vs bear market regimes"""
        df = self.data.copy()
        
        if 'close' in df.columns:
            print("  Identifying market regimes...")
            # Use 200-day SMA for regime
            df['sma_200'] = df['close'].rolling(200).mean()
            df['regime'] = np.where(df['close'] > df['sma_200'], 'BULL', 'BEAR')
            
            # Also add momentum regime
            df['momentum_50'] = df['close'].pct_change(50) * 100
            df['regime_momentum'] = pd.cut(
                df['momentum_50'], 
                bins=[-np.inf, -10, 10, np.inf],
                labels=['BEAR', 'NEUTRAL', 'BULL']
            )
        
        return df
    
    def analyze_lagged_correlations(self, target='weekly_return') -> pd.DataFrame:
        """Analyze correlations with lagged features"""
        df = self.add_lag_features()
        df = self.add_velocity_features()
        
        # Get all feature columns
        feature_cols = [col for col in df.columns if any(
            x in col for x in ['tga_', 'rrp_', 'walcl_', 'net_liquidity', '_velocity_', '_lag_']
        ) and col != target]
        
        if target not in df.columns:
            print(f"  ⚠ Target '{target}' not found!")
            return pd.DataFrame()
        
        print(f"  Analyzing {len(feature_cols)} lagged/velocity features...")
        
        correlations = {}
        for col in feature_cols:
            temp_df = df[[col, target]].dropna()
            if len(temp_df) > 30:
                corr = temp_df[col].corr(temp_df[target])
                if not np.isnan(corr):
                    correlations[col] = corr
        
        if len(correlations) == 0:
            return pd.DataFrame()
        
        report = pd.DataFrame({
            'Feature': list(correlations.keys()),
            'Correlation': list(correlations.values())
        })
        report['Abs_Correlation'] = report['Correlation'].abs()
        report = report.sort_values('Abs_Correlation', ascending=False)
        
        return report
    
    def analyze_regime_correlations(self) -> dict:
        """Analyze correlations separately for bull and bear markets"""
        df = self.identify_market_regime()
        df = self.add_velocity_features()
        
        if 'regime' not in df.columns or 'weekly_return' not in df.columns:
            print("  ⚠ Cannot perform regime analysis")
            return {}
        
        feature_cols = [col for col in df.columns if any(
            x in col for x in ['tga_', 'rrp_', 'walcl_', 'net_liquidity', '_velocity_']
        ) and 'pct_change' not in col and 'lag' not in col]
        
        results = {}
        
        for regime in ['BULL', 'BEAR']:
            regime_df = df[df['regime'] == regime].copy()
            print(f"  Analyzing {regime} market ({len(regime_df)} rows)...")
            
            correlations = {}
            for col in feature_cols:
                temp_df = regime_df[[col, 'weekly_return']].dropna()
                if len(temp_df) > 20:
                    corr = temp_df[col].corr(temp_df['weekly_return'])
                    if not np.isnan(corr):
                        correlations[col] = corr
            
            if correlations:
                results[regime] = pd.DataFrame({
                    'Feature': list(correlations.keys()),
                    'Correlation': list(correlations.values())
                })
                results[regime]['Abs_Correlation'] = results[regime]['Correlation'].abs()
                results[regime] = results[regime].sort_values('Abs_Correlation', ascending=False)
        
        return results
    
    def analyze_multiple_timeframes(self) -> dict:
        """Analyze correlations across different return periods"""
        df = self.add_multiple_return_periods()
        df = self.add_velocity_features()
        
        feature_cols = [col for col in df.columns if any(
            x in col for x in ['tga_', 'rrp_', 'walcl_', 'net_liquidity', '_velocity_']
        ) and 'pct_change' not in col and 'lag' not in col]
        
        return_cols = ['weekly_return', 'return_2w', 'return_1m', 'return_3m']
        return_cols = [col for col in return_cols if col in df.columns]
        
        results = {}
        
        for ret_col in return_cols:
            print(f"  Analyzing correlations with {ret_col}...")
            
            correlations = {}
            for col in feature_cols:
                temp_df = df[[col, ret_col]].dropna()
                if len(temp_df) > 30:
                    corr = temp_df[col].corr(temp_df[ret_col])
                    if not np.isnan(corr):
                        correlations[col] = corr
            
            if correlations:
                results[ret_col] = pd.DataFrame({
                    'Feature': list(correlations.keys()),
                    'Correlation': list(correlations.values())
                })
                results[ret_col]['Abs_Correlation'] = results[ret_col]['Correlation'].abs()
                results[ret_col] = results[ret_col].sort_values('Abs_Correlation', ascending=False)
        
        return results
    
    def generate_comprehensive_report(self) -> str:
        """Generate comprehensive analysis report"""
        report = []
        report.append("="*80)
        report.append("ENHANCED LIQUIDITY CORRELATION ANALYSIS")
        report.append("="*80)
        report.append("")
        
        # 1. Lagged correlations
        report.append("1. LAGGED CORRELATIONS (Liquidity → Future Returns)")
        report.append("-"*80)
        lagged = self.analyze_lagged_correlations()
        if not lagged.empty:
            report.append("\nTop 10 Lagged Features:")
            report.append(lagged.head(10).to_string(index=False))
        report.append("\n")
        
        # 2. Regime analysis
        report.append("2. REGIME-BASED CORRELATIONS (Bull vs Bear Markets)")
        report.append("-"*80)
        regime_results = self.analyze_regime_correlations()
        for regime, df in regime_results.items():
            report.append(f"\n{regime} MARKET - Top 5:")
            report.append(df.head(5).to_string(index=False))
        report.append("\n")
        
        # 3. Multiple timeframes
        report.append("3. MULTI-TIMEFRAME CORRELATIONS")
        report.append("-"*80)
        timeframe_results = self.analyze_multiple_timeframes()
        for period, df in timeframe_results.items():
            report.append(f"\n{period.upper()} - Top 5:")
            report.append(df.head(5).to_string(index=False))
        report.append("\n")
        
        # 4. Key insights
        report.append("4. KEY INSIGHTS")
        report.append("-"*80)
        
        # Find best predictors
        if not lagged.empty:
            best = lagged.iloc[0]
            report.append(f"\n✓ Best lagged predictor: {best['Feature']}")
            report.append(f"  Correlation: {best['Correlation']:.3f}")
        
        # Compare regimes
        if len(regime_results) == 2:
            report.append("\n✓ Regime differences:")
            for feat in ['net_liquidity', 'tga_value', 'rrp_value']:
                bull_corr = regime_results['BULL'][regime_results['BULL']['Feature'].str.contains(feat, na=False)]
                bear_corr = regime_results['BEAR'][regime_results['BEAR']['Feature'].str.contains(feat, na=False)]
                if not bull_corr.empty and not bear_corr.empty:
                    report.append(f"  {feat}:")
                    report.append(f"    Bull market: {bull_corr.iloc[0]['Correlation']:.3f}")
                    report.append(f"    Bear market: {bear_corr.iloc[0]['Correlation']:.3f}")
        
        report.append("\n" + "="*80)
        
        return "\n".join(report)
    
    def visualize_results(self):
        """Create comprehensive visualizations"""
        fig = plt.figure(figsize=(20, 12))
        gs = fig.add_gridspec(3, 2, hspace=0.3, wspace=0.3)
        
        # 1. Lagged correlations heatmap
        ax1 = fig.add_subplot(gs[0, :])
        lagged = self.analyze_lagged_correlations()
        if not lagged.empty:
            top_features = lagged.head(15)
            colors = ['green' if x > 0 else 'red' for x in top_features['Correlation']]
            ax1.barh(range(len(top_features)), top_features['Correlation'], color=colors)
            ax1.set_yticks(range(len(top_features)))
            ax1.set_yticklabels(top_features['Feature'], fontsize=8)
            ax1.set_xlabel('Correlation')
            ax1.set_title('Top 15 Lagged/Velocity Features vs Weekly Returns', fontsize=14, fontweight='bold')
            ax1.axvline(0, color='black', linewidth=0.5)
        
        # 2. Regime comparison
        ax2 = fig.add_subplot(gs[1, 0])
        regime_results = self.analyze_regime_correlations()
        if len(regime_results) == 2:
            bull_top = regime_results['BULL'].head(10)
            bear_top = regime_results['BEAR'].head(10)
            
            x = np.arange(len(bull_top))
            width = 0.35
            ax2.barh(x - width/2, bull_top['Correlation'], width, label='Bull', color='green', alpha=0.7)
            ax2.barh(x + width/2, bear_top['Correlation'], width, label='Bear', color='red', alpha=0.7)
            ax2.set_yticks(x)
            ax2.set_yticklabels(bull_top['Feature'], fontsize=7)
            ax2.legend()
            ax2.set_title('Bull vs Bear Market Correlations', fontsize=12, fontweight='bold')
        
        # 3. Multiple timeframes
        ax3 = fig.add_subplot(gs[1, 1])
        timeframe_results = self.analyze_multiple_timeframes()
        if timeframe_results:
            # Compare net_liquidity across timeframes
            data_for_plot = []
            for period, df in timeframe_results.items():
                net_liq = df[df['Feature'].str.contains('net_liquidity', na=False)]
                if not net_liq.empty:
                    data_for_plot.append({
                        'period': period,
                        'correlation': net_liq.iloc[0]['Correlation']
                    })
            
            if data_for_plot:
                plot_df = pd.DataFrame(data_for_plot)
                colors = ['green' if x > 0 else 'red' for x in plot_df['correlation']]
                ax3.bar(plot_df['period'], plot_df['correlation'], color=colors)
                ax3.set_title('Net Liquidity Correlation Across Timeframes', fontsize=12, fontweight='bold')
                ax3.set_ylabel('Correlation')
                ax3.axhline(0, color='black', linewidth=0.5)
        
        # 4. Velocity vs Level comparison
        ax4 = fig.add_subplot(gs[2, :])
        df = self.add_velocity_features()
        
        # Compare TGA level vs velocity
        metrics_to_compare = [
            ('tga_value', 'TGA Level'),
            ('tga_value_velocity_1w', 'TGA 1w Velocity'),
            ('tga_value_velocity_2w', 'TGA 2w Velocity'),
            ('rrp_value', 'RRP Level'),
            ('rrp_value_velocity_1w', 'RRP 1w Velocity'),
            ('net_liquidity', 'Net Liq Level'),
            ('net_liquidity_velocity_1w', 'Net Liq 1w Velocity')
        ]
        
        correlations_list = []
        labels = []
        
        for col, label in metrics_to_compare:
            if col in df.columns and 'weekly_return' in df.columns:
                temp = df[[col, 'weekly_return']].dropna()
                if len(temp) > 30:
                    corr = temp[col].corr(temp['weekly_return'])
                    if not np.isnan(corr):
                        correlations_list.append(corr)
                        labels.append(label)
        
        if correlations_list:
            colors = ['green' if x > 0 else 'red' for x in correlations_list]
            ax4.barh(range(len(correlations_list)), correlations_list, color=colors)
            ax4.set_yticks(range(len(correlations_list)))
            ax4.set_yticklabels(labels)
            ax4.set_xlabel('Correlation')
            ax4.set_title('Level vs Velocity Correlations', fontsize=14, fontweight='bold')
            ax4.axvline(0, color='black', linewidth=0.5)
        
        plt.savefig('enhanced_correlation_analysis.png', dpi=300, bbox_inches='tight')
        print("\n  ✓ Visualization saved to: enhanced_correlation_analysis.png")
        plt.close()

# Main execution
if __name__ == "__main__":
    # Load data
    df = pd.read_csv('../data/liquidity_market_data.csv')
    df['date'] = pd.to_datetime(df['date'])
    
    # Run enhanced analysis
    analyzer = EnhancedCorrelationAnalysis(df)
    
    # Generate report
    report = analyzer.generate_comprehensive_report()
    print(report)
    
    # Save report
    with open('../data/enhanced_correlation_report.txt', 'w') as f:
        f.write(report)
    
    # Create visualizations
    analyzer.visualize_results()
    
    # Save detailed results
    print("\nSaving detailed results...")
    
    # Lagged correlations
    lagged = analyzer.analyze_lagged_correlations()
    if not lagged.empty:
        lagged.to_csv('../data/lagged_correlations.csv', index=False)
        print("  ✓ lagged_correlations.csv")
    
    # Regime correlations
    regime_results = analyzer.analyze_regime_correlations()
    for regime, df in regime_results.items():
        df.to_csv(f'../data/correlations_{regime.lower()}_market.csv', index=False)
        print(f"  ✓ correlations_{regime.lower()}_market.csv")
    
    # Timeframe correlations
    timeframe_results = analyzer.analyze_multiple_timeframes()
    for period, df in timeframe_results.items():
        period_name = period.replace('_', '')
        df.to_csv(f'../data/correlations_{period_name}.csv', index=False)
        print(f"  ✓ correlations_{period_name}.csv")
    
    print("\n✅ Enhanced analysis complete!")