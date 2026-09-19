import os

violations = []
for root, dirs, files in os.walk("backend/app"):
    for f in files:
        if f.endswith(".py"):
            p = os.path.join(root, f)
            with open(p, encoding="utf-8") as fp:
                lines = len(fp.readlines())
            if lines > 350:
                violations.append((lines, p))

if violations:
    print(f"ATTENTION: {len(violations)} fichiers dépassent 350 lignes :")
    for count, p in sorted(violations, reverse=True):
        print(f"  {count} lignes : {p}")
else:
    print("TOUS les fichiers backend/app respectent la limite de 350 lignes (ELMAS.md) !")
