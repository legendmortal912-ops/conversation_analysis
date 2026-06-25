import asyncio
import httpx
from bs4 import BeautifulSoup
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

async def main():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Encoding': 'gzip, deflate',
    }
    async with httpx.AsyncClient(follow_redirects=True) as client:
        r2 = await client.get('https://gemini.google.com/share/e0f5b12a8385', headers=headers)
        soup = BeautifulSoup(r2.text, 'lxml')
        print('Title:', soup.title.string if soup.title else None)
        
        print("Finding script nodes...")
        for s in soup.find_all('script'):
            if s.string and "[\"USER\"" in s.string and "[\"MODEL\"" in s.string:
                print('Found potential chat in script! Length:', len(s.string))
                print('Snippet:', s.string[:200])
                break
        else:
            print("No script tags matched JSON array.")

        print("Trying CSS classes for Gemini...")
        # Gemini structure: 
        # User message: div.user-query-text
        # Model message: div.model-response-text
        user_queries = soup.select('div.query-content, div.message-content')
        if not user_queries:
            user_queries = soup.find_all(string=re.compile("As an AI|How can I help"))
            print("Fallback strings:", len(user_queries))
            
        print("Soup extraction test:", soup.get_text()[:500].strip())

asyncio.run(main())
