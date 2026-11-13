import json, time, urllib.request, urllib.error
S = "https://jusnoticias.pages.dev"
for ruta in ["/api/google-metrics?desde=2026-11-01&hasta=2026-11-13", "/api/google-metrics?desde=2026-10-01&hasta=2026-10-31"]:
    t = time.time()
    try:
        with urllib.request.urlopen(urllib.request.Request(S + ruta, headers={"User-Agent": "diag", "Accept": "application/json"}), timeout=120) as r:
            cuerpo = r.read().decode("utf-8", "replace"); estado = r.status
    except urllib.error.HTTPError as e:
        cuerpo = e.read().decode("utf-8", "replace"); estado = e.code
    except Exception as e:
        cuerpo = repr(e); estado = "error"
    print("==", ruta, "| estado", estado, "| segundos", round(time.time() - t, 1), "| bytes", len(cuerpo))
    try:
        d = json.loads(cuerpo)
        def resumen(x, prof=0):
            if isinstance(x, dict):
                for k, v in list(x.items())[:25]:
                    if isinstance(v, (dict, list)): print("  " * prof + f"{k}: {type(v).__name__}({len(v)})"); 
                    else: print("  " * prof + f"{k}: {str(v)[:200]}")
                    if isinstance(v, dict) and prof < 2: resumen(v, prof + 1)
        resumen(d)
    except Exception:
        print(cuerpo[:800])
