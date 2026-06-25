import json
import re

with open('gemini_dump.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Gemini usually stores state in AF_initDataCallback
matches = re.findall(r'<script.*?>\s*(AF_initDataCallback.*?)</script>', content, re.DOTALL)
print(f'Found {len(matches)} AF_initDataCallback scripts')
for i, m in enumerate(matches):
    print(f'Match {i} length: {len(m)}')
    if len(m) > 1000:
        # Find the JSON array inside: AF_initDataCallback({key: 'ds:1', hash: '2', data: [ ... ], sideChannel: {}});
        data_match = re.search(r'data:([\[{].*?[\]}])(?:, sideChannel|$)', m, re.DOTALL)
        if data_match:
            try:
                data_str = data_match.group(1)
                print(f'  Parsed JSON, length {len(data_str)}')
                # Try to find typical Gemini patterns like [["USER"], ["MODEL"]]
                if "USER" in data_str or "MODEL" in data_str:
                    print(f"  --> POTENTIAL CHAT DATA in Match {i}")
                    with open(f'gemini_data_{i}.txt', 'w', encoding='utf-8') as out:
                        out.write(data_str)
            except Exception as e:
                print(f'  Error: {e}')
