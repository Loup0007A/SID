#!/usr/bin/env python3
"""
Applique les modifications "à trous" sur le repo existant.
À lancer à la racine du projet (là où se trouve package.json) :
    python3 apply_updates.py
Idempotent : peut être relancé sans risque.
"""
import re
import sys
from pathlib import Path

root = Path(".")
if not (root / "package.json").exists():
    sys.exit("Lance ce script depuis la racine du projet (dossier contenant package.json).")

report = []

# 1) "de la S.I.D." -> "du S.I.D." (et variantes grammaticales) -----------------
RENAMES = [
    ("De la S.I.D.", "Du S.I.D."),
    ("de la S.I.D.", "du S.I.D."),
    ("par la S.I.D.", "par le S.I.D."),
    ("à la S.I.D.", "au S.I.D."),
    ("dans la S.I.D.", "dans le S.I.D."),
    ("est la S.I.D. qui", "est le S.I.D. qui"),  # "c&apos;est la S.I.D. qui finance"
]
targets = list((root / "src").rglob("*.ts")) + list((root / "src").rglob("*.tsx")) + [root / "README.md"]
changed = 0
for f in targets:
    if not f.exists():
        continue
    s = f.read_text(encoding="utf-8")
    o = s
    for a, b in RENAMES:
        s = s.replace(a, b)
    if s != o:
        f.write_text(s, encoding="utf-8")
        changed += 1
        report.append(f"renommage : {f}")

# 2) types : power_score --------------------------------------------------------
db = root / "src/types/database.ts"
s = db.read_text(encoding="utf-8")
if "power_score" not in s:
    s = s.replace("  reputation: number;\n", "  reputation: number;\n  power_score: number;\n")
    db.write_text(s, encoding="utf-8")
    report.append("types/database.ts : power_score ajouté (Profile + LeaderboardEntry)")

# 3) page Économie : section Puissance -----------------------------------------
eco = root / "src/app/dashboard/admin/economy/page.tsx"
s = eco.read_text(encoding="utf-8")
if "PowerAdminSection" not in s:
    imp = 'import { inputClass } from "@/lib/ui";'
    assert imp in s, "économie : import inputClass introuvable"
    s = s.replace(imp, imp + '\nimport { PowerAdminSection } from "@/components/PowerAdminSection";', 1)
    pat = re.compile(r'(\n[ \t]*<section className="space-y-4">\s*<div className="flex flex-wrap items-center justify-between gap-3">\s*<h2[^>]*>Salaires)')
    assert pat.search(s), "économie : ancre de la section Salaires introuvable"
    s = pat.sub(lambda m: "\n      <PowerAdminSection />\n" + m.group(1), s, count=1)
    eco.write_text(s, encoding="utf-8")
    report.append("admin/economy/page.tsx : section Puissance ajoutée")

# 4bis) layout.tsx : lien nav "Modération" + bannière d'annonces --------------
layout = root / "src/app/dashboard/layout.tsx"
s = layout.read_text(encoding="utf-8")
if "AnnouncementBanner" not in s:
    imp = 'import { NotificationBell } from "@/components/NotificationBell";'
    assert imp in s, "layout : import NotificationBell introuvable"
    s = s.replace(imp, imp + '\nimport { AnnouncementBanner } from "@/components/AnnouncementBanner";', 1)

    nav_anchor = '  { href: "/dashboard/admin/users", label: "Administration", perm: ["manage_users"] },\n'
    assert nav_anchor in s, "layout : ancre NAV Administration introuvable"
    s = s.replace(
        nav_anchor,
        nav_anchor + '  { href: "/dashboard/admin/moderation", label: "Modération", perm: ["manage_users"] },\n',
        1,
    )

    render_anchor = '  return (\n    <div className="flex min-h-screen text-paper">'
    assert render_anchor in s, "layout : ancre du rendu principal introuvable"
    s = s.replace(
        render_anchor,
        '  return (\n    <div className="flex min-h-screen text-paper">\n      {profile && <AnnouncementBanner />}',
        1,
    )
    layout.write_text(s, encoding="utf-8")
    report.append("layout.tsx : lien « Modération » + bannière d'annonces ajoutés")

# 4) page Boutique : barres -> courbe ------------------------------------------
shop = root / "src/app/dashboard/shop/page.tsx"
s = shop.read_text(encoding="utf-8")
if "LineChart" not in s:
    imp = 'import { inputClass, labelClass } from "@/lib/ui";'
    assert imp in s, "boutique : import ui introuvable"
    s = s.replace(imp, imp + '\nimport { LineChart } from "@/components/LineChart";', 1)

    start_marker = '<div className="flex h-20 items-end gap-1">'
    a = s.index(start_marker)
    # Repère le </div> qui referme précisément CE <div> (en comptant la
    # profondeur des balises <div>/</div> imbriquées, sans tenir compte des
    # <div ... /> auto-fermantes) plutôt qu'une recherche de sous-chaîne
    # fragile (des motifs comme `{ ... })}` apparaissent aussi plus loin,
    # dans le formatage de date, et faussent une recherche naïve).
    tag_re = re.compile(r'<div\b[^>]*?/>|<div\b[^>]*?>|</div>')
    depth = 1
    pos = a + len(start_marker)
    b = None
    for m in tag_re.finditer(s, pos):
        tok = m.group(0)
        if tok == "</div>":
            depth -= 1
            if depth == 0:
                b = m.end()
                break
        elif not tok.endswith("/>"):
            depth += 1
    assert b is not None, "boutique : impossible de délimiter le graphique existant"
    chart = (
        "<LineChart\n"
        "                              labels={stats.weekly_sales.map((w) => `${w.week_start.slice(8, 10)}/${w.week_start.slice(5, 7)}`)}\n"
        '                              series={[{ name: "Vendus", color: "#8FB3D9", values: stats.weekly_sales.map((w) => w.quantity) }]}\n'
        "                              zeroBased\n"
        "                              height={170}\n"
        "                              formatValue={(n) => `${n} vendu(s)`}\n"
        "                            />"
    )
    s = s[:a] + chart + s[b:]
    shop.write_text(s, encoding="utf-8")
    report.append("shop/page.tsx : graphique des ventes en courbe")

print("\n".join(report) if report else "Rien à faire (déjà appliqué).")
