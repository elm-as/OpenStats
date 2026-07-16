import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import string

def generate_complex_dataset(num_rows=100000, output_path='test_dataset_complet.csv'):
    print(f"Generating {num_rows} rows of complex data...")
    
    # Set seed for reproducibility
    np.random.seed(42)
    
    # 1. ID (Unique Identifier)
    data = {'id': range(1, num_rows + 1)}
    
    # 2. Dates (Time Series / Temporal analysis)
    start_date = datetime(2020, 1, 1)
    # Random dates over a 5 year period
    data['date_event'] = [start_date + timedelta(days=np.random.randint(0, 1825)) for _ in range(num_rows)]
    
    # 3. Categorical Nominal
    categories = ['Electronics', 'Clothing', 'Home', 'Toys', 'Sports']
    data['category'] = np.random.choice(categories, num_rows, p=[0.3, 0.25, 0.2, 0.15, 0.1])
    
    # 4. Categorical Ordinal
    satisfaction_levels = ['Very Dissatisfied', 'Dissatisfied', 'Neutral', 'Satisfied', 'Very Satisfied']
    data['satisfaction_level'] = np.random.choice(satisfaction_levels, num_rows, p=[0.05, 0.1, 0.3, 0.4, 0.15])
    
    # 5. Continuous Numerical (Normal Distribution) - Base variable
    data['revenue'] = np.random.normal(loc=500, scale=150, size=num_rows)
    data['revenue'] = np.clip(data['revenue'], 10, None) # No negative revenue
    
    # 6. Continuous Numerical (Exponential / Skewed) - Correlated to revenue (r ~ 0.6)
    noise = np.random.normal(0, 10, size=num_rows)
    data['time_spent_minutes'] = data['revenue'] * 0.05 + noise + 5
    data['time_spent_minutes'] = np.clip(data['time_spent_minutes'], 1, None)
    
    # 7. Discrete Numerical - Highly correlated to revenue (r ~ 0.85)
    noise2 = np.random.normal(0, 2, size=num_rows)
    data['items_purchased'] = np.round((data['revenue'] / 100) + noise2)
    data['items_purchased'] = np.where(data['items_purchased'] < 1, 1, data['items_purchased'])
    
    # 8. Boolean (represented as strings to avoid numpy boolean subtraction bugs in analysis)
    data['is_premium_member'] = np.random.choice(['Yes', 'No'], num_rows, p=[0.2, 0.8])
    
    # 8b. Binary Numeric (0/1) for models that need numbers - Moderately correlated to revenue
    prob = 1 / (1 + np.exp(-(data['revenue'] - 500) / 100)) # Logistic curve based on revenue
    data['is_active_user'] = np.random.binomial(1, prob)
    
    # 9. Correlated Variable (Discount depends on membership and items purchased) -> Multicollinearity!
    data['discount_applied'] = (data['items_purchased'] * 2.5) + (data['is_premium_member'] == 'Yes') * 15.0 + np.random.normal(0, 1, num_rows)
    
    # 10. Free text
    def random_string(length=10):
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))
    data['reference_code'] = [random_string() for _ in range(num_rows)]

    # Create DataFrame
    df = pd.DataFrame(data)
    
    # 11. Inject Missing Values (NaN) randomly to test robustness!
    print("Injecting missing values (NaN) for robustness testing...")
    
    # 5% missing in revenue
    mask_revenue = np.random.rand(num_rows) < 0.05
    df.loc[mask_revenue, 'revenue'] = np.nan
    
    # 10% missing in satisfaction
    mask_satisfaction = np.random.rand(num_rows) < 0.10
    df.loc[mask_satisfaction, 'satisfaction_level'] = np.nan
    
    # 2% missing dates
    mask_date = np.random.rand(num_rows) < 0.02
    df.loc[mask_date, 'date_event'] = pd.NaT
    
    # Save to CSV
    print(f"Saving to {output_path}...")
    df.to_csv(output_path, index=False)
    print("Dataset generated successfully!")

if __name__ == '__main__':
    # You can adjust the path as needed
    import os
    base_dir = r"c:\Users\elmas\Desktop\Projets\Stats\backend\data"
    os.makedirs(base_dir, exist_ok=True)
    out_file = os.path.join(base_dir, "test_dataset_complet.csv")
    generate_complex_dataset(num_rows=100000, output_path=out_file)
