import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, TimeSeriesSplit
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, Tuple, List
import warnings
warnings.filterwarnings('ignore')

class LiquidityMLAnalyzer:
    """Machine Learning analysis for liquidity-market correlations"""
    
    def __init__(self, data: pd.DataFrame):
        self.data = data.copy()
        self.scaler = StandardScaler()
        self.models = {}
        
    def engineer_features(self) -> pd.DataFrame:
        """Create advanced features from liquidity data"""
        df = self.data.copy()
        
        # Lag features (previous periods)
        lag_periods = [1, 5, 10, 20]
        liquidity_cols = ['net_liquidity', 'tga_value', 'rrp_value', 
                         'walcl_value', 'auctions_value']
        
        for col in liquidity_cols:
            if col in df.columns:
                for lag in lag_periods:
                    df[f'{col}_lag_{lag}'] = df[col].shift(lag)
        
        # Moving averages
        for col in liquidity_cols:
            if col in df.columns:
                df[f'{col}_ma_5'] = df[col].rolling(5).mean()
                df[f'{col}_ma_20'] = df[col].rolling(20).mean()
                df[f'{col}_ma_50'] = df[col].rolling(50).mean()
        
        # Momentum indicators
        if 'net_liquidity' in df.columns:
            df['net_liq_momentum'] = df['net_liquidity'].diff(5)
            df['net_liq_acceleration'] = df['net_liq_momentum'].diff(5)
        
        # Volatility measures
        if 'close' in df.columns:
            df['price_volatility_20'] = df['close'].rolling(20).std()
            df['price_volatility_50'] = df['close'].rolling(50).std()
        
        # Liquidity flow indicators
        if all(col in df.columns for col in ['tga_value', 'rrp_value']):
            df['tga_rrp_ratio'] = df['tga_value'] / (df['rrp_value'] + 1)
            df['liquidity_stress'] = (df['tga_value'] > df['tga_value'].quantile(0.8)).astype(int)
        
        # Rate of change features
        for col in liquidity_cols:
            if col in df.columns:
                df[f'{col}_roc_5'] = df[col].pct_change(5) * 100
                df[f'{col}_roc_20'] = df[col].pct_change(20) * 100
        
        # Target variable: weekly direction (up/down)
        if 'weekly_return' in df.columns:
            df['target_up'] = (df['weekly_return'] > 0).astype(int)
        elif 'close' in df.columns:
            df['weekly_return'] = df['close'].pct_change(5) * 100
            df['target_up'] = (df['weekly_return'] > 0).astype(int)
        
        return df.dropna()
    
    def analyze_correlations(self) -> pd.DataFrame:
        """Calculate correlations between liquidity metrics and returns"""
        df = self.data.copy()
        
        print(f"  Starting with {len(df)} rows")
        
        # Check what columns we have
        print(f"  Columns: {list(df.columns)}")
        
        # Get liquidity columns from the raw data
        liquidity_cols = [col for col in df.columns if any(
            x in col for x in ['tga_', 'rrp_', 'walcl_', 'soma_', 
                              'auction', 'net_liquidity']
        ) and 'pct_change' not in col]  # Exclude pct_change columns initially
        
        print(f"  Found {len(liquidity_cols)} liquidity columns")
        
        # Check if we have weekly_return
        if 'weekly_return' not in df.columns:
            print("  ⚠ No weekly_return column found!")
            print(f"  Available columns with 'return': {[c for c in df.columns if 'return' in c]}")
            return pd.DataFrame()
        
        # Check for NaN values
        print(f"  weekly_return NaN count: {df['weekly_return'].isna().sum()} / {len(df)}")
        
        for col in liquidity_cols[:3]:  # Check first 3
            print(f"  {col} NaN count: {df[col].isna().sum()} / {len(df)}")
        
        # Only keep rows where weekly_return is not NaN
        df_clean = df[df['weekly_return'].notna()].copy()
        print(f"  After removing NaN weekly_return: {len(df_clean)} rows")
        
        if len(df_clean) == 0:
            print("  ⚠ All weekly_return values are NaN!")
            return pd.DataFrame()
        
        # For each liquidity column, only use it if it has some valid values
        valid_liq_cols = []
        for col in liquidity_cols:
            non_nan = df_clean[col].notna().sum()
            if non_nan > 10:  # Need at least 10 valid values
                valid_liq_cols.append(col)
                print(f"  ✓ {col}: {non_nan} valid values")
            else:
                print(f"  ✗ {col}: only {non_nan} valid values, skipping")
        
        if len(valid_liq_cols) == 0:
            print("  ⚠ No liquidity columns have enough valid data!")
            return pd.DataFrame()
        
        # Calculate correlations for each valid column
        correlations = {}
        for col in valid_liq_cols:
            # Get rows where both this liquidity metric and weekly_return exist
            temp_df = df_clean[[col, 'weekly_return']].dropna()
            if len(temp_df) > 10:
                corr = temp_df[col].corr(temp_df['weekly_return'])
                if not np.isnan(corr):
                    correlations[col] = corr
        
        if len(correlations) == 0:
            print("  ⚠ Could not calculate any valid correlations")
            return pd.DataFrame()
        
        # Create report
        report = pd.DataFrame({
            'Feature': list(correlations.keys()),
            'Correlation': list(correlations.values())
        })
        report['Abs_Correlation'] = report['Correlation'].abs()
        report = report.sort_values('Abs_Correlation', ascending=False)
        
        print(f"  ✓ Calculated {len(report)} correlations")
        return report
    
    def prepare_ml_data(self, symbol: str = None) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare data for machine learning"""
        df = self.engineer_features()
        
        # Filter by symbol if specified
        if symbol and 'symbol' in df.columns:
            df = df[df['symbol'] == symbol].copy()
        
        # Select features
        feature_cols = [col for col in df.columns if any(
            x in col for x in ['tga_', 'rrp_', 'walcl_', 'soma_', 
                              'auction', 'net_liq', 'liq_', 'volatility']
        )]
        
        # Remove percentage change columns with NaN
        feature_cols = [col for col in feature_cols if df[col].notna().sum() > len(df) * 0.7]
        
        X = df[feature_cols].values
        y = df['target_up'].values
        
        # Remove any remaining NaN rows
        mask = ~np.isnan(X).any(axis=1) & ~np.isnan(y)
        X = X[mask]
        y = y[mask]
        
        return X, y, feature_cols
    
    def train_model(self, symbol: str = 'SPX', model_type: str = 'rf') -> Dict:
        """Train predictive model"""
        X, y, feature_cols = self.prepare_ml_data(symbol)
        
        # Time series split for validation
        tscv = TimeSeriesSplit(n_splits=5)
        
        # Initialize model
        if model_type == 'rf':
            model = RandomForestClassifier(
                n_estimators=200,
                max_depth=10,
                min_samples_split=50,
                random_state=42,
                n_jobs=-1
            )
        else:
            model = GradientBoostingClassifier(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.05,
                random_state=42
            )
        
        # Train-test split (70-30, time-aware)
        split_idx = int(len(X) * 0.7)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        model.fit(X_train_scaled, y_train)
        
        # Predictions
        y_pred = model.predict(X_test_scaled)
        y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
        
        # Calculate metrics
        accuracy = (y_pred == y_test).mean()
        
        # Feature importance
        feature_importance = pd.DataFrame({
            'feature': feature_cols,
            'importance': model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        # Store model
        self.models[symbol] = {
            'model': model,
            'scaler': self.scaler,
            'features': feature_cols,
            'accuracy': accuracy
        }
        
        return {
            'symbol': symbol,
            'accuracy': accuracy,
            'predictions': y_pred,
            'actuals': y_test,
            'probabilities': y_pred_proba,
            'feature_importance': feature_importance,
            'classification_report': classification_report(y_test, y_pred)
        }
    
    def backtest_strategy(self, symbol: str = 'SPX') -> pd.DataFrame:
        """Backtest trading strategy based on predictions"""
        if symbol not in self.models:
            print(f"No model trained for {symbol}. Training now...")
            self.train_model(symbol)
        
        df = self.engineer_features()
        if 'symbol' in df.columns:
            df = df[df['symbol'] == symbol].copy()
        
        # Get predictions for entire dataset
        X, y, _ = self.prepare_ml_data(symbol)
        X_scaled = self.models[symbol]['scaler'].transform(X)
        predictions = self.models[symbol]['model'].predict_proba(X_scaled)[:, 1]
        
        # Create backtest dataframe
        backtest_df = df.iloc[-len(predictions):].copy()
        backtest_df['prediction_proba'] = predictions
        backtest_df['prediction'] = (predictions > 0.5).astype(int)
        backtest_df['signal'] = backtest_df['prediction'].map({1: 'LONG', 0: 'CASH'})
        
        # Calculate strategy returns
        backtest_df['strategy_return'] = np.where(
            backtest_df['prediction'] == 1,
            backtest_df['weekly_return'],
            0
        )
        
        backtest_df['cumulative_return'] = (1 + backtest_df['weekly_return'] / 100).cumprod()
        backtest_df['cumulative_strategy'] = (1 + backtest_df['strategy_return'] / 100).cumprod()
        
        return backtest_df
    
    def plot_results(self, backtest_df: pd.DataFrame, symbol: str = 'SPX'):
        """Visualize backtest results"""
        fig, axes = plt.subplots(3, 1, figsize=(15, 12))
        
        # Plot 1: Cumulative returns
        axes[0].plot(backtest_df['date'], backtest_df['cumulative_return'], 
                    label='Buy & Hold', linewidth=2)
        axes[0].plot(backtest_df['date'], backtest_df['cumulative_strategy'], 
                    label='ML Strategy', linewidth=2)
        axes[0].set_title(f'{symbol} - Cumulative Returns Comparison', fontsize=14)
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)
        
        # Plot 2: Weekly returns with predictions
        axes[1].bar(backtest_df['date'], backtest_df['weekly_return'], 
                   color=['green' if x > 0 else 'red' for x in backtest_df['weekly_return']],
                   alpha=0.3, label='Actual Returns')
        axes[1].scatter(backtest_df['date'], backtest_df['prediction_proba'] * 10 - 5,
                       c='blue', s=10, label='Prediction Probability (scaled)')
        axes[1].set_title('Weekly Returns vs Prediction Probability', fontsize=14)
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)
        
        # Plot 3: Net Liquidity
        if 'net_liquidity' in backtest_df.columns:
            axes[2].plot(backtest_df['date'], backtest_df['net_liquidity'] / 1e12, 
                        label='Net Liquidity (Trillions)', linewidth=2, color='purple')
            axes[2].set_title('Net Liquidity Over Time', fontsize=14)
            axes[2].legend()
            axes[2].grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(f'{symbol}_backtest_results.png', dpi=300, bbox_inches='tight')
        plt.show()
        
        # Print summary statistics
        total_return = (backtest_df['cumulative_return'].iloc[-1] - 1) * 100
        strategy_return = (backtest_df['cumulative_strategy'].iloc[-1] - 1) * 100
        
        print(f"\n{'='*60}")
        print(f"BACKTEST RESULTS - {symbol}")
        print(f"{'='*60}")
        print(f"Total Buy & Hold Return: {total_return:.2f}%")
        print(f"Total Strategy Return: {strategy_return:.2f}%")
        print(f"Outperformance: {strategy_return - total_return:.2f}%")
        print(f"{'='*60}\n")

# Example usage
if __name__ == "__main__":
    # Load data
    df = pd.read_csv('liquidity_market_data.csv')
    df['date'] = pd.to_datetime(df['date'])
    
    # Initialize analyzer
    analyzer = LiquidityMLAnalyzer(df)
    
    # Analyze correlations
    print("Analyzing correlations...")
    corr_report = analyzer.analyze_correlations()
    print("\nTop 10 Correlations with Weekly Returns:")
    print(corr_report.head(10))
    
    # Train model for SPX
    print("\nTraining model for SPX...")
    results = analyzer.train_model('SPX', model_type='rf')
    print(f"\nModel Accuracy: {results['accuracy']:.4f}")
    print("\nTop 10 Important Features:")
    print(results['feature_importance'].head(10))
    
    # Backtest
    print("\nRunning backtest...")
    backtest = analyzer.backtest_strategy('SPX')
    analyzer.plot_results(backtest, 'SPX')