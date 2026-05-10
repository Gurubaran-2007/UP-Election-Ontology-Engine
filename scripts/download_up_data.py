#!/usr/bin/env python3
"""
Additional data downloaders for UP governance data
"""

import os
import json
import pandas as pd

OUTPUT_DIR = "data/scraped"

def process_existing_data():
    """Process the existing data files in the data folder"""
    print("Processing existing data files...")
    
    data_summary = {
        'sources': []
    }
    
    # Check for economic data
    eco_file = "data/Merged_Annually_Quarterly.csv"
    if os.path.exists(eco_file):
        print(f"  Found economic data: {eco_file}")
        try:
            df = pd.read_csv(eco_file)
            data_summary['sources'].append({
                'name': 'Economic Data (GVA)',
                'file': eco_file,
                'records': len(df),
                'type': 'state-level economic indicators'
            })
        except Exception as e:
            print(f"  Error reading {eco_file}: {e}")
    
    # Check for block expenditure
    block_file = "data/BlockWiseExpenditureReport_2025-2026.xls"
    if os.path.exists(block_file):
        print(f"  Found block expenditure: {block_file}")
        data_summary['sources'].append({
            'name': 'Block-wise Expenditure',
            'file': block_file,
            'type': 'block level expenditure'
        })
    
    # Check for existing ECI data
    eci_files = [
        "data/eci/vs2022/detailed_results.csv",
        "data/eci/india_ls2024_results.csv",
    ]
    for f in eci_files:
        if os.path.exists(f):
            print(f"  Found ECI data: {f}")
            data_summary['sources'].append({
                'name': 'ECI Election Data',
                'file': f,
                'type': 'election results'
            })
    
    return data_summary


def download_up_census_data():
    """Prepare download links for UP Census data"""
    # Census data would need to be downloaded from official sources
    print("\nUP Census Data Sources:")
    print("  - https://censusindia.gov.in (2011 Census)")
    print("  - https://udd.up.nic.in (UP urban data)")
    
    # Note: Census 2021 is not fully released


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("=" * 60)
    print("UP Governance Data Processing")
    print("=" * 60)
    
    # Process existing data
    summary = process_existing_data()
    
    # Save summary
    with open(f"{OUTPUT_DIR}/data_summary.json", 'w') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\nData summary saved to: {OUTPUT_DIR}/data_summary.json")
    
    print("\n" + "=" * 60)
    print("Available Data Sources Summary:")
    print("=" * 60)
    
    for source in summary['sources']:
        print(f"\n{source['name']}")
        print(f"  File: {source['file']}")
        print(f"  Type: {source['type']}")
        if 'records' in source:
            print(f"  Records: {source['records']}")


if __name__ == "__main__":
    main()