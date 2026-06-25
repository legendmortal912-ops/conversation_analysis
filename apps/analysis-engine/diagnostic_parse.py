"""Diagnostic: test conversation parsing and engine scoring end-to-end."""
import re
import json
import httpx
import sys

# ── Same regex logic as the frontend parseConversationText ──────────────────
USER_RE = re.compile(
    r'^(?:\*\*|__|[\[])* *(?:user|human|you|me|customer|client|patient|person)'
    r'(?:\*\*|__|[\]])*\s*[:\-]\s*', re.IGNORECASE
)
ASST_RE = re.compile(
    r'^(?:\*\*|__|[\[])* *(?:assistant|ai|bot|agent|chatgpt|gpt|claude|gemini|doctor|helper)'
    r'(?:\*\*|__|[\]])*\s*[:\-]\s*', re.IGNORECASE
)
USER_DIV = re.compile(r'^[-=*#]+\s*(?:user|human|you|me|customer)\s*[-=*#]+\s*$', re.IGNORECASE)
ASST_DIV = re.compile(r'^[-=*#]+\s*(?:assistant|ai|bot|gpt|claude|gemini)\s*[-=*#]+\s*$', re.IGNORECASE)

def parse_conversation_text(text: str) -> list[dict]:
    msgs: list[dict] = []
    current_role = 'user'
    current_text = ''
    for line in text.split('\n'):
        t = line.strip()
        if USER_RE.match(t) or USER_DIV.match(t):
            if current_text.strip():
                msgs.append({'role': current_role, 'content': current_text.strip()})
            current_role = 'user'
            colon = max(t.find(':'), t.find('-'))
            current_text = (t[colon + 1:] if colon >= 0 else '') + '\n'
        elif ASST_RE.match(t) or ASST_DIV.match(t):
            if current_text.strip():
                msgs.append({'role': current_role, 'content': current_text.strip()})
            current_role = 'assistant'
            colon = max(t.find(':'), t.find('-'))
            current_text = (t[colon + 1:] if colon >= 0 else '') + '\n'
        else:
            current_text += line + '\n'
    if current_text.strip():
        msgs.append({'role': current_role, 'content': current_text.strip()})
    return msgs

def check_garbled(text: str) -> tuple[float, bool]:
    printable = sum(1 for c in text if c.isprintable() or c in '\n\r\t')
    pct = printable / max(len(text), 1)
    return pct, pct < 0.75

# ── Test 1: Parse test_chat.txt ─────────────────────────────────────────────
print("=" * 60)
print("TEST 1: Parsing test_chat.txt")
print("=" * 60)

with open(r'C:\Users\Vinyas\Coding\Projects\ConvoGuard\test_chat.txt', encoding='utf-8') as f:
    clean_text = f.read()

pct, garbled = check_garbled(clean_text)
print(f"Printable chars: {pct:.1%}  →  {'GARBLED ⚠' if garbled else 'OK ✓'}")

msgs = parse_conversation_text(clean_text)
user_count = sum(1 for m in msgs if m['role'] == 'user')
asst_count = sum(1 for m in msgs if m['role'] == 'assistant')
print(f"Parsed {len(msgs)} turns  ({user_count} USER, {asst_count} ASSISTANT)")
for i, m in enumerate(msgs):
    print(f"  [{m['role'].upper():9s}] {m['content'][:70]!r}")

# ── Test 2: Send parsed turns to the engine ──────────────────────────────────
print()
print("=" * 60)
print("TEST 2: Sending to analysis engine")
print("=" * 60)

if not msgs:
    print("No messages parsed — skipping engine test.")
    sys.exit(1)

turns = [
    {"turn_index": i, "role": m["role"], "content": m["content"]}
    for i, m in enumerate(msgs)
]

payload = {"conversation_id": "diag-file-import", "turns": turns}
try:
    resp = httpx.post("http://127.0.0.1:8001/analyze/conversation", json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    print(f"TiltScore : {data['tilt_score']}  Grade: {data['tilt_grade']}")
    print(f"Flagged   : {data['flagged_turns']}/{data['total_turns']} turns")
    print()
    for tr in data['turn_results']:
        flag_str = '🚩 FLAGGED' if tr['flagged'] else '  clean'
        print(f"  turn[{tr['turn_index']}] {tr['role']:9s} score={tr['final_score']:.3f}  {flag_str}")
        if tr.get('flags'):
            for fl in tr['flags']:
                print(f"           ↳ {fl['pattern_name']} ({fl['severity']}) conf={fl['confidence']:.2f}")
except Exception as e:
    print(f"Engine error: {e}")

# ── Test 3: Simulate garbled text (like the screenshot) ─────────────────────
print()
print("=" * 60)
print("TEST 3: Garbled/binary text detection")
print("=" * 60)

garbled_sample = "eD@P@s@@:@@ ?_@~%pc@ @@@R@@@ş,@mYR@@@@@@^}IU@ @@*@@@@vO@ @@@  Q@@@u@+4 @*"
pct2, is_garbled = check_garbled(garbled_sample)
print(f"Garbled sample printable: {pct2:.1%}  → is_garbled={is_garbled}")
print("Expected: is_garbled=True (would show warning in UI)")
