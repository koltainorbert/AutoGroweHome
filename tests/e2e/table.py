import json,sys
rows=json.load(open(sys.argv[1]))
print(f"{'méret':16}{'nézet':8}{'docX':>5}{'túllóg':>7}{'<24px':>6}{'<44px':>6}/{'cél':<4}{'zoom':>5}{'apró':>5}{'kons':>5}")
for r in rows: print(f"{r['size']:16}{r['view']:8}{r['docOverflowX']:>5}{r['overflow']:>7}{r['lt24']:>6}{r['lt44']:>6}/{r['targets']:<4}{r['zoomInputs']:>5}{r['tinyText']:>5}{r['console']:>5}")
ex={}
for r in rows:
  for k in ('overflowEx','lt24Ex','tinyEx'):
    for e in r[k]: ex.setdefault(k,set()).add(e)
for k,v in ex.items(): print(k, sorted(v)[:10])
