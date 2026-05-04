#!/usr/bin/env python3
"""
Merge all UP booth-level ECI XLS files into a single master CSV.

Input:  data/booths/raw/**/*.xls  (and *.xlsx)
Output: data/booths/booth_master.csv

Two turnout file formats exist:
  Format A (candidate-detail): col[0] = AC number (e.g. 174), col[1] = booth no
  Format B (simple turnout):   col[0] = row serial (1,2,3...), col[1] = booth no
  Form-20 (Hindi result):      skipped — different data, wrong format

Deduplication: by ac_no extracted from the file header (one file per constituency).
"""

import csv
import os
import re
import sys

try:
    import xlrd
    import openpyxl
except ImportError:
    print("Installing xlrd and openpyxl...")
    os.system(f"{sys.executable} -m pip install xlrd openpyxl -q")
    import xlrd
    import openpyxl

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "booths", "raw")
OUT_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "booths", "booth_master.csv")

FIELDNAMES = [
    "ac_no", "booth_no", "booth_name", "district", "constituency_name",
    "total_electors", "male_turnout", "female_turnout", "other_turnout",
    "total_votes_secured", "epic_voters", "tendered_voters",
]


def _safe_int(val):
    try:
        return int(float(val))
    except (TypeError, ValueError):
        return 0


def _safe_str(val):
    return str(val).strip() if val else ""


def _parse_header(cell_values):
    """Extract (ac_no, constituency_name, district, is_turnout) from header rows."""
    ac_no = 0
    constituency_name = ""
    district = ""
    is_turnout = False

    for val in cell_values:
        s = _safe_str(val)
        su = s.upper()
        if ("NAME OF ASSEMBLY CONSTITUENCY" in su or
                "NAME OF ASSEMBLY CONSTITUNCY" in su):
            is_turnout = True
            m = re.search(r"(\d+)[^\d]+(.+)$", s, re.IGNORECASE)
            if m:
                ac_no = int(m.group(1))
                constituency_name = m.group(2).strip()
        elif su.startswith("DISTRICT"):
            district = re.sub(r"(?i)^District[\s\-–]*", "", s).strip()

    return ac_no, constituency_name, district, is_turnout


def _find_data_start_xls(sh):
    """Find the row index where booth data begins (after the 1,2,3... col-number row)."""
    for r in range(min(12, sh.nrows)):
        vals = sh.row_values(r)
        try:
            if (_safe_int(vals[0]) == 1 and _safe_int(vals[1]) == 2
                    and _safe_int(vals[2]) == 3):
                return r + 1
        except Exception:
            pass
    return 7


def _find_data_start_rows(rows):
    """Find the row index where booth data begins from a list of tuples."""
    for i, row in enumerate(rows[:12]):
        try:
            if (_safe_int(row[0]) == 1 and _safe_int(row[1]) == 2
                    and _safe_int(row[2]) == 3):
                return i + 1
        except Exception:
            pass
    return 7


def parse_xls(path):
    """Parse a .xls turnout file; yields booth row dicts. Returns (rows, ac_no_from_header)."""
    try:
        wb = xlrd.open_workbook(path)
    except Exception as e:
        return [], 0

    sh = wb.sheet_by_index(0)
    header_cells = [sh.cell_value(i, 0) for i in range(min(8, sh.nrows))]
    ac_no_hdr, constituency_name, district, is_turnout = _parse_header(header_cells)

    if not is_turnout:
        return [], 0

    DATA_START = _find_data_start_xls(sh)
    rows = []
    for r in range(DATA_START, sh.nrows):
        row = sh.row_values(r)
        if not row or not row[0]:
            continue
        col0 = _safe_int(row[0])
        if col0 == 0:
            continue

        # Format A: col0 is actual AC number (large, matches header)
        # Format B: col0 is row serial (1,2,3...), use ac_no from header
        if ac_no_hdr and col0 != ac_no_hdr:
            ac_no = ac_no_hdr   # Format B — trust the header
            booth_no = _safe_int(row[1])
            booth_name = _safe_str(row[2])
            total_electors = _safe_int(row[3])
            male_turnout = _safe_int(row[4])
            female_turnout = _safe_int(row[5])
            other_turnout = _safe_int(row[6]) if len(row) > 6 else 0
            epic_voters = 0
            tendered_voters = 0
            total_votes = 0
        else:
            ac_no = col0        # Format A — col0 is AC number
            booth_no = _safe_int(row[1])
            booth_name = _safe_str(row[2])
            total_electors = _safe_int(row[3])
            male_turnout = _safe_int(row[4])
            female_turnout = _safe_int(row[5])
            other_turnout = _safe_int(row[6]) if len(row) > 6 else 0
            epic_voters = _safe_int(row[7]) if len(row) > 7 else 0
            tendered_voters = _safe_int(row[8]) if len(row) > 8 else 0
            total_votes = _safe_int(row[-1])

        rows.append({
            "ac_no": ac_no,
            "booth_no": booth_no,
            "booth_name": booth_name,
            "district": district,
            "constituency_name": constituency_name,
            "total_electors": total_electors,
            "male_turnout": male_turnout,
            "female_turnout": female_turnout,
            "other_turnout": other_turnout,
            "total_votes_secured": total_votes,
            "epic_voters": epic_voters,
            "tendered_voters": tendered_voters,
        })
    return rows, ac_no_hdr


