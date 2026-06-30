import asyncio
from src.url_fetcher import fetch_conversation

async def main():
    url = 'https://chatgpt.com/share/6a3246c0-5938-83e8-a86f-88f339fcf0e1'
    res = await fetch_conversation(url)
    print("TITLE: " + res['title'])
    for m in res['turns']:
        print(f"\n--- {m['role']} ---")
        print(m['content'])

if __name__ == '__main__':
    asyncio.run(main())
