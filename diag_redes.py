import json, urllib.request, datetime as dt
S = "https://jusnoticias.pages.dev"
def pedir(r):
    try:
        with urllib.request.urlopen(urllib.request.Request(S + r, headers={"User-Agent": "diag"}), timeout=150) as x:
            return json.load(x)
    except Exception as e:
        return {"_error": str(e)}
desde = (dt.date.today() - dt.timedelta(days=30)).isoformat()
d = pedir(f"/api/redes?desde={desde}")
print("== /api/redes (30 días) errores:", json.dumps(d.get("errores"), ensure_ascii=False)[:800], d.get("_error", ""))
for red, v in (d.get("redes") or {}).items():
    fs = v.get("filas") or []
    otros = {k: v.get(k) for k in ("seguidores", "seguidoresPorCuenta", "insights", "insightsDesde", "insightsHasta", "parcial", "cuentas") if k in v}
    print(red, "| publicaciones 30 días:", len(fs), "|", json.dumps(otros, ensure_ascii=False)[:600])
    def num(f, k):
        x = f.get(k); return x if isinstance(x, (int, float)) else None
    for k in ("me_gusta", "comentarios", "compartidos", "vistas"):
        vs = [num(f, k) for f in fs if num(f, k) is not None]
        if vs: print("   ", k, "promedio", round(sum(vs) / len(vs), 1), "sobre", len(vs))
pv = pedir("/api/panel-vivo")
print("== panel-vivo", pv.get("_error", ""))
for c in pv.get("cuentas", []): print("  ", c.get("red"), c.get("cuenta"), "ok" if c.get("ok") else c.get("error"), "| seguidores:", c.get("seguidores"), "| última:", c.get("ultimaPublicacion"), "| 7 días:", c.get("publicaciones7d") or c.get("publicaciones"))
plan = pedir("/api/compartidos?plan=1")
print("== compartidos plan:", json.dumps({k: v for k, v in plan.items() if k != "fuentes"}, ensure_ascii=False)[:500])
tot = {"filas": 0, "fuertes": 0, "conf": 0}
for f in plan.get("fuentes", []):
    for l in range(f["lotes"]):
        x = pedir(f"/api/compartidos?fuente={f['id']}&lote={l}")
        fu = list((x.get("fuentes") or {}).values())
        filas = x.get("filas") or []
        fuertes = [r for r in filas if r.get("verificacion") == "fuerte"]
        conf = [r for r in filas if r.get("medio_publico_nota")]
        tot["filas"] += len(filas); tot["fuertes"] += len(fuertes); tot["conf"] += len(conf)
        print("  ", f["id"], l, fu[0].get("estado") if fu else x.get("_error"), "| revisadas", fu[0].get("revisadas") if fu else "", "| filas", len(filas), "| fuertes", len(fuertes), "| para confirmar", len(conf), "| errores", len((fu[0].get("errores") or {})) if fu else "")
        for r in fuertes + conf: print("      ", r.get("verificacion"), r.get("red"), r.get("cuenta"), r.get("fecha"), r.get("nota_id"), r.get("publicacion_url"))
print("== total", tot)
