#!/usr/bin/env python3
"""
eGramSwaraj Scraper
Fetches scheme expenditure data for Uttar Pradesh at District, Block, and Panchayat levels.
"""

import requests
from requests.packages.urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

from bs4 import BeautifulSoup
import pandas as pd
import json
import os
import time
import re
from typing import Dict, List, Optional
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter

BASE_URL = "https://www.egramswaraj.gov.in"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

STATE_CODE = "9"  # Uttar Pradesh
FIN_YEAR = "2024-2025"
OUTPUT_DIR = "data/scraped/egramswaraj"

# Static export URLs from eGramSwaraj
STATIC_URLS = {
    'district_2024_2025': 'https://www.egramswaraj.gov.in/FileRedirect.jsp?FD=ExpenditureReport2024-2025/9&name=9.html',
    'district_2025_2026': 'https://www.egramswaraj.gov.in/FileRedirect.jsp?FD=ExpenditureReport2025-2026/9&name=9.html',
    'state_summary_2024': 'https://www.egramswaraj.gov.in/FileRedirect.jsp?FD=ExpenditureReport2024-2025&name=StateExpenditureReport.html',
    # Additional URLs to try
    'state_summary_2025': 'https://www.egramswaraj.gov.in/FileRedirect.jsp?FD=ExpenditureReport2025-2026&name=StateExpenditureReport.html',
}

# Additional data sources
ADDITIONAL_URLS = [
    # PFMS district-wise expenditure (WDC PMKSY)
    'https://www.wdcpmksy.dolr.gov.in/pfmsDistwiseExpndtr?stcode=9',
    # GPDP - Finance Commission grants
    'https://gpdp.nic.in/gkraExpenditureReport.html?stateId=9&stateName=UTTAR+PRADESH',
]


def get_session():
    session = requests.Session()
    session.headers.update(HEADERS)
    session.verify = False
    
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retries)
    session.mount('https://', adapter)
    session.mount('http://', adapter)
    
    return session


def fetch_url(url: str, session: requests.Session, data: Optional[Dict] = None) -> Optional[BeautifulSoup]:
    try:
        if data:
            response = session.post(url, data=data, timeout=30)
        else:
            response = session.get(url, timeout=30)
        
        if response.status_code == 200:
            return BeautifulSoup(response.text, 'html.parser')
        print(f"Status {response.status_code} for {url}")
    except Exception as e:
        print(f"Error fetching {url}: {e}")
    return None


def get_state_summary(session: requests.Session) -> List[Dict]:
    """Get state-wise summary of expenditure"""
    print("Fetching state summary...")
    
    url = f"{BASE_URL}/expenditureStateReport.do?finYear={FIN_YEAR}"
    soup = fetch_url(url, session)
    
    if not soup:
        return []
    
    tables = soup.find_all('table')
    data = []
    
    for table in tables:
        rows = table.find_all('tr')
        for row in rows[1:]:
            cols = row.find_all(['td', 'th'])
            if len(cols) >= 2:
                cells = [c.get_text(strip=True) for c in cols]
                if cells[0] == 'UTTAR PRADESH':
                    data.append({
                        'state': 'UTTAR PRADESH',
                        'ob_receipts_cr': cells[1] if len(cols) > 1 else None,
                        'ob_payments_cr': cells[2] if len(cols) > 2 else None,
                    })
    
    return data


def fetch_static_html(session: requests.Session, url: str) -> Optional[BeautifulSoup]:
    """Fetch static HTML export files"""
    print(f"Fetching static file: {url.split('?')[0]}")
    return fetch_url(url, session)


def parse_static_expenditure_table(soup: BeautifulSoup) -> List[Dict]:
    """Parse the standard expenditure table format"""
    data = []
    if not soup:
        return data
    
    tables = soup.find_all('table')
    for table in tables:
        rows = table.find_all('tr')
        for row in rows[1:]:
            cols = row.find_all('td')
            if len(cols) >= 2:
                cells = [c.get_text(strip=True) for c in cols]
                if cells[0] and cells[0] not in ['', 'Total']:
                    row_data = {'name': cells[0]}
                    for i, val in enumerate(cells[1:], 1):
                        try:
                            row_data[f'col_{i}'] = float(val.replace(',', '').replace('₹', '').replace('Cr', '').strip()) if val.strip() else 0
                        except:
                            row_data[f'col_{i}'] = val
                    data.append(row_data)
    return data


