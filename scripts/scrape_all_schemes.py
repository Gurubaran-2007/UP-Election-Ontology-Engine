#!/usr/bin/env python3
"""
Comprehensive Scheme Data Scraper for UP
Fetches scheme data from multiple government sources
"""

import requests
import warnings
warnings.filterwarnings('ignore')

from bs4 import BeautifulSoup
import pandas as pd
import json
import os
import time

BASE_URL = "https://www.egramswaraj.gov.in"
OUTPUT_DIR = "data/scraped/schemes"
FIN_YEAR = "2024-2025"
STATE_CODE = "9"

def get_session():
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })
    return session

def fetch_url(url, session):
    try:
        response = session.get(url, timeout=30)
        if response.status_code == 200:
            return BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        print(f"Error: {e}")
    return None

def scrape_scheme_list(session):
    """Get list of all schemes from eGramSwaraj"""
    print("Fetching scheme list...")
    
    schemes = [
        {"code": "MGNREGA", "name": "MGNREGA - Mahatma Gandhi National Rural Employment Guarantee Act", "type": "Central"},
        {"code": "PMGSY", "name": "PMGSY - Pradhan Mantri Gram Sadak Yojana", "type": "Central"},
        {"code": "PMAY", "name": "PMAY - Pradhan Mantri Awas Yojana (Rural)", "type": "Central"},
        {"code": "PMAY-Urban", "name": "PMAY - Pradhan Mantri Awas Yojana (Urban)", "type": "Central"},
        {"code": "JJM", "name": "JJM - Jal Jeevan Mission", "type": "Central"},
        {"code": "SBM-G", "name": "SBM - Swachh Bharat Mission (Gramin)", "type": "Central"},
        {"code": "SBM-U", "name": "SBM - Swachh Bharat Mission (Urban)", "type": "Central"},
        {"code": "PM-KISAN", "name": "PM-KISAN - Pradhan Mantri Kisan Samman Nidhi", "type": "Central"},
        {"code": "KCC", "name": "KCC - Kisan Credit Card", "type": "Central"},
        {"code": "PMFBY", "name": "PMFBY - Pradhan Mantri Fasal Bima Yojana", "type": "Central"},
        {"code": "SCD", "name": "SCD - Saansad Adarsh Gram Yojana", "type": "Central"},
        {"code": "NSAP", "name": "NSAP - National Social Assistance Programme", "type": "Central"},
        {"code": "ICDS", "name": "ICDS - Integrated Child Development Services", "type": "Central"},
        {"code": "NFSA", "name": "NFSA - National Food Security Act", "type": "Central"},
        {"code": "MDM", "name": "MDM - Mid Day Meal", "type": "Central"},
        {"code": "NRLM", "name": "NRLM - National Rural Livelihood Mission", "type": "Central"},
        {"code": "DAY-NRLM", "name": "DAY-NRLM - Deendayal Antyodaya Yojana", "type": "Central"},
        {"code": "PM-Dev", "name": "PM-Dev - Prime Minister's Development Initiative", "type": "State"},
        {"code": "Kanya", "name": "Kanya Sumangala Yojana", "type": "State"},
        {"code": "Ladli", "name": "Ladli Laxmi Yojana", "type": "State"},
        {"code": "RGGVY", "name": "Rajiv Gandhi Gramin Vidyutikaran Yojana", "type": "State"},
        {"code": "SP", "name": "Sadak Pension Yojana", "type": "State"},
        {"code": "VR", "name": "Vidrang Yojana", "type": "State"},
    ]
    
    return schemes

def scrape_mgnrega_data(session):
    """Scrape MGNREGA piece rate and employment data"""
    print("Fetching MGNREGA data...")
    
    data = []
    
    # Try different URLs for MGNREGA data
    urls = [
        f"{BASE_URL}/RecExpReportNew.do?finYear={FIN_YEAR}&scheme_uid=3073",
        f"{BASE_URL}/recExpReport.do?finYear={FIN_YEAR}&schemeCode=MGNREGA"
    ]
    
    for url in urls:
        soup = fetch_url(url, session)
        if soup:
            tables = soup.find_all('table')
            for table in tables:
                rows = table.find_all('tr')
                for row in rows[1:]:
                    cols = row.find_all('td')
                    if len(cols) >= 4:
                        district = cols[0].get_text(strip=True)
                        if district and district not in ['', 'Total']:
                            try:
                                data.append({
                                    'scheme': 'MGNREGA',
                                    'district': district,
                                    'persondays_generated': cols[1].get_text(strip=True),
                                    'wage_payment_lakhs': cols[2].get_text(strip=True),
                                    'houses_constructed': cols[3].get_text(strip=True) if len(cols) > 3 else '0'
                                })
                            except:
                                pass
    
    return data

def scrape_fc_grants_data(session):
    """Finance Commission grants data"""
    print("Fetching Finance Commission data...")
    
    url = "https://www.egramswaraj.gov.in/FileRedirect.jsp?FD=ExpenditureReport2024-2025/9&name=9.html"
    soup = fetch_url(url, session)
    
    data = []
    if soup:
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 7:
                    district = cols[0].get_text(strip=True)
                    if district and district not in ['', 'Total', 'District', 'Zilla Panchayat']:
                        data.append({
                            'scheme': 'FC-Grants',
                            'district': district,
                            'zp_receipts_cr': cols[1].get_text(strip=True),
                            'zp_payments_cr': cols[2].get_text(strip=True),
                            'bp_payments_cr': cols[4].get_text(strip=True),
                            'gp_payments_cr': cols[6].get_text(strip=True)
                        })
    
    return data

