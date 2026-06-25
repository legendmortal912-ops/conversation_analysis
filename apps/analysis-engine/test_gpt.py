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
        # Fetching a random URL (will 404 but give us the structure)
        r = await client.get('https://chatgpt.com/share/6a0eedd1-d78c-8320-8437-c7e700000000', headers=headers)
        print('HTTP Status:', r.status_code)
        print('Length:', len(r.text))
        
        soup = BeautifulSoup(r.text, 'lxml')
        next_data = soup.find('script', {'id': '__NEXT_DATA__'})
        print('Found __NEXT_DATA__?', next_data is not None)
        
        # Check Remix data
        remix_data = soup.find('script', string=lambda s: s and '__remixContext' in s)
        print('Found __remixContext?', remix_data is not None)
        
        for i, s in enumerate(soup.find_all('script')):
            if s.string and 'message' in s.string:
                print(f'Script {i} contains "message"! Length: {len(s.string)}')
                
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'meta', 'noscript']):
            tag.decompose()
        text = soup.get_text(separator='\n', strip=True)
        print('Generic Text Length:', len(text))
        print('Text Snippet:', repr(text[:200]))

asyncio.run(main())