def get_district_list(session: requests.Session) -> List[Dict]:
    """Get list of all districts in UP from static file"""
    print("Fetching district list from static export...")
    
    url = STATIC_URLS['district_2024_2025']
    soup = fetch_static_html(session, url)
    
    if not soup:
        return []
    
    districts = []
    tables = soup.find_all('table')
    for table in tables:
        rows = table.find_all('tr')
        for row in rows[1:]:
            cols = row.find_all('td')
            if len(cols) >= 1:
                name = cols[0].get_text(strip=True)
                if name and name not in ['', 'Total']:
                    districts.append({
                        'code': name.replace(' ', '_').upper(),
                        'name': name
                    })
    
    return districts


def get_district_expenditure(session: requests.Session, district_code: str) -> List[Dict]:
    """Get block-wise expenditure for a district"""
    print(f"Fetching expenditure for district {district_code}...")
    
    url = f"{BASE_URL}/blockWiseExpenditure.do"
    form_data = {
        'finYear': FIN_YEAR,
        'stateCode': STATE_CODE,
        'districtPanchayat': district_code,
    }
    
    soup = fetch_url(url, session, form_data)
    
    if not soup:
        return []
    
    data = []
    tables = soup.find_all('table')
    
    for table in tables:
        rows = table.find_all('tr')
        for row in rows[1:]:
            cols = row.find_all('td')
            if len(cols) >= 4:
                data.append({
                    'district_code': district_code,
                    'block_name': cols[0].get_text(strip=True),
                    'receipts_lakhs': cols[1].get_text(strip=True),
                    'payments_lakhs': cols[2].get_text(strip=True),
                })
    
    return data


def get_block_expenditure(session: requests.Session, district_code: str, block_code: str) -> List[Dict]:
    """Get panchayat-wise expenditure for a block"""
    url = f"{BASE_URL}/villageWiseExpenditure.do"
    form_data = {
        'finYear': FIN_YEAR,
        'stateCode': STATE_CODE,
        'districtPanchayat': district_code,
        'blockPanchayat': block_code,
    }
    
    soup = fetch_url(url, session, form_data)
    
    if not soup:
        return []
    
    data = []
    tables = soup.find_all('table')
    
    for table in tables:
        rows = table.find_all('tr')
        for row in rows[1:]:
            cols = row.find_all('td')
            if len(cols) >= 3:
                data.append({
                    'district_code': district_code,
                    'block_code': block_code,
                    'panchayat_name': cols[0].get_text(strip=True),
                    'receipts': cols[1].get_text(strip=True),
                    'payments': cols[2].get_text(strip=True),
                })
    
    return data


def scrape_district_summary(session: requests.Session) -> List[Dict]:
    """Get district-wise summary expenditure from static file"""
    print("Fetching district summary from static export...")
    
    url = STATIC_URLS['district_2024_2025']
    soup = fetch_static_html(session, url)
    
    if not soup:
        return []
    
    data = []
    tables = soup.find_all('table')
    
    for table in tables:
        rows = table.find_all('tr')
        for row in rows:
            cols = row.find_all('td')
            if len(cols) >= 7:
                first_cell = cols[0].get_text(strip=True)
                if first_cell and first_cell not in ['', 'District', 'Total', 'Zilla Panchayat', 'OB + Receipts (Cr)']:
                    try:
                        data.append({
                            'district': first_cell,
                            'zp_ob_receipts_cr': float(cols[1].get_text(strip=True).replace(',', '') or 0),
                            'zp_payments_cr': float(cols[2].get_text(strip=True).replace(',', '') or 0),
                            'bp_ob_receipts_cr': float(cols[3].get_text(strip=True).replace(',', '') or 0),
                            'bp_payments_cr': float(cols[4].get_text(strip=True).replace(',', '') or 0),
                            'gp_ob_receipts_cr': float(cols[5].get_text(strip=True).replace(',', '') or 0),
                            'gp_payments_cr': float(cols[6].get_text(strip=True).replace(',', '') or 0),
                        })
                    except:
                        pass
    
    return data


def get_schemes(session: requests.Session) -> List[Dict]:
    """Get available schemes"""
    print("Fetching scheme list...")
    
    url = f"{BASE_URL}/schemeExpenditureReport.do?finYear={FIN_YEAR}"
    soup = fetch_url(url, session)
    
    if not soup:
        return []
    
    schemes = []
    select = soup.find('select', {'name': 'schemeCode'})
    if select:
        options = select.find_all('option')
        for opt in options[1:]:
            schemes.append({
                'code': opt.get('value', ''),
                'name': opt.get_text(strip=True)
            })
    
    return schemes


