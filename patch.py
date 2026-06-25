import re

path = 'c:/Users/Vinyas/Coding/Projects/ConvoGuard/apps/analysis-engine/src/training/generate_training_data.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Update LABELS list
text = text.replace(
    '"agenda_persistence",\n]',
    '"agenda_persistence",\n    "competitor_bashing",\n]'
)

# Append 0 to all 5-element label arrays
text = re.sub(r'\"labels\": \[(.*?)\],', lambda m: f'\"labels\": [{m.group(1)}, 0],', text)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
