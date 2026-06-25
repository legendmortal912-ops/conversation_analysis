import json
from collections import Counter

lines = open('training_data.jsonl').readlines()
print(f'Total samples: {len(lines)}')

label_names = ['topic_hijacking','opinion_injection','false_urgency','concern_dismissal','agenda_persistence']
label_counts = Counter()
any_positive = 0
all_zero = 0
total_words = 0

for line in lines:
    d = json.loads(line)
    labels = d['labels']
    total_words += len(d['text'].split())
    if any(labels):
        any_positive += 1
        for i, v in enumerate(labels):
            if v:
                label_counts[label_names[i]] += 1
    else:
        all_zero += 1

print(f'Positive samples: {any_positive}')
print(f'All-zero (clean) samples: {all_zero}')
print(f'Label distribution: {dict(label_counts)}')
print(f'Avg text length: {total_words / len(lines):.1f} words')

# Show 5 positive samples
print('\n--- Sample positive examples ---')
count = 0
for line in lines:
    d = json.loads(line)
    if any(d['labels']):
        active = [label_names[i] for i, v in enumerate(d['labels']) if v]
        print(f'Labels: {active}')
        print(f'Text: {d["text"][:200]}')
        print()
        count += 1
        if count >= 5:
            break
