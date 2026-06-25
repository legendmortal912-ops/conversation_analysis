import asyncio
import httpx
from bs4 import BeautifulSoup
import sys

sys.stdout.reconfigure(encoding='utf-8')

async def main():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Encoding': 'gzip, deflate',
    }
    async with httpx.AsyncClient(follow_redirects=True) as client:
        r = await client.get('https://chatgpt.com/share/6a0eedd1-d78c-8320-8437-c7e700000000', headers=headers)
        soup = BeautifulSoup(r.text, 'lxml')
        scripts = soup.find_all('script')
        for i, s in enumerate(scripts):
            if s.string and '"message"' in s.string:
                print(f'Script {i} snippet:', s.string[:500])

asyncio.run(main())