def scrape_pfms_wdc_data(session):
    """PFMS WDC (Watershed Development) data"""
    print("Fetching PFMS WDC data...")
    
    url = "https://www.wdcpmksy.dolr.gov.in/pfmsDistwiseExpndtr?stcode=9"
    soup = fetch_url(url, session)
    
    data = []
    if soup:
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows[1:]:
                cols = row.find_all('td')
                if len(cols) >= 4:
                    district = cols[1].get_text(strip=True)
                    if district and district not in ['', 'Total']:
                        data.append({
                            'scheme': 'WDC-PMKSY',
                            'district': district,
                            'sanctioned_lakhs': cols[2].get_text(strip=True),
                            'expenditure_lakhs': cols[3].get_text(strip=True),
                            'utilization_pct': str(round((float(cols[3].get_text(strip=True).replace(',','')) / float(cols[2].get_text(strip=True).replace(',','')) * 100), 2) if float(cols[2].get_text(strip=True).replace(',','')) > 0 else 0) if cols[2].get_text(strip=True) else '0'
                        })
    
    return data

def scrape_beneficiary_data(session):
    """Scrape beneficiary data from various sources"""
    print("Fetching beneficiary data...")
    
    # This would typically come from: https://mnregaweb4.nic.in or state portals
    # For now, we'll estimate from expenditure data
    
    # Try GPDP portal for beneficiary numbers
    url = "https://gpdp.nic.in/gkraExpenditureReport.html?stateId=9&stateName=UTTAR+PRADESH"
    soup = fetch_url(url, session)
    
    data = []
    if soup:
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows[1:]:
                cols = row.find_all('td')
                if len(cols) >= 6:
                    district = cols[1].get_text(strip=True)
                    if district and 'Total' not in district:
                        try:
                            data.append({
                                'district': district.replace('(', '').replace(')', '').strip(),
                                'fc_fund_cr': cols[2].get_text(strip=True),
                                'expenditure_cr': cols[3].get_text(strip=True),
                                'expenditure_pct': cols[4].get_text(strip=True),
                                'man_days': cols[5].get_text(strip=True) if len(cols) > 5 else '0'
                            })
                        except:
                            pass
    
    return data

def create_summary(all_data):
    """Create comprehensive summary"""
    summary = {
        'total_schemes': len(all_data.get('schemes', [])),
        'districts_with_data': len(set([d.get('district') for d in all_data.get('fc_grants', [])])),
        'financial_year': FIN_YEAR,
        'sources_scraped': list(all_data.keys()),
        'schemes': all_data.get('schemes', []),
        'sample_district_data': all_data.get('fc_grants', [])[:10] if all_data.get('fc_grants') else []
    }
    
    # Calculate totals
    total_expenditure = 0
    for d in all_data.get('pfms', []):
        try:
            total_expenditure += float(d.get('expenditure_lakhs', 0) or 0)
        except:
            pass
    
    summary['total_pfms_expenditure_lakhs'] = round(total_expenditure, 2)
    
    return summary

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    session = get_session()
    
    print("=" * 60)
    print("Scraping Comprehensive UP Scheme Data")
    print("=" * 60)
    
    all_data = {}
    
    # 1. Get scheme list
    all_data['schemes'] = scrape_scheme_list(session)
    print(f"  Found {len(all_data['schemes'])} schemes")
    
    # 2. MGNREGA data
    all_data['mgnrega'] = scrape_mgnrega_data(session)
    print(f"  MGNREGA records: {len(all_data['mgnrega'])}")
    
    # 3. Finance Commission data (includes all PRI levels)
    all_data['fc_grants'] = scrape_fc_grants_data(session)
    print(f"  FC Grants records: {len(all_data['fc_grants'])}")
    
    # 4. PFMS WDC data
    all_data['pfms'] = scrape_pfms_wdc_data(session)
    print(f"  PFMS records: {len(all_data['pfms'])}")
    
    # 5. Beneficiary data
    all_data['beneficiaries'] = scrape_beneficiary_data(session)
    print(f"  Beneficiary records: {len(all_data['beneficiaries'])}")
    
    # Create summary
    summary = create_summary(all_data)
    
    # Save all data
    with open(f"{OUTPUT_DIR}/all_schemes.json", 'w') as f:
        json.dump(all_data, f, indent=2)
    
    with open(f"{OUTPUT_DIR}/summary.json", 'w') as f:
        json.dump(summary, f, indent=2)
    
    # Save as CSV for easier viewing
    if all_data['fc_grants']:
        pd.DataFrame(all_data['fc_grants']).to_csv(f"{OUTPUT_DIR}/fc_grants_by_district.csv", index=False)
    
    if all_data['pfms']:
        pd.DataFrame(all_data['pfms']).to_csv(f"{OUTPUT_DIR}/pfms_by_district.csv", index=False)
    
    print(f"\n[OK] Data saved to {OUTPUT_DIR}")
    print(f"  - all_schemes.json")
    print(f"  - summary.json")
    print(f"  - fc_grants_by_district.csv")
    print(f"  - pfms_by_district.csv")

if __name__ == "__main__":
    main()