def parse_xlsx(path):
    """Parse a .xlsx turnout file; returns (rows, ac_no_from_header)."""
    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    except Exception as e:
        return [], 0

    sh = wb.active
    all_rows = list(sh.iter_rows(values_only=True))
    wb.close()

    header_cells = [all_rows[i][0] for i in range(min(8, len(all_rows)))]
    ac_no_hdr, constituency_name, district, is_turnout = _parse_header(header_cells)

    if not is_turnout:
        return [], 0

    DATA_START = _find_data_start_rows(all_rows)
    rows = []
    for row in all_rows[DATA_START:]:
        if not row or not row[0]:
            continue
        col0 = _safe_int(row[0])
        if col0 == 0:
            continue

        if ac_no_hdr and col0 != ac_no_hdr:
            ac_no = ac_no_hdr
            booth_no = _safe_int(row[1])
            booth_name = _safe_str(row[2])
            total_electors = _safe_int(row[3])
            male_turnout = _safe_int(row[4])
            female_turnout = _safe_int(row[5])
            other_turnout = _safe_int(row[6]) if len(row) > 6 else 0
            epic_voters = 0
            tendered_voters = 0
            total_votes = 0
        else:
            ac_no = col0
            booth_no = _safe_int(row[1])
            booth_name = _safe_str(row[2])
            total_electors = _safe_int(row[3])
            male_turnout = _safe_int(row[4])
            female_turnout = _safe_int(row[5])
            other_turnout = _safe_int(row[6]) if len(row) > 6 else 0
            epic_voters = _safe_int(row[7]) if len(row) > 7 else 0
            tendered_voters = _safe_int(row[8]) if len(row) > 8 else 0
            total_votes = _safe_int(row[-1]) if row[-1] is not None else 0

        rows.append({
            "ac_no": ac_no,
            "booth_no": booth_no,
            "booth_name": booth_name,
            "district": district,
            "constituency_name": constituency_name,
            "total_electors": total_electors,
            "male_turnout": male_turnout,
            "female_turnout": female_turnout,
            "other_turnout": other_turnout,
            "total_votes_secured": total_votes,
            "epic_voters": epic_voters,
            "tendered_voters": tendered_voters,
        })
    return rows, ac_no_hdr


def collect_files(raw_dir):
    """Collect files with priority: Booth level first, then Polling 2022.
    Skip top-level Agra/ (duplicated in Booth level/Agra) and UP 2017 Election/."""
    priority = {"Booth level": 0, "Polling 2022": 1}
    files = []
    for root, _dirs, fnames in os.walk(raw_dir):
        rel_root = os.path.relpath(root, raw_dir)
        top = rel_root.split(os.sep)[0]
        if top in ("Agra", "UP 2017 Election"):
            continue
        for fname in fnames:
            ext = os.path.splitext(fname)[1].lower()
            if ext in (".xls", ".xlsx"):
                order = priority.get(top, 99)
                files.append((order, os.path.join(root, fname)))
    files.sort()
    return [f for _, f in files]


def main():
    raw_dir = os.path.abspath(RAW_DIR)
    out_path = os.path.abspath(OUT_FILE)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    files = collect_files(raw_dir)
    print(f"Found {len(files)} XLS/XLSX files (skipping Agra/ and 2017/)")

    total_booths = 0
    error_count = 0
    seen_ac_nos = set()  # deduplicate by header-extracted AC number

    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()

        for i, fpath in enumerate(files, 1):
            rel = os.path.relpath(fpath, raw_dir)
            ext = os.path.splitext(fpath)[1].lower()
            try:
                if ext == ".xls":
                    rows, ac_no_hdr = parse_xls(fpath)
                else:
                    rows, ac_no_hdr = parse_xlsx(fpath)

                if not rows and ac_no_hdr == 0:
                    print(f"  [{i:03d}/{len(files)}] {rel} → SKIP (non-turnout file)")
                    continue

                if ac_no_hdr and ac_no_hdr in seen_ac_nos:
                    print(f"  [{i:03d}/{len(files)}] {rel} → SKIP (duplicate AC {ac_no_hdr})")
                    continue

                if ac_no_hdr:
                    seen_ac_nos.add(ac_no_hdr)

                if not rows:
                    print(f"  [{i:03d}/{len(files)}] {rel} → 0 booths")
                    continue

                writer.writerows(rows)
                total_booths += len(rows)
                print(f"  [{i:03d}/{len(files)}] {rel} → {len(rows)} booths  (AC {ac_no_hdr})")
            except Exception as e:
                print(f"  [{i:03d}/{len(files)}] ERROR {rel}: {e}")
                error_count += 1

    print(f"\nDone. {total_booths} booth rows written to {out_path}")
    print(f"Unique constituencies: {len(seen_ac_nos)}")
    if error_count:
        print(f"Errors: {error_count} files skipped")


if __name__ == "__main__":
    main()
