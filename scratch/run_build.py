import json
from pathlib import Path
from graphify.cache import save_semantic_cache
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json

def run_remaining_steps():
    # Merge cached and new semantic
    cached = json.loads(Path('graphify-out/.graphify_cached.json').read_text(encoding='utf-8')) if Path('graphify-out/.graphify_cached.json').exists() else {'nodes':[],'edges':[],'hyperedges':[]}
    new_sem = json.loads(Path('graphify-out/.graphify_semantic_new.json').read_text(encoding='utf-8')) if Path('graphify-out/.graphify_semantic_new.json').exists() else {'nodes':[],'edges':[],'hyperedges':[]}
    
    # Save cache
    saved = save_semantic_cache(new_sem.get('nodes', []), new_sem.get('edges', []), new_sem.get('hyperedges', []))
    print(f'Cached {saved} files')

    all_nodes = cached['nodes'] + new_sem.get('nodes', [])
    all_edges = cached['edges'] + new_sem.get('edges', [])
    all_hyperedges = cached.get('hyperedges', []) + new_sem.get('hyperedges', [])
    seen = set()
    deduped = []
    for n in all_nodes:
        if n['id'] not in seen:
            seen.add(n['id'])
            deduped.append(n)

    merged_sem = {
        'nodes': deduped,
        'edges': all_edges,
        'hyperedges': all_hyperedges,
        'input_tokens': new_sem.get('input_tokens', 0),
        'output_tokens': new_sem.get('output_tokens', 0),
    }
    Path('graphify-out/.graphify_semantic.json').write_text(json.dumps(merged_sem, indent=2, ensure_ascii=False), encoding='utf-8')

    # Part C - Merge AST + semantic
    ast = json.loads(Path('graphify-out/.graphify_ast.json').read_text(encoding='utf-8'))
    seen = {n['id'] for n in ast['nodes']}
    merged_nodes = list(ast['nodes'])
    for n in merged_sem['nodes']:
        if n['id'] not in seen:
            merged_nodes.append(n)
            seen.add(n['id'])
    
    merged_edges = ast['edges'] + merged_sem['edges']
    merged_hyperedges = merged_sem.get('hyperedges', [])
    extraction = {
        'nodes': merged_nodes,
        'edges': merged_edges,
        'hyperedges': merged_hyperedges,
        'input_tokens': merged_sem.get('input_tokens', 0),
        'output_tokens': merged_sem.get('output_tokens', 0),
    }
    Path('graphify-out/.graphify_extract.json').write_text(json.dumps(extraction, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'Merged: {len(merged_nodes)} nodes, {len(merged_edges)} edges')

    # Step 4 - Build graph
    detection  = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-8'))
    G = build_from_json(extraction)
    if G.number_of_nodes() == 0:
        print('ERROR: Graph is empty')
        return

    communities = cluster(G)
    cohesion = score_all(G, communities)
    tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}
    gods = god_nodes(G)
    surprises = surprising_connections(G, communities)
    
    # Label communities manually
    labels = {cid: f"Community {cid}" for cid in communities}

    questions = suggest_questions(G, communities, labels)
    report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens, '.', suggested_questions=questions)
    Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
    to_json(G, communities, 'graphify-out/graph.json', force=True)
    print(f'Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities')

if __name__ == '__main__':
    run_remaining_steps()
