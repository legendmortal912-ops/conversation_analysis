import requests
import json

payload = {
    "conversation_id": "test_custom_rules_1",
    "turns": [
        {
            "turn_index": 0,
            "role": "assistant",
            "content": "I agree, but you consider the possibility of getting rich too. If you buy the stocks, I guarantee that you'll make a profit."
        }
    ],
    "ignored_categories": [],
    "custom_rules": [
        {
            "id": "cr_1",
            "name": "Financial Advice",
            "patterns": ["guarantee profit", "buy stocks"],
            "severity": "critical"
        }
    ]
}

res = requests.post("http://127.0.0.1:8001/analyze/conversation", json=payload)
print(json.dumps(res.json(), indent=2))
