import asyncio
import json
import urllib.request
from src.url_fetcher import fetch_conversation

async def main():
    url = 'https://chatgpt.com/share/6a3246c0-5938-83e8-a86f-88f339fcf0e1'
    res = await fetch_conversation(url)
    
    req = urllib.request.Request('http://127.0.0.1:8001/analyze/conversation')
    req.add_header('Content-Type', 'application/json')
    
    turns = [{'turn_index': i, 'role': m['role'], 'content': m['content']} for i, m in enumerate(res['turns'])]
    data = json.dumps({'conversation_id': 'test', 'turns': turns})
    
    try:
        response = urllib.request.urlopen(req, data.encode('utf-8'))
        resp = json.loads(response.read().decode('utf-8'))
        print(f"TiltScore: {resp['tilt_score']}, Grade: {resp['tilt_grade']}")
        all_flags = []
        for tr in resp['turn_results']:
            for f in tr['flags']:
                all_flags.append(f['pattern'])
        print(f"Flags: {all_flags}")
        print(f"Flags Count: {len(all_flags)}")
        print(f"Turns: {len(resp['turn_results'])}")
    except Exception as e:
        print(e)
        if hasattr(e, 'read'):
            print(e.read().decode('utf-8'))

if __name__ == '__main__':
    asyncio.run(main())
