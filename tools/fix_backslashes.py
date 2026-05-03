#!/usr/bin/env python3
"""Fix \\n vs newline escaping in sentiment_engine/*.py

Generated files have literal two-char '\\' 'n' in source where Python
needs an actual newline escape '\\n'. This script fixes that.
"""
from pathlib import Path
import re

root = Path("sentiment_engine")
fixed_count = 0

for path in root.glob("*.py"):
    text = path.read_text(encoding="utf-8")
    original = text

    # Fix 1: Replace literal two-char "\\n" with newline escape "\\n"
    # In source code, we want the two chars '\' and 'n' to become newline escape
    fixed = text.replace('\\\\n', '\\n')

    # Fix 2: Also fix other potential escape issues
    # Replace literal "\\t" with tab escape
    fixed = fixed.replace('\\\\t', '\\t')

    if fixed != original:
        print(f"Fixed: {path.name}")
        path.write_text(fixed, encoding="utf-8")
        fixed_count += 1

print(f"\nTotal files fixed: {fixed_count}")
print("\nNow let's verify the fixes...")