def scrape_pfms_data(session: requests.Session) -> List[Dict]:
    """Scrape PFMS district-wise expenditure data"""
    print("Fetching PFMS data...")
    
    url = "https://www.wdcpmksy.dolr.gov.in/pfmsDistwiseExpndtr?stcode=9"
    soup = fetch_static_html(session, url)
    
    if not soup:
        return []
    
    data = []
    tables = soup.find_all('table')
    
    for table in tables:
        rows = table.find_all('tr')
        for row in rows[1:]:
            cols = row.find_all('td')
            if len(cols) >= 4:
                try:
                    district = cols[1].get_text(strip=True)
                    if district and district not in ['Total', '']:
                        data.append({
                            'district': district,
                            'sanctioned_lakhs': float(cols[2].get_text(strip=True).replace(',', '') or 0),
                            'expenditure_lakhs': float(cols[3].get_text(strip=True).replace(',', '') or 0),
                            'source': 'PFMS-WDCPMKSY',
                        })
                except:
                    pass
    
    return data


def scrape_gpdp_data(session: requests.Session) -> List[Dict]:
    """Scrape GPDP Finance Commission grants data"""
    print("Fetching GPDP data...")
    
    url = "https://gpdp.nic.in/gkraExpenditureReport.html?stateId=9&stateName=UTTAR+PRADESH"
    soup = fetch_static_html(session, url)
    
    if not soup:
        return []
    
    data = []
    tables = soup.find_all('table')
    
    for table in tables:
        rows = table.find_all('tr')
        for row in rows[1:]:
            cols = row.find_all('td')
            if len(cols) >= 5:
                try:
                    district = cols[1].get_text(strip=True)
                    if district and 'Total' not in district:
                        data.append({
                            'district': district.replace('(', '').replace(')', '').strip(),
                            'fc_fund_allocated_cr': float(cols[2].get_text(strip=True).replace(',', '') or 0),
                            'fc_expenditure_cr': float(cols[3].get_text(strip=True).replace(',', '') or 0),
                            'expenditure_pct': cols[4].get_text(strip=True),
                            'man_days': cols[5].get_text(strip=True) if len(cols) > 5 else None,
                            'source': 'GPDP-FCGrants',
                        })
                except:
                    pass
    
    return data


def scrape_all_data():
    """Main function to scrape all data"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    session = get_session()
    
    print("=" * 50)
    print("Starting eGramSwaraj data scraping...")
    print("=" * 50)
    
    print("\n1. Fetching available schemes...")
    schemes = get_schemes(session)
    print(f"   Found {len(schemes)} schemes")
    
    if schemes:
        with open(f"{OUTPUT_DIR}/schemes.json", 'w') as f:
            json.dump(schemes, f, indent=2)
    
    print("\n2. Fetching district summary (eGramSwaraj)...")
    district_data = scrape_district_summary(session)
    print(f"   Found {len(district_data)} districts")
    
    if district_data:
        df = pd.DataFrame(district_data)
        df.to_csv(f"{OUTPUT_DIR}/district_expenditure.csv", index=False)
    
    print("\n3. Fetching PFMS data...")
    pfms_data = scrape_pfms_data(session)
    print(f"   Found {len(pfms_data)} PFMS records")
    
    if pfms_data:
        df = pd.DataFrame(pfms_data)
        df.to_csv(f"{OUTPUT_DIR}/pfms_expenditure.csv", index=False)
    
    print("\n4. Fetching GPDP (Finance Commission) data...")
    gpdp_data = scrape_gpdp_data(session)
    print(f"   Found {len(gpdp_data)} GPDP records")
    
    if gpdp_data:
        df = pd.DataFrame(gpdp_data)
        df.to_csv(f"{OUTPUT_DIR}/gpdp_fc_expenditure.csv", index=False)
    
    print("\n5. Saving complete data...")
    
    summary = {
        'fin_year': FIN_YEAR,
        'state': 'UTTAR PRADESH',
        'districts_scraped': len(district_data),
        'pfms_records': len(pfms_data),
        'gpdp_records': len(gpdp_data),
        'schemes_available': len(schemes),
    }
    
    with open(f"{OUTPUT_DIR}/summary.json", 'w') as f:
        json.dump(summary, f, indent=2)
    
    print("\n" + "=" * 50)
    print("Scraping complete!")
    print(f"Data saved to: {OUTPUT_DIR}")
    print("=" * 50)
    
    return summary


if __name__ == "__main__":
    scrape_all_data()