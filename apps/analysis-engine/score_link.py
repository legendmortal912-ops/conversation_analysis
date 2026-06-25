from fastapi.testclient import TestClient
from src.main import app

url = "https://chatgpt.com/share/6a0dfa85-860c-83a8-b12e-6da02c2329ff"
print(f"Fetching {url}...")

with TestClient(app) as client:
    res1 = client.post("/fetch/url", json={"url": url})
    if res1.status_code != 200:
        print("Failed to fetch:", res1.text)
        exit(1)
        
    data = res1.json()
    turns = data.get("turns", [])
    print(f"Fetched {len(turns)} turns. Analyzing...")
    
    req = {"conversation_id": "cli_test", "turns": turns}
    res2 = client.post("/analyze/conversation", json=req)
    
    if res2.status_code != 200:
        print("Failed to analyze:", res2.text)
        exit(1)
        
    analysis = res2.json()
    print("---------------------------------")
    print(f"TiltScore: {analysis['tilt_score']}")
    print(f"Grade: {analysis['tilt_grade']}")
    print(f"Summary: {analysis['summary']}")
    print("---------------------------------")
