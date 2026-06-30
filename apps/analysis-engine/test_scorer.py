from src.scoring import TurnScorer
scorer = TurnScorer()
ml_scores = {'agenda_persistence': 0.50}
rule_scores = {'agenda_persistence': 0.0}
print(scorer.score(ml_scores, rule_scores))
