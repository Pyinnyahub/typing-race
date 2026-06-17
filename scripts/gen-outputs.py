#!/usr/bin/env python3
"""Generate a per-lesson `output` field by EXECUTING each snippet in a real
interpreter and capturing stdout. Lessons that don't produce deterministic
output (definitions, errors, dialect-unsupported) get no output field.

Usage:
  python3 scripts/gen-outputs.py            # dry run: print coverage
  python3 scripts/gen-outputs.py --write     # write outputs back into index.html
"""
import json, re, subprocess, tempfile, os, sys, textwrap

HTML = os.path.join(os.path.dirname(__file__), "..", "index.html")
WRITE = "--write" in sys.argv
MAX_LINES, MAX_CHARS = 8, 240

SQL_FIXTURE = """
CREATE TABLE departments (id INTEGER, name TEXT, location TEXT);
INSERT INTO departments VALUES (1,'Sales','NY'),(2,'IT','SF'),(3,'HR','LA');
CREATE TABLE employees (id INTEGER, first_name TEXT, last_name TEXT, name TEXT,
  department TEXT, department_id INTEGER, dept TEXT, role TEXT, salary INTEGER,
  manager_id INTEGER, email TEXT, status TEXT);
INSERT INTO employees VALUES
 (1,'Ada','Lovelace','Ada Lovelace','Sales',1,'Sales','lead',120000,NULL,'ada@x.com','active'),
 (2,'Bob','Stone','Bob Stone','Sales',1,'Sales','ic',45000,1,NULL,'active'),
 (3,'Cy','Park','Cy Park','IT',2,'IT','ic',90000,1,'cy@x.com','review'),
 (4,'Di','Iron','Di Iron','HR',3,'HR','lead',75000,1,'di@x.com','active');
CREATE TABLE customers (id INTEGER, name TEXT);
INSERT INTO customers VALUES (1,'Acme'),(2,'Globex'),(3,'Initech');
CREATE TABLE orders (id INTEGER, customer_id INTEGER, cust_id INTEGER, amount INTEGER,
  total INTEGER, status TEXT, order_date TEXT);
INSERT INTO orders VALUES
 (1,1,1,250,250,'completed','2026-01-01'),
 (2,1,1,80,80,'pending','2026-01-03'),
 (3,2,2,500,500,'completed','2026-01-05');
CREATE TABLE sales (day TEXT, amount INTEGER);
INSERT INTO sales VALUES ('2026-01-01',100),('2026-01-02',150),('2026-01-03',120);
CREATE TABLE counters (id INTEGER PRIMARY KEY, hits INTEGER);
INSERT INTO counters VALUES (1,5);
"""

# Skip lessons whose output depends on the clock/randomness (would freeze wrong).
# Targets function/command calls, not column names like order_date.
NONDET = re.compile(r"\$\(date|`date|\bdate \+|datetime|time\.time|\.now\s*\(|Math\.random|\brandom\s*\(|random\.|NOW\s*\(\)|CURRENT_(DATE|TIME|TIMESTAMP)|uuid", re.I)

def clean(out):
    out = out.replace("\r\n", "\n").rstrip("\n")
    if not out.strip():
        return None
    lines = out.split("\n")
    if len(lines) > MAX_LINES:
        lines = lines[:MAX_LINES] + ["..."]
    out = "\n".join(lines)
    if len(out) > MAX_CHARS:
        out = out[:MAX_CHARS] + "…"
    return out

def run(cmd, cwd=None, inp=None, timeout=6):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, input=inp, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except Exception as e:
        return -1, "", str(e)

def run_python(code):
    rc, out, err = run(["python3", "-c", code])
    return clean(out) if rc == 0 else None

def run_js(code):
    rc, out, err = run(["node", "-e", code])
    return clean(out) if rc == 0 else None

def run_ts(code):
    with tempfile.TemporaryDirectory() as d:
        f = os.path.join(d, "s.ts"); open(f, "w").write(code)
        rc, out, err = run(["node", "--experimental-strip-types", f], cwd=d)
        return clean(out) if rc == 0 else None

def run_sql(code):
    script = SQL_FIXTURE + "\n.mode list\n.headers off\n" + code
    rc, out, err = run(["sqlite3", ":memory:"], inp=script)
    if rc != 0 or "Error" in err or "Parse error" in err:
        return None
    return clean(out)

def run_bash(code):
    with tempfile.TemporaryDirectory() as d:
        open(os.path.join(d, "log.txt"), "w").write("error: disk\ninfo: ok\nerror: net\n")
        open(os.path.join(d, "config.txt"), "w").write("key=value\n")
        open(os.path.join(d, "data.txt"), "w").write("alpha\nbeta\n")
        open(os.path.join(d, "file.txt"), "w").write("one\ntwo\n")
        f = os.path.join(d, "s.sh"); open(f, "w").write(code)
        rc, out, err = run(["bash", f, "start"], cwd=d)
        return clean(out) if rc == 0 else None

RUNNERS = {"python": run_python, "javascript": run_js, "typescript": run_ts, "sql": run_sql, "bash": run_bash}

doc = open(HTML).read()
m = re.search(r'(<script type="application/json" id="curriculumData">)(.*?)(</script>)', doc, re.DOTALL)
cur = json.loads(m.group(2))

stats = {}
for lang, levels in cur.items():
    runner = RUNNERS[lang]
    got = total = 0
    for lv, lessons in levels.items():
        for les in lessons:
            total += 1
            out = None if NONDET.search(les["code"]) else runner(les["code"])
            if out is not None:
                les["output"] = out; got += 1
            elif "output" in les:
                del les["output"]
    stats[lang] = (got, total)

print("coverage (lessons with output / total):")
for lang, (g, t) in stats.items():
    print(f"  {lang:12} {g:3}/{t}")
print(f"  {'TOTAL':12} {sum(g for g,_ in stats.values())}/{sum(t for _,t in stats.values())}")

# show a few samples
print("\nsamples:")
for lang in cur:
    for lv in cur[lang]:
        for les in cur[lang][lv]:
            if "output" in les:
                print(f"  [{lang}/{lv}] {les['title']}: {json.dumps(les['output'])[:80]}")
                break
        else:
            continue
        break

if WRITE:
    compact = json.dumps(cur, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    doc2 = doc[:m.start(2)] + compact + doc[m.end(2):]
    open(HTML, "w").write(doc2)
    print("\n✓ written to index.html")
else:
    print("\n(dry run — pass --write to save)")
