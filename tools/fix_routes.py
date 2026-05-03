import re

with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# The routes we want to move up
heatmap_pattern = re.compile(r"(// Phase 4: Get heatmap data\napp\.get\('/api/up/sentiment/heatmap'.*?\}\);)", re.DOTALL)
alerts_pattern = re.compile(r"(// Phase 4: Get alerts\napp\.get\('/api/up/sentiment/alerts'.*?\}\);)", re.DOTALL)

heatmap_match = heatmap_pattern.search(content)
alerts_match = alerts_pattern.search(content)

if heatmap_match and alerts_match:
    heatmap_code = heatmap_match.group(1)
    alerts_code = alerts_match.group(1)
    
    # Remove them from their current location
    content = content.replace(heatmap_code, '')
    content = content.replace(alerts_code, '')
    
    # Insert them before Phase 1
    insert_marker = "// Phase 1: Get sentiment for a constituency"
    insert_code = f"{heatmap_code}\n\n{alerts_code}\n\n{insert_marker}"
    
    content = content.replace(insert_marker, insert_code)
    
    with open('server.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed route ordering in server.js")
else:
    print("Could not find routes to fix")
