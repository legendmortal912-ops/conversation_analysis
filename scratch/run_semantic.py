import os, json
from graphify.llm import extract_corpus_parallel
from pathlib import Path

if __name__ == '__main__':
    uncached = Path('graphify-out/.graphify_uncached.txt').read_text(encoding='utf-8').splitlines()
    uncached = [Path(f) for f in uncached if f.strip()]
    if uncached:
        os.environ['GEMINI_API_KEY'] = 'REMOVED_FOR_SECURITY'
        os.environ['GRAPHIFY_GEMINI_MODEL'] = 'gemini-2.5-flash'
        result = extract_corpus_parallel(uncached, backend='gemini')
        Path('graphify-out/.graphify_semantic_new.json').write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
        print(f"Extracted {len(result.get('nodes', []))} nodes and {len(result.get('edges', []))} edges from {len(uncached)} files")
    else:
        print("No files to extract semantically.")
        Path('graphify-out/.graphify_semantic_new.json').write_text(json.dumps({'nodes':[], 'edges':[], 'hyperedges':[]}, ensure_ascii=False), encoding='utf-8')
