"""
Advanced Liquidity Analysis Pipeline
Comprehensive ML analysis of Fed liquidity data vs market performance
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from typing import Dict
import warnings
warnings.filterwarnings('ignore')

class AdvancedLiquidityAnalysis:
    
    def __init__(self, data: pd.DataFrame):
        self.data = data
        self.results = {}
        
    def regime_analysis(self) -> pd.DataFrame:
        """Identify liquidity regimes and their market impact"""
        df = self.data.copy()
        
        # Calculate regime indicators
        if 'net_liquidity' in df.columns:
            # Define liquidity regimes based on percentiles
            df['liq_regime'] = pd.qcut(
                df['net_liquidity'], 
                q=4, 
                labels=['Very_Tight', 'Tight', 'Loose', 'Very_Loose']
            )
            
            # Analyze returns by regime
            regime_analysis = df.groupby('liq_regime').agg({
                'weekly_return': ['mean', 'std', 'count'],
                'daily_return': ['mean', 'std'],
                'close': 'last'
            }).round(3)
            
            return regime_analysis
        
        return pd.DataFrame()
    
    def flow_dynamics_analysis(self) -> Dict:
        """Analyze the impact of liquidity flow directions"""
        df = self.data.copy()
        
        results = {}
        
        # TGA drainage analysis
        if 'tga_pct_change' in df.columns:
            df['tga_draining'] = df['tga_pct_change'] < -1  # More than 1% decline
            tga_impact = df.groupby('tga_draining')['weekly_return'].agg(['mean', 'std', 'count'])
            results['tga_drainage'] = tga_impact
        
        # RRP outflow analysis
        if 'rrp_pct_change' in df.columns:
            df['rrp_outflow'] = df['rrp_pct_change'] < -2  # More than 2% decline
            rrp_impact = df.groupby('rrp_outflow')['weekly_return'].agg(['mean', 'std', 'count'])
            results['rrp_outflow'] = rrp_impact
        
        # Fed balance sheet expansion/contraction
        if 'walcl_pct_change' in df.columns:
            df['fed_expanding'] = df['walcl_pct_change'] > 0
            fed_impact = df.groupby('fed_expanding')['weekly_return'].agg(['mean', 'std', 'count'])
            results['fed_expansion'] = fed_impact
        
        # Combined "double injection" scenario
        if 'tga_draining' in df.columns and 'rrp_outflow' in df.columns:
            df['double_injection'] = df['tga_draining'] & df['rrp_outflow']
            double_impact = df.groupby('double_injection')['weekly_return'].agg(['mean', 'std', 'count'])
            results['double_injection'] = double_impact
        
        return results
    
    def auction_impact_analysis(self) -> pd.DataFrame:
        """Analyze Treasury auction impact on markets"""
        df = self.data.copy()
        
        if 'auctions_pct_change' in df.columns:
            # Categorize auction activity
            df['auction_category'] = pd.cut(
                df['auctions_pct_change'],
                bins=[-np.inf, -10, 10, np.inf],
                labels=['Light', 'Normal', 'Heavy']
            )
            
            auction_impact = df.groupby('auction_category').agg({
                'weekly_return': ['mean', 'std', 'count'],
                'daily_return': ['mean', 'std'],
                'auctions_value': 'mean'
            }).round(3)
            
            return auction_impact
        
        return pd.DataFrame()
    
    def predictive_model_comparison(self, symbol: str = 'SPX') -> pd.DataFrame:
        """Compare multiple ML models"""
        from sklearn.model_selection import train_test_split
        from sklearn.preprocessing import StandardScaler
        
        # Prepare data
        df = self.data[self.data['symbol'] == symbol].copy() if 'symbol' in self.data.columns else self.data.copy()
        
        # Feature engineering
        feature_cols = [col for col in df.columns if any(
            x in col for x in ['tga_', 'rrp_', 'walcl_', 'soma_', 'auction', 'net_liq']
        )]
        
        df_clean = df[feature_cols + ['weekly_return']].dropna()
        X = df_clean[feature_cols].values
        y = (df_clean['weekly_return'] > 0).astype(int).values
        
        # Train-test split
        split_idx = int(len(X) * 0.7)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        # Scale
        scaler = StandardScaler()
        X_train = scaler.fit_transform(X_train)
        X_test = scaler.transform(X_test)
        
        # Models
        models = {
            'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42),
            'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
            'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42)
        }
        
        results = []
        for name, model in models.items():
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            
            results.append({
                'Model': name,
                'Accuracy': accuracy_score(y_test, y_pred),
                'Precision': precision_score(y_test, y_pred),
                'Recall': recall_score(y_test, y_pred),
                'F1-Score': f1_score(y_test, y_pred)
            })
        
        return pd.DataFrame(results).round(4)
    
    def statistical_tests(self) -> Dict:
        """Perform statistical tests on liquidity-market relationships"""
        df = self.data.copy()
        tests = {}
        
        # T-test: Returns during high vs low net liquidity
        if 'net_liquidity' in df.columns and 'weekly_return' in df.columns:
            median_liq = df['net_liquidity'].median()
            high_liq_returns = df[df['net_liquidity'] > median_liq]['weekly_return'].dropna()
            low_liq_returns = df[df['net_liquidity'] <= median_liq]['weekly_return'].dropna()
            
            t_stat, p_value = stats.ttest_ind(high_liq_returns, low_liq_returns)
            tests['high_vs_low_liquidity'] = {
                't_statistic': t_stat,
                'p_value': p_value,
                'high_liq_mean': high_liq_returns.mean(),
                'low_liq_mean': low_liq_returns.mean()
            }
        
        # Correlation significance tests
        if 'net_liquidity_pct_change' in df.columns and 'weekly_return' in df.columns:
            corr, p_value = stats.pearsonr(
                df['net_liquidity_pct_change'].dropna(),
                df.loc[df['net_liquidity_pct_change'].notna(), 'weekly_return']
            )
            tests['net_liq_change_correlation'] = {
                'correlation': corr,
                'p_value': p_value,
                'significant': p_value < 0.05
            }
        
        return tests
    
    def generate_report(self, symbol: str = 'SPX') -> str:
        """Generate comprehensive analysis report"""
        report = []
        report.append("="*80)
        report.append(f"LIQUIDITY FLOW ANALYSIS REPORT - {symbol}")
        report.append("="*80)
        report.append("")
        
        # Regime Analysis
        regime_results = self.regime_analysis()
        if not regime_results.empty:
            report.append("1. LIQUIDITY REGIME ANALYSIS")
            report.append("-" * 40)
            report.append(regime_results.to_string())
            report.append("")
        
        # Flow Dynamics
        flow_results = self.flow_dynamics_analysis()
        if flow_results:
            report.append("2. FLOW DYNAMICS IMPACT")
            report.append("-" * 40)
            for key, value in flow_results.items():
                report.append(f"\n{key.upper()}:")
                report.append(value.to_string())
            report.append("")
        
        # Auction Impact
        auction_results = self.auction_impact_analysis()
        if not auction_results.empty:
            report.append("3. TREASURY AUCTION IMPACT")
            report.append("-" * 40)
            report.append(auction_results.to_string())
            report.append("")
        
        # Model Comparison
        model_results = self.predictive_model_comparison(symbol)
        if not model_results.empty:
            report.append("4. PREDICTIVE MODEL COMPARISON")
            report.append("-" * 40)
            report.append(model_results.to_string(index=False))
            report.append("")
        
        # Statistical Tests
        stat_results = self.statistical_tests()
        if stat_results:
            report.append("5. STATISTICAL SIGNIFICANCE TESTS")
            report.append("-" * 40)
            for key, value in stat_results.items():
                report.append(f"\n{key}:")
                for k, v in value.items():
                    report.append(f"  {k}: {v}")
            report.append("")
        
        report.append("="*80)
        
        return "\n".join(report)
    
    def visualize_key_findings(self):
        """Create comprehensive visualization"""
        fig = plt.figure(figsize=(20, 12))
        gs = fig.add_gridspec(3, 3, hspace=0.3, wspace=0.3)
        
        df = self.data.copy()
        
        # 1. Net Liquidity vs Returns Scatter
        ax1 = fig.add_subplot(gs[0, 0])
        if 'net_liquidity' in df.columns and 'weekly_return' in df.columns:
            ax1.scatter(df['net_liquidity']/1e12, df['weekly_return'], alpha=0.5)
            ax1.set_xlabel('Net Liquidity (Trillions)')
            ax1.set_ylabel('Weekly Return (%)')
            ax1.set_title('Net Liquidity vs Weekly Returns')
            ax1.grid(True, alpha=0.3)
        
        # 2. Correlation Heatmap
        ax2 = fig.add_subplot(gs[0, 1:])
        liquidity_cols = ['tga_pct_change', 'rrp_pct_change', 'walcl_pct_change', 
                         'net_liquidity_pct_change', 'auctions_pct_change']
        liquidity_cols = [col for col in liquidity_cols if col in df.columns]
        if liquidity_cols and 'weekly_return' in df.columns:
            corr_df = df[liquidity_cols + ['weekly_return']].corr()
            sns.heatmap(corr_df, annot=True, fmt='.3f', cmap='RdYlGn', center=0, ax=ax2)
            ax2.set_title('Correlation Matrix')
        
        # 3. Regime Returns
        ax3 = fig.add_subplot(gs[1, 0])
        regime_data = self.regime_analysis()
        if not regime_data.empty:
            regime_data['weekly_return']['mean'].plot(kind='bar', ax=ax3, color='skyblue')
            ax3.set_title('Average Returns by Liquidity Regime')
            ax3.set_ylabel('Weekly Return (%)')
            ax3.tick_params(axis='x', rotation=45)
        
        # 4. Time Series of Net Liquidity
        ax4 = fig.add_subplot(gs[1, 1:])
        if 'date' in df.columns and 'net_liquidity' in df.columns:
            ax4.plot(df['date'], df['net_liquidity']/1e12, linewidth=2, color='purple')
            ax4.set_title('Net Liquidity Over Time')
            ax4.set_ylabel('Trillions USD')
            ax4.grid(True, alpha=0.3)
        
        # 5. Flow Impact
        ax5 = fig.add_subplot(gs[2, :])
        flow_results = self.flow_dynamics_analysis()
        if 'double_injection' in flow_results:
            flow_data = flow_results['double_injection']['mean']
            flow_data.plot(kind='bar', ax=ax5, color=['red', 'green'])
            ax5.set_title('Weekly Returns: Double Injection vs Normal Conditions')
            ax5.set_ylabel('Average Weekly Return (%)')
            ax5.set_xticklabels(['Normal', 'Double Injection'], rotation=0)
        
        plt.savefig('comprehensive_liquidity_analysis.png', dpi=300, bbox_inches='tight')
        plt.show()

# Main execution
if __name__ == "__main__":
    # Load data
    df = pd.read_csv('liquidity_market_data.csv')
    df['date'] = pd.to_datetime(df['date'])
    
    # Run analysis
    analyzer = AdvancedLiquidityAnalysis(df)
    
    # Generate report
    report = analyzer.generate_report('SPX')
    print(report)
    
    # Save report
    with open('liquidity_analysis_report.txt', 'w') as f:
        f.write(report)
    
    # Create visualizations
    analyzer.visualize_key_findings()
    
    print("\nAnalysis complete! Check:")
    print("- liquidity_analysis_report.txt")
    print("- comprehensive_liquidity_analysis.png")