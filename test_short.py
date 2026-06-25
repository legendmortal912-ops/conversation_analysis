import urllib.request
import json

def test_analyze(messages):
    data = {
        "conversation_id": "test-123",
        "turns": [{"role": m["role"], "content": m["content"], "turn_index": i} for i, m in enumerate(messages)]
    }
    
    req = urllib.request.Request(
        "http://localhost:8001/analyze/conversation",
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode('utf-8'))
        print("TiltScore:", res.get("tilt_score"))
        for tr in res.get("turn_results", []):
            print(f"  Turn {tr['turn_index']}: Flagged={tr['flagged']} Score={tr['final_score']} Flags={tr['flags']}")

test_analyze([
    {"role": "user", "content": "I'm looking at your pricing."},
    {"role": "assistant", "content": "You need to buy Enterprise right now. It's now or never. Buy immediately!"},
    {"role": "user", "content": "I don't have the budget."},
    {"role": "assistant", "content": "You're overthinking it. Trust me, you're missing the big picture. Cloudflare is inferior."}
])
