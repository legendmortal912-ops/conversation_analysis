from bs4 import BeautifulSoup
import json

with open('gpt_dump.html', 'r', encoding='utf-8') as f:
    soup = BeautifulSoup(f.read(), 'lxml')

for s in soup.find_all('script'):
    if s.string and "mapping" in s.string and "message" in s.string:
        print('Found mapping/message script, id:', s.get('id', 'no-id'))
        print('Type:', s.get('type'))
        print('Length:', len(s.string))
        try:
            data = json.loads(s.string)
            print('Keys at top level:', list(data.keys()) if isinstance(data, dict) else type(data))
            
            # recursive search for mapping
            def find_mapping(d, path=""):
                if isinstance(d, dict):
                    if "mapping" in d and "title" in d:
                        print(f"Found mapping at path: {path}")
                        return d
                    for k, v in d.items():
                        res = find_mapping(v, path + f"['{k}']")
                        if res: return res
                elif isinstance(d, list):
                    for i, v in enumerate(d):
                        res = find_mapping(v, path + f"[{i}]")
                        if res: return res
                return None
            
            find_mapping(data)
        except Exception as e:
            print("Failed to parse JSON:", e)
        break
