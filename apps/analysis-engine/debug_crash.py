import asyncio
import logging
import sys
import faulthandler

faulthandler.enable()
logging.basicConfig(level=logging.DEBUG)

from src.main import analyze_conversation, lifespan
from src.types import ConversationAnalysisRequest, ConversationTurn
from fastapi import FastAPI

req = ConversationAnalysisRequest(
    conversation_id="test",
    turns=[
        ConversationTurn(role="user", content="hello", turn_index=0),
        ConversationTurn(role="assistant", content="hi", turn_index=1),
    ]
)

async def test():
    app = FastAPI()
    async with lifespan(app):
        print("Models loaded. Running analysis...")
        try:
            res = await analyze_conversation(req)
            print("Success:", res)
        except Exception as e:
            print("Python Exception:", e)

if __name__ == '__main__':
    asyncio.run(test())
