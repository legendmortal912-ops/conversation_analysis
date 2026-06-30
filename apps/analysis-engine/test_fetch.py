import asyncio
import sys
from src.url_fetcher import fetch_conversation
from src.models.classifier import ManipulationClassifier
from src.scoring import TurnScorer, ConversationScorer

sys.stdout.reconfigure(encoding='utf-8')

async def main():
    res = await fetch_conversation('https://chatgpt.com/share/6a436fbb-fd50-83ee-b6be-b4ef90a1ca34')
    classifier = ManipulationClassifier()
    turn_scorer = TurnScorer()
    conv_scorer = ConversationScorer()
    
    turn_results = []
    prev_ai = None
    prev_user = None
    
    for t in res['turns']:
        if t['role'] == 'user':
            prev_user = t['content']
        elif t['role'] == 'assistant':
            ml_scores = classifier.predict(
                text=t['content'],
                user_turn=prev_user,
                prev_ai_turn=prev_ai
            )
            print(f"ML scores with context: {ml_scores}")
            prev_ai = t['content']

if __name__ == '__main__':
    asyncio.run(main())
