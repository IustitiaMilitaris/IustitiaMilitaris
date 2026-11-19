import json
import sys
import re
from datetime import date
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import zibraty
try:
    scenario = json.load(sys.stdin)
    root = zibraty.TUT
    schema = json.loads((root / 'schema.json').read_text(encoding='utf-8'))
    norms = json.loads((root / 'normy.json').read_text(encoding='utf-8'))
    zibraty.validate(scenario, schema, schema, 'scenario')
    if not zibraty.POMYLKY:
        date.fromisoformat(scenario['data_stvorennia'])
        for node in scenario['vuzly']:
            for option in node['varianty']:
                if not re.fullmatch(r'[A-Z][0-9]?', option['id']):
                    zibraty.pomylka('Invalid option ID')
        zibraty.perevirka_zvyazkiv(scenario, {n['id'] for n in norms['normy']}, 'scenario')
    print(json.dumps({'valid': not zibraty.POMYLKY, 'errors': zibraty.POMYLKY}, ensure_ascii=False))
except Exception:
    print(json.dumps({'valid': False, 'errors': ['Invalid scenario structure']}))
