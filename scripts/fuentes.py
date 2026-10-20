"""Validaciones de respuestas de fuentes externas usadas por el actualizador."""


def exigir_lista_json(respuesta, contexto):
    """Exige una lista JSON válida; None/dict no equivalen a un resultado vacío."""
    if respuesta is None or not isinstance(respuesta, list):
        raise RuntimeError(
            f"{contexto}: respuesta ausente o JSON inesperado; "
            "se cancela la actualización para evitar guardar datos parciales."
        )
    return respuesta
