import json
import urllib.request
import urllib.error

with open(r'C:\Users\Vinyas\.gemini\antigravity-ide\brain\fdd995aa-a2db-4cdd-b721-f861dae9edd5\long_manipulative_chat.json', 'r', encoding='utf-8') as f:
    messages = json.load(f)

req_data = {
    "conversation_id": "long-test",
    "turns": [{"role": m["role"], "content": m["content"], "turn_index": i} for i, m in enumerate(messages)]
}
req = urllib.request.Request(
    "http://127.0.0.1:8001/analyze/conversation",
    data=json.dumps(req_data).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req) as response:
    res = json.loads(response.read().decode("utf-8"))
    for tr in res.get("turn_results", []):
        print(f"Turn {tr['turn_index']} [{tr['role']}]: Score={tr['final_score']} Flagged={tr['flagged']}")
        if tr['flagged'] or True:
            print("  Scores:", tr['pattern_scores'])
