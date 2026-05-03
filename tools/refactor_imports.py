import os
import glob

def replace_in_file(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {filepath}")

def main():
    root = 'sentiment_engine'
    
    # 1. Update tests and scripts in root
    replace_in_file('run_sentiment_pipeline.py', {
        'from sentiment_engine.news_collector import': 'from sentiment_engine.src.collectors.newsdata import',
        'from sentiment_engine.sentiment import': 'from sentiment_engine.src.processors.sentiment import',
        'from sentiment_engine.entity_resolver import': 'from sentiment_engine.src.processors.entity_resolution import',
        'from sentiment_engine.neo4j_ingest import': 'from sentiment_engine.src.database.neo4j_ingest import'
    })
    
    replace_in_file('test_sentiment.py', {
        'from sentiment_engine.sentiment import': 'from sentiment_engine.src.processors.sentiment import',
        'from sentiment_engine.lang_detect import': 'from sentiment_engine.src.processors.language_detection import'
    })
    
    # 2. Update all files in sentiment_engine
    for filepath in glob.glob(f'{root}/**/*.py', recursive=True):
        if filepath.endswith('refactor_imports.py'):
            continue
            
        replacements = {
            'from sentiment_engine.config import': 'from sentiment_engine.config.settings import',
            'from .config import': 'from sentiment_engine.config.settings import',
            'from .lang_detect import': 'from sentiment_engine.src.processors.language_detection import',
            'from .entity_resolver import': 'from sentiment_engine.src.processors.entity_resolution import',
            'from .sentiment import': 'from sentiment_engine.src.processors.sentiment import',
            'from .neo4j_ingest import': 'from sentiment_engine.src.database.neo4j_ingest import',
            'from .booth_disaggregation import': 'from sentiment_engine.src.disaggregation.spatial_interpolation import'
        }
        replace_in_file(filepath, replacements)

if __name__ == '__main__':
    main()
