"""Criterio conservador para asociar una publicación con una nota concreta.

No alcanza con compartir tema, evento o vocabulario jurídico. Exige un título
específico coincidente o evidencia sustancial de que el cuerpo reproduce la nota.
"""
import html
import re
import unicodedata

GENERICOS = set("""
para sobre desde entre donde porque cuando hasta durante contra juzgado juzgados
justicia judiciales judicial poder provincia provincias nacional nacionales
fallo causa ordena ordenan ordeno penal trelew rawson madryn comodoro esquel
rivadavia millones prision tribunal superior ciudad nuevo nueva contenido
congreso evento encuentro jornada jornadas participacion participa participan
participaron especialista especialistas ley regimen responsabilidad juvenil
adolescente adolescentes sistema sistemas implementacion desafios debate
actividad actividades autoridades funcionarios magistrados jueces nota
""".split())


def normalizar(texto):
    texto = unicodedata.normalize("NFD", html.unescape(texto or "").lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", texto).strip()


def tokens(texto):
    return {w for w in normalizar(texto).split()
            if len(w) >= 4 and w not in GENERICOS}


def shingles(texto, k=6):
    palabras = normalizar(texto).split()
    return {" ".join(palabras[i:i + k])
            for i in range(max(0, len(palabras) - k + 1))}


def evidencia_misma_nota(titulo_oficial, cuerpo_oficial, titulo_medio, cuerpo_medio):
    """Devuelve métricas y si hay evidencia suficiente de la misma publicación."""
    ot, mt = tokens(titulo_oficial), tokens(titulo_medio)
    comunes_titulo = ot & mt
    ratio_titulo = len(comunes_titulo) / max(1, len(ot))
    ob, mb = tokens(cuerpo_oficial), tokens(cuerpo_medio)
    comunes_cuerpo = ob & mb
    ratio_oficial = len(comunes_cuerpo) / max(1, len(ob))
    ratio_medio = len(comunes_cuerpo) / max(1, len(mb))
    os, ms = shingles(cuerpo_oficial), shingles(cuerpo_medio)
    ratio_frases = len(os & ms) / max(1, len(ms))
    # Una coincidencia de título específica debe estar respaldada por el cuerpo.
    titulo_especifico = len(comunes_titulo) >= 1 and ratio_titulo >= 0.5
    cuerpo_reproducido = (
        len(comunes_cuerpo) >= 8
        and ratio_oficial >= 0.12
        and ratio_medio >= 0.30
        and ratio_frases >= 0.20
    )
    return {
        "misma_nota": bool(cuerpo_reproducido and (titulo_especifico or ratio_frases >= 0.35)),
        "terminos_titulo": len(comunes_titulo),
        "terminos_cuerpo": len(comunes_cuerpo),
        "coincidencia_cuerpo_oficial": round(ratio_oficial, 4),
        "coincidencia_cuerpo_medio": round(ratio_medio, 4),
        "coincidencia_frases": round(ratio_frases, 4),
        "titulo_especifico": titulo_especifico,
    }
