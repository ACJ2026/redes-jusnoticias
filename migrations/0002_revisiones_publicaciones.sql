CREATE TABLE IF NOT EXISTS revisiones_publicacion (
  url_key TEXT PRIMARY KEY,
  nota_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  source_url TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('confirmar', 'descartar')),
  medio TEXT NOT NULL,
  origen TEXT NOT NULL DEFAULT 'Sin dato',
  fecha TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  revisado_por TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS revisiones_publicacion_nota
  ON revisiones_publicacion (nota_id, decision);

CREATE TABLE IF NOT EXISTS bitacora_revisiones_publicacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_key TEXT NOT NULL,
  nota_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  source_url TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('confirmar', 'descartar')),
  medio TEXT NOT NULL,
  origen TEXT NOT NULL DEFAULT 'Sin dato',
  fecha TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  revisado_por TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS bitacora_revisiones_publicacion_url
  ON bitacora_revisiones_publicacion (url_key, fecha);
