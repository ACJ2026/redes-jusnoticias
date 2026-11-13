// Reporte mensual para imprimir o guardar en PDF (auditoría 13/11/2026, mejora 4, OK de Ignacio).
// Usa los mismos cálculos del tablero (window.__tablero.calc), así los números coinciden con lo que
// se ve en pantalla. No guarda nada ni cambia qué se cuenta. Un dato que falta nunca es 0.
(function () {
  const T = window.__tablero;
  const boton = document.getElementById('pl-reporte-btn');
  if (!T || !boton) return;
  const { D, st, meses, calc, mesLargo, cap, nf, TIPOS } = T;
  const fmt = n => typeof n === 'number' && isFinite(n) ? nf.format(n) : '—';
  const pct = (a, b) => b ? Math.round(a / b * 100) : null;
  const pctTxt = v => v === null ? '—' : v + ' %';
  const nombreMes = m => cap(mesLargo(m)) + ' ' + m.slice(0, 4);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // Cálculo de un mes con la misma función del tablero; se restaura el período elegido sin redibujar.
  const calcMes = m => {
    const antes = [st.desde, st.hasta];
    st.desde = m; st.hasta = m;
    try { return calc(); } finally { [st.desde, st.hasta] = antes; }
  };
  const indicadores = m => {
    const c = calcMes(m);
    const mediosPorNota = c.notas ? Math.round(c.notasP.reduce((s, n) => s + n.n_medios, 0) / c.notas * 10) / 10 : null;
    const citan = (c.cadena[0] || {}).n || 0;
    return { c, mediosPorNota, atribucion: pct(citan, c.publicaciones), citan };
  };
  // Días entre la nota y la publicación del medio (fecha_medio se guarda desde el 13/11/2026).
  const demora = m => {
    const fechaNota = new Map(D.notas.filter(n => n.mes === m).map(n => [Number(n.id), n.fecha]));
    const dias = D.repercusion
      .filter(r => r.fecha_medio && r.confianza !== 'Baja' && /^https?:\/\//i.test(String(r.url || '')) && fechaNota.has(Number(r.nota_id)))
      .map(r => Math.round((Date.parse(r.fecha_medio) - Date.parse(fechaNota.get(Number(r.nota_id)))) / 864e5))
      .filter(d => d >= 0)
      .sort((a, b) => a - b);
    if (!dias.length) return null;
    const mediana = dias.length % 2 ? dias[(dias.length - 1) / 2] : (dias[dias.length / 2 - 1] + dias[dias.length / 2]) / 2;
    return { n: dias.length, mediana, mismoDia: pct(dias.filter(d => d === 0).length, dias.length) };
  };
  const mesPorDefecto = () => {
    const actual = new Date().toISOString().slice(0, 7);
    const completos = meses.filter(m => m < actual);
    return completos.length ? completos[completos.length - 1] : meses[meses.length - 1];
  };
  const fechaCorte = () => {
    const f = D.datos_actualizados;
    if (!f) return '';
    try { return new Date(f).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }); } catch { return f; }
  };

  const armarHtml = m => {
    const i = meses.indexOf(m);
    const prev = i > 0 ? meses[i - 1] : null;
    const a = indicadores(m), p = prev ? indicadores(prev) : null;
    const c = a.c;
    const comp = (v, vp, unidad) => {
      if (vp === null || vp === undefined || v === null || v === undefined) return '—';
      const d = Math.round((v - vp) * 10) / 10;
      return (d > 0 ? '+' : '') + nf.format(d) + (unidad || '');
    };
    const filas = [
      ['Notas publicadas', fmt(c.notas), p ? fmt(p.c.notas) : '—', p ? comp(c.notas, p.c.notas) : '—'],
      ['Notas que salieron en otro medio', fmt(c.notasConRepercusion) + ' (' + pctTxt(c.notas ? c.pct : null) + ')', p ? fmt(p.c.notasConRepercusion) + ' (' + pctTxt(p.c.notas ? p.c.pct : null) + ')' : '—', p && c.notas && p.c.notas ? comp(c.pct, p.c.pct, ' puntos') : '—'],
      ['Publicaciones en medios', fmt(c.publicacionesDetectadas), p ? fmt(p.c.publicacionesDetectadas) : '—', p ? comp(c.publicacionesDetectadas, p.c.publicacionesDetectadas) : '—'],
      ['Medios distintos', fmt(c.mediosDetectados), p ? fmt(p.c.mediosDetectados) : '—', p ? comp(c.mediosDetectados, p.c.mediosDetectados) : '—'],
      ['Medios por nota (promedio)', fmt(a.mediosPorNota), p ? fmt(p.mediosPorNota) : '—', p ? comp(a.mediosPorNota, p.mediosPorNota) : '—'],
      ['Publicaciones que nombran a JusNoticias', pctTxt(a.atribucion), p ? pctTxt(p.atribucion) : '—', p ? comp(a.atribucion, p.atribucion, ' puntos') : '—'],
      ['Publicaciones con copia textual', pctTxt(c.publicaciones ? c.pct_copia : null), p ? pctTxt(p.c.publicaciones ? p.c.pct_copia : null) : '—', p && c.publicaciones && p.c.publicaciones ? comp(c.pct_copia, p.c.pct_copia, ' puntos') : '—']
    ];
    const tipos = c.tipo.map(t => `<tr><td>${esc(t.tipo)}</td><td class="n">${fmt(t.notas)}</td><td class="n">${fmt(t.levantadas)}</td><td class="n">${t.notas ? t.pct + ' %' : '—'}</td></tr>`).join('');
    const topMedios = c.porMedio.slice(0, 5).map(x => `<tr><td>${esc(x.medio)}</td><td class="n">${fmt(x.notas)}</td></tr>`).join('') || '<tr><td colspan="2">Sin publicaciones en el mes.</td></tr>';
    const topNotas = c.notasP.filter(n => n.n_medios > 0).sort((x, y) => y.n_medios - x.n_medios || x.fecha.localeCompare(y.fecha)).slice(0, 5)
      .map(n => `<tr><td>${esc(n.fecha.slice(8, 10) + '/' + n.fecha.slice(5, 7))}</td><td>${esc(n.titulo)}</td><td class="n">${fmt(n.n_medios)}</td></tr>`).join('') || '<tr><td colspan="3">Ninguna nota salió en otros medios.</td></tr>';
    const dm = demora(m);
    const demoraTxt = dm
      ? `Mediana: ${nf.format(dm.mediana)} ${dm.mediana === 1 ? 'día' : 'días'} entre nuestra nota y la publicación del medio. El ${dm.mismoDia} % salió el mismo día (sobre ${fmt(dm.n)} publicaciones con fecha).`
      : 'Sin datos todavía: la fecha de publicación de cada medio se registra desde el 13/11/2026.';
    const corte = fechaCorte();
    const actual = new Date().toISOString().slice(0, 7);
    const parcial = m >= actual ? '<p class="aviso">El mes todavía no terminó: las cifras pueden cambiar.</p>' : '';
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reporte de repercusión · ${esc(nombreMes(m))}</title>
<style>
:root{--ink:#16232e;--muted:#55636f;--line:#d5dce2;--accent:#1d5b79;--bg:#fff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:820px;margin:0 auto;padding:28px 16px 40px}
.kicker{margin:0;color:var(--muted);font-size:12px;letter-spacing:.06em;text-transform:uppercase}
h1{margin:4px 0 2px;font:400 26px/1.25 Georgia,"Times New Roman",serif}h2{margin:26px 0 8px;font-size:16px}
.sub{margin:0 0 18px;color:var(--muted);font-size:13px}.aviso{margin:0 0 14px;padding:8px 12px;border-left:3px solid var(--accent);background:#eef4f7;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:12px;color:var(--muted);font-weight:600}td.n,th.n{text-align:right;white-space:nowrap}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.nota{color:var(--muted);font-size:12.5px}
.acciones{display:flex;gap:8px;margin:0 0 18px}.acciones button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;min-height:40px}
@media(max-width:600px){.grid{grid-template-columns:1fr}table{font-size:13px}}
@media print{.acciones{display:none}main{padding:0}body{font-size:12.5px}h2{break-after:avoid}tr{break-inside:avoid}}
</style></head><body><main>
<div class="acciones"><button type="button" onclick="window.print()">Imprimir o guardar en PDF</button></div>
<p class="kicker">Poder Judicial del Chubut · Agencia de Comunicación Judicial</p>
<h1>Repercusión de Juschubut Noticias · ${esc(nombreMes(m))}</h1>
<p class="sub">Datos del tablero de repercusión${corte ? ', relevamiento del ' + esc(corte.replace(/\.$/, '')) : ''}.${prev ? ' Se compara con ' + esc(mesLargo(prev)) + '.' : ''}</p>
${parcial}
<h2>Indicadores del mes</h2>
<table><thead><tr><th>Indicador</th><th class="n">${esc(cap(mesLargo(m)))}</th><th class="n">${prev ? esc(cap(mesLargo(prev))) : 'Mes anterior'}</th><th class="n">Diferencia</th></tr></thead><tbody>
${filas.map(f => `<tr><td>${esc(f[0])}</td><td class="n">${esc(f[1])}</td><td class="n">${esc(f[2])}</td><td class="n">${esc(f[3])}</td></tr>`).join('')}
</tbody></table>
<h2>Por tipo de nota</h2>
<table><thead><tr><th>Tipo</th><th class="n">Notas</th><th class="n">Salieron en otro medio</th><th class="n">%</th></tr></thead><tbody>${tipos}</tbody></table>
<div class="grid"><div><h2>Medios que más notas publicaron</h2>
<table><thead><tr><th>Medio</th><th class="n">Notas</th></tr></thead><tbody>${topMedios}</tbody></table></div>
<div><h2>Cuánto tardan los medios</h2><p>${esc(demoraTxt)}</p></div></div>
<h2>Notas que salieron en más medios</h2>
<table><thead><tr><th>Fecha</th><th>Nota</th><th class="n">Medios</th></tr></thead><tbody>${topNotas}</tbody></table>
<h2>Cómo leer este reporte</h2>
<p class="nota">Las cifras son un mínimo detectado, no el total real: el tablero no ve radio y TV fuera de la web, grupos privados ni contenido no indexado. Se cuentan las publicaciones del mismo día de la nota o posteriores, con enlace, verificadas y a verificar, igual que en el tablero. Cada medio cuenta una vez por nota. «Nombran a JusNoticias» indica que el texto del medio cita a Juschubut Noticias o a la Agencia de Comunicación Judicial. Las redes sociales se informarán por separado.</p>
</main></body></html>`;
  };

  // Ventana para elegir el mes.
  const dlg = document.createElement('dialog');
  dlg.className = 'pl-modal'; dlg.id = 'pl-reporte'; dlg.setAttribute('aria-labelledby', 'pl-reporte-titulo');
  dlg.innerHTML = '<div class="pl-cajon-cab"><h2 id="pl-reporte-titulo">Reporte mensual</h2><button class="btn" type="button" id="pl-reporte-cerrar" aria-label="Cerrar">✕</button></div>'
    + '<p class="note">Arma un reporte de un mes con los indicadores del tablero, para imprimir o guardar en PDF. Usa los mismos datos que se ven en pantalla.</p>'
    + '<label class="lbl" for="pl-reporte-mes">Mes</label><select id="pl-reporte-mes"></select>'
    + '<p><button class="btn accion" type="button" id="pl-reporte-abrir">Abrir reporte</button></p><p class="note" id="pl-reporte-estado" role="status"></p>';
  document.body.append(dlg);
  const sel = dlg.querySelector('#pl-reporte-mes');
  meses.slice().reverse().forEach(m => sel.append(new Option(nombreMes(m), m)));
  const abrir = () => {
    const html = armarHtml(sel.value);
    const w = window.open('', '_blank');
    if (!w) { dlg.querySelector('#pl-reporte-estado').textContent = 'El navegador bloqueó la ventana nueva: permití las ventanas emergentes para este sitio.'; return; }
    w.document.open(); w.document.write(html); w.document.close();
  };
  dlg.querySelector('#pl-reporte-abrir').addEventListener('click', abrir);
  dlg.querySelector('#pl-reporte-cerrar').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });
  boton.addEventListener('click', () => {
    sel.value = mesPorDefecto();
    dlg.querySelector('#pl-reporte-estado').textContent = '';
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  });
  // Para las pruebas: arma el HTML de un mes sin abrir ventanas.
  window.__reporteMensual = { armarHtml, indicadores, demora, mesPorDefecto };
})();
