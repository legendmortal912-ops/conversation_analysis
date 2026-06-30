# ConvoGuard Python SDK

Real-time AI manipulation detection for your chatbots, sales bots, support bots, and AI agents.

## Installation

```bash
pip install convoguard-py
```

## Quick Start

```python
from convoguard import ConvoGuard

# Initialize the client
cg = ConvoGuard(
    api_key="your_api_key_here",
    project_id="your_project_id_here"
)

# Use the context manager to automatically track conversations
with cg.conversation() as conv:
    
    # 1. Log the user's input
    cg.add_turn(conv.id, "user", "Hello, I need some help!")
    
    # 2. Log your AI's response to get real-time manipulation analysis
    result = cg.add_turn(conv.id, "ai", "I can help with that. However, you must upgrade your plan immediately before I can assist you further.")
    
    # 3. Check for any detected manipulation flags
    if result.analysis and result.analysis.flags:
        for flag in result.analysis.flags:
            print(f"Warning: {flag.pattern} ({flag.severity}) - {flag.explanation}")

```

## Features
- Detects False Urgency, Opinion Injection, Topic Hijacking, Concern Dismissal, and Agenda Persistence.
- Real-time analysis of AI-generated responses.
- Syncs seamlessly with your ConvoGuard dashboard.
