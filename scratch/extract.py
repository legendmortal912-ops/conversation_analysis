import json
import re
with open(r'C:\Users\Vinyas\.gemini\antigravity-ide\brain\ddfd3d3c-6191-432a-8fa8-b1ef2d40210a\.system_generated\steps\2066\content.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Try to find the __next_data__ or similar json state
m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', text)
if m:
    data = json.loads(m.group(1))
    print("Found NEXT_DATA")
else:
    # Just extract plain text content maybe
    print("No NEXT_DATA found")
    
# Let's extract any text that looks like a message
parts = re.findall(r'\"parts\":\[\"(.*?)\"\]', text)
for p in parts[:5]:
    print("PART:", p[:200])
