// Panel en vivo de la portada. Toma los datos del tablero (window.__panelVivo) y consulta
// /api/panel-vivo cada 5 minutos. Nunca muestra un dato faltante como 0.
(function () {
  const P = window.__panelVivo;
  const raiz = document.getElementById('panel-vivo');
  if (!P || !raiz) return;
  const { D, esConfirmada, canonMedio, localidadDe, regionMedio } = P;
  const menosMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLOR = { Medios: '#9fdcff', Facebook: '#8fb1ff', Instagram: '#f59ac2', YouTube: '#ff8f8f', TikTok: '#c9f0ef', X: '#d6dde4' };
  const fmt = n => typeof n === 'number' ? n.toLocaleString('es-AR') : '—';
  const corto = n => typeof n === 'number' ? (n >= 1000 ? (n / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' mil' : n.toLocaleString('es-AR')) : '—';
  const ddmm = f => f ? f.slice(8, 10) + '/' + f.slice(5, 7) : '';
  const hhmm = iso => { try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }); } catch { return ''; } };
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const hoy = new Date().toISOString().slice(0, 10);
  const restar = (f, d) => { const x = new Date(f + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() - d); return x.toISOString().slice(0, 10); };

  // ---- Datos del relevamiento (se actualizan cada 4 h) ----
  const notas = D.notas.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || Number(b.id) - Number(a.id));
  const notaPorId = new Map(notas.map(n => [Number(n.id), n]));
  const filas = D.repercusion.filter(r => r.confianza !== 'Baja' && r.url && notaPorId.has(Number(r.nota_id)));
  const filasDe = id => filas.filter(r => Number(r.nota_id) === Number(id));
  const ultima = notas[0];

  // ---- Estructura ----
  raiz.replaceChildren();
  const top = el('div', 'pv-top');
  const vivo = el('span', 'pv-vivo pv-mono');
  const punto = el('span', 'pv-punto apagado'); punto.setAttribute('aria-hidden', 'true');
  const estado = el('span', '', 'en vivo · consultando…'); estado.setAttribute('role', 'status');
  vivo.append(punto, estado);
  const chips = el('div', 'pv-chips');
  ['Medios', 'Facebook', 'Instagram', 'YouTube', 'TikTok', 'X'].forEach(n => { const c = el('span', 'pv-chip pv-mono'); c.dataset.red = n; const i = el('i'); i.style.background = COLOR[n]; c.append(i, n); chips.append(c); });
  top.append(vivo, chips);
  const h2 = el('h2', '', 'Cómo se mueve la última nota');
  const sub = el('p', 'pv-sub', ultima ? `«${ultima.titulo}» · ${ddmm(ultima.fecha)}` : 'Todavía no hay notas registradas.');

  const etapas = el('div', 'pv-etapas');
  const crearEtapa = nombre => { const e = el('article', 'pv-etapa'); const v = el('div', 'pv-valor', '—'); const d = el('div', 'pv-det', ''); e.append(el('span', 'pv-mono', nombre), v, d); return { e, v, d }; };
  const E = [crearEtapa('Nota'), crearEtapa('Medios que la publicaron'), crearEtapa('Fuera de Chubut'), crearEtapa('Redes · en vivo')];
  const conectores = [];
  E.forEach((s, i) => { etapas.append(s.e); if (i < E.length - 1) { const c = el('div', 'pv-con'); c.setAttribute('aria-hidden', 'true'); conectores.push(c); etapas.append(c); } });

  // En celular (≤ 480 px) el recorrido se muestra en una sola tarjeta, con puntitos de progreso.
  const movil = el('article', 'pv-movil');
  movil.setAttribute('aria-roledescription', 'recorrido de la última nota');
  const mEtapa = el('span', 'pv-mono pv-m-etapa'); const mTitulo = el('p', 'pv-m-titulo', ultima ? ultima.titulo : '');
  const mValor = el('div', 'pv-valor pv-m-valor', '—'); const mDet = el('div', 'pv-det pv-m-det', '');
  const mPuntos = el('div', 'pv-m-puntos'); mPuntos.setAttribute('aria-hidden', 'true');
  E.forEach(() => mPuntos.append(el('i')));
  movil.append(mEtapa, mTitulo, mValor, mDet, mPuntos);
  const grilla = el('div', 'pv-grilla');
  const cajaLista = el('section', 'pv-caja pv-entrando'); cajaLista.append(el('h3', 'pv-mono', 'Repercusiones entrando'));
  const ventana = el('div', 'pv-lista-ventana'); const lista = el('ul', 'pv-lista'); ventana.append(lista); cajaLista.append(ventana);
  const lado = el('div', 'pv-lado');
  const cajaRedes = el('section', 'pv-caja'); const tituloRedes = el('h3', 'pv-mono', 'Redes en vivo'); const ulRedes = el('ul', 'pv-redes'); cajaRedes.append(tituloRedes, ulRedes);
  const cajaMedios = el('section', 'pv-caja'); cajaMedios.append(el('h3', 'pv-mono', 'Medios con más notas · 7 días'));
  const cajaVol = el('section', 'pv-caja'); cajaVol.append(el('h3', 'pv-mono', 'Volumen · últimos 14 días'));
  const cajaVer = el('section', 'pv-caja'); cajaVer.append(el('h3', 'pv-mono', 'Verificación · 7 días'));
  lado.append(cajaRedes, cajaMedios, cajaVol, cajaVer);
  grilla.append(cajaLista, lado);
  const pie = el('p', 'pv-pie', `Medios: último relevamiento guardado (${D.actualizado || 'sin fecha'}), se revisa cada 4 h. Redes: consulta en vivo cada 5 minutos. «Interacción alta, media o baja» compara cada publicación con las demás del mismo canal; es solo una ayuda visual y no entra en ninguna cifra.`);
  raiz.append(top, h2, sub, etapas, movil, grilla, pie);
  raiz.hidden = false;

  // ---- Etapas 1 a 3 (relevamiento) ----
  let redesVivo = null;
  const pintarEtapas = () => {
    if (!ultima) return;
    E[0].v.textContent = ddmm(ultima.fecha); E[0].v.classList.remove('texto');
    E[0].d.textContent = ultima.titulo.length > 90 ? ultima.titulo.slice(0, 88) + '…' : ultima.titulo;
    const rs = filasDe(ultima.id);
    const medios = [...new Set(rs.map(r => canonMedio(r.medio)))];
    const verificados = new Set(rs.filter(esConfirmada).map(r => canonMedio(r.medio)));
    if (medios.length) { E[1].v.textContent = fmt(medios.length); E[1].d.textContent = `${fmt(verificados.size)} verificados · ${fmt(medios.length - verificados.size)} a verificar`; }
    else { E[1].v.textContent = 'Todavía ninguno'; E[1].v.classList.add('texto'); E[1].d.textContent = 'El sistema la sigue buscando en cada revisión.'; }
    const conSede = medios.filter(m => localidadDe(m));
    const fuera = conSede.filter(m => regionMedio(localidadDe(m)) !== 'Chubut');
    const sinSede = medios.length - conSede.length;
    if (!medios.length) { E[2].v.textContent = '—'; E[2].d.textContent = 'Sin medios todavía.'; }
    else if (!conSede.length) { E[2].v.textContent = 'Sin dato'; E[2].v.classList.add('texto'); E[2].d.textContent = 'Falta identificar la sede de los medios.'; }
    else { E[2].v.textContent = fmt(fuera.length); E[2].d.textContent = (fuera.length ? fuera.slice(0, 3).join(', ') + (fuera.length > 3 ? '…' : '') : 'Todos con sede en Chubut') + (sinSede ? ` · ${sinSede} sin sede identificada` : ''); }
    pintarRedesEtapa();
  };
  const palabras = t => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 5 && !['chubut', 'judicial', 'justicia', 'juzgado', 'poder', 'sobre', 'desde', 'entre', 'fallo', 'causa'].includes(w)));
  const nivel = (pub, todas) => {
    if (typeof pub.interacciones !== 'number') return null;
    const valores = todas.filter(p => p.red === pub.red && typeof p.interacciones === 'number').map(p => p.interacciones).sort((a, b) => b - a);
    if (valores.length < 3) return null;
    const pos = valores.indexOf(pub.interacciones) / valores.length;
    return pos < 0.2 ? 'alta' : pos < 0.6 ? 'media' : 'baja';
  };
  function pintarRedesEtapa() {
    const s = E[3];
    s.v.classList.add('texto');
    if (!redesVivo) { s.v.textContent = 'Consultando…'; s.d.textContent = ''; return; }
    const pubs = redesVivo.publicaciones || [];
    if (!redesVivo.cuentas.some(c => c.ok)) { s.v.textContent = 'Sin dato en vivo'; s.d.textContent = 'Las redes no respondieron.'; return; }
    const clave = palabras(ultima && ultima.titulo);
    const asociadas = pubs.filter(p => p.fecha >= restar(ultima.fecha, 1) && [...palabras(p.texto)].filter(w => clave.has(w)).length >= 2);
    if (!asociadas.length) { s.v.textContent = 'Sin publicación asociada'; s.d.textContent = 'No encontramos un posteo propio sobre esta nota en los últimos 7 días.'; return; }
    const total = asociadas.reduce((a, p) => typeof p.interacciones === 'number' ? (a ?? 0) + p.interacciones : a, null);
    s.v.classList.toggle('texto', total === null);
    s.v.textContent = total === null ? 'Sin dato de interacciones' : fmt(total);
    s.d.replaceChildren(document.createTextNode(`interacciones en ${asociadas.length} publicación${asociadas.length > 1 ? 'es' : ''} (${[...new Set(asociadas.map(p => p.red))].join(', ')}) `));
    const mejor = asociadas.slice().sort((a, b) => (b.interacciones ?? -1) - (a.interacciones ?? -1))[0];
    const n = nivel(mejor, pubs);
    s.d.append(el('span', 'pv-badge ' + (n || 'nd'), n ? 'Interacción ' + n : 'Interacción sin dato'));
  }

  // ---- Lista "entrando" ----
  // Una fila por medio y nota (si un medio tiene dos enlaces de la misma nota, se muestra uno).
  const unicas = [...new Map(filas.map(r => [r.nota_id + '|' + canonMedio(r.medio), r])).values()];
  const recientes = unicas.sort((a, b) => notaPorId.get(Number(b.nota_id)).fecha.localeCompare(notaPorId.get(Number(a.nota_id)).fecha) || Number(b.nota_id) - Number(a.nota_id)).slice(0, 40);
  if (!recientes.length) lista.append(el('li', 'pv-fila', 'Todavía no hay publicaciones en medios registradas.'));
  recientes.forEach(r => {
    const n = notaPorId.get(Number(r.nota_id));
    const li = el('li');
    const a = el('a', 'pv-fila'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
    const linea = el('span', 'pv-medio'); linea.append(el('b', '', canonMedio(r.medio)), el('span', 'pv-mono pv-cuando', ' · nota del ' + ddmm(n.fecha)));
    const tit = el('span', 'pv-tit', n.titulo);
    const ok = esConfirmada(r); const b = el('span', 'pv-badge pv-der ' + (ok ? 'ok' : 'pend'), ok ? 'Verificada' : 'A verificar');
    a.append(linea, b, tit); li.append(a); lista.append(li);
  });
  const verTodas = el('button', 'pv-ver-todas', 'Ver todas →'); verTodas.type = 'button';
  verTodas.addEventListener('click', () => {
    const abierta = cajaLista.classList.toggle('pv-expandida');
    verTodas.textContent = abierta ? 'Ver menos ↑' : 'Ver todas →';
    lista.style.transform = '';
  });
  if (recientes.length > 4) cajaLista.append(verTodas);
  if (!menosMovimiento && recientes.length > 4) {
    let paso = 0;
    setInterval(() => {
      if (document.hidden || cajaLista.classList.contains('pv-expandida')) return;
      const filasLi = lista.children; if (!filasLi.length) return;
      const visibles = window.matchMedia('(max-width: 480px)').matches ? 4 : 6;
      paso = (paso + 1) % Math.max(1, filasLi.length - visibles + 1);
      lista.style.transform = `translateY(-${filasLi[paso].offsetTop}px)`;
    }, 2600);
  }

  // ---- Barra lateral: medios 7 días, volumen y verificación ----
  const desde7 = restar(hoy, 6);
  const filas7 = filas.filter(r => notaPorId.get(Number(r.nota_id)).fecha >= desde7);
  const porMedio = new Map();
  filas7.forEach(r => { const m = canonMedio(r.medio); if (!porMedio.has(m)) porMedio.set(m, new Set()); porMedio.get(m).add(Number(r.nota_id)); });
  const top6 = [...porMedio.entries()].map(([m, s]) => [m, s.size]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
  const barras = el('div', 'pv-barras');
  if (!top6.length) barras.append(el('p', 'pv-det', 'Sin publicaciones en medios en los últimos 7 días.'));
  top6.forEach(([m, k]) => { const f = el('div', 'pv-barra'); const pista = el('div', 'pv-pista'); const b = el('b'); b.style.width = (100 * k / top6[0][1]) + '%'; pista.append(b); f.append(el('span', '', m), el('span', 'pv-num', fmt(k) + (k === 1 ? ' nota' : ' notas')), pista); barras.append(f); });
  cajaMedios.append(barras);

  const dias = Array.from({ length: 14 }, (_, i) => restar(hoy, 13 - i));
  const porDia = dias.map(d => new Set(filas.filter(r => notaPorId.get(Number(r.nota_id)).fecha === d).map(r => r.nota_id + '|' + canonMedio(r.medio))).size);
  const max = Math.max(1, ...porDia);
  const W = 280, H = 56;
  const pts = porDia.map((v, i) => [i * (W / 13), H - 4 - (v / max) * (H - 10)]);
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'pv-spark'); svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Publicaciones en medios por día de la nota, últimos 14 días: ' + porDia.join(', '));
  const defs = document.createElementNS(svgNS, 'defs'); const grad = document.createElementNS(svgNS, 'linearGradient'); grad.id = 'pv-grad'; grad.setAttribute('x1', '0'); grad.setAttribute('x2', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('y2', '1');
  [['0', '.35'], ['1', '0']].forEach(([o, op]) => { const s = document.createElementNS(svgNS, 'stop'); s.setAttribute('offset', o); s.setAttribute('stop-color', '#9fdcff'); s.setAttribute('stop-opacity', op); grad.append(s); });
  defs.append(grad); svg.append(defs);
  const linea = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = document.createElementNS(svgNS, 'path'); area.setAttribute('d', linea + ` L${W} ${H} L0 ${H} Z`); area.setAttribute('fill', 'url(#pv-grad)');
  const path = document.createElementNS(svgNS, 'path'); path.setAttribute('d', linea); path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#9fdcff'); path.setAttribute('stroke-width', '2'); path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(area, path);
  cajaVol.append(svg, el('p', 'pv-det', `Máximo: ${fmt(Math.max(...porDia))} publicaciones en un día · por fecha de la nota`));

  const ok7 = new Set(filas7.filter(esConfirmada).map(r => r.nota_id + '|' + canonMedio(r.medio)));
  const todas7 = new Set(filas7.map(r => r.nota_id + '|' + canonMedio(r.medio)));
  const pend7 = todas7.size - ok7.size;
  if (!todas7.size) cajaVer.append(el('p', 'pv-det', 'Sin publicaciones en los últimos 7 días.'));
  else {
    const ap = el('div', 'pv-apilada'); const b1 = el('b'); b1.style.cssText = `width:${100 * ok7.size / todas7.size}%;background:var(--pv-alta)`; const b2 = el('b'); b2.style.cssText = `width:${100 * pend7 / todas7.size}%;background:var(--pv-media)`; ap.append(b1, b2);
    const ley = el('div', 'pv-leyenda'); [['var(--pv-alta)', `Verificadas ${fmt(ok7.size)}`], ['var(--pv-media)', `A verificar ${fmt(pend7)}`]].forEach(([c, t]) => { const s = el('span'); const i = el('i'); i.style.background = c; s.append(i, t); ley.append(s); });
    cajaVer.append(ap, ley);
  }

  // ---- Redes en vivo ----
  // Último dato guardado en el relevamiento (data/redes2.json) para esa red y, si se puede, esa cuenta.
  const ultimoGuardado = (red, cuenta) => {
    const propias = (D.redes || []).filter(r => r.red === red && r.propia === 'Sí');
    const esStj = /\bSTJ\b/.test(String(cuenta || ''));
    const deCuenta = red === 'Facebook'
      ? propias.filter(r => esStj ? /JusNoticias STJ/i.test(r.cuenta || '') : !/JusNoticias STJ/i.test(r.cuenta || '') && /^JusNoticias/i.test(r.cuenta || ''))
      : propias.filter(r => cuenta && String(r.cuenta || '').toLowerCase().includes(String(cuenta).toLowerCase().replace(/^@/, '').split(' ')[0]));
    const fs = (red === 'Facebook' ? deCuenta : (deCuenta.length ? deCuenta : propias)).map(r => r.fecha).filter(Boolean).sort();
    return fs.length ? fs[fs.length - 1] : null;
  };
  const CUENTAS_BASE = [['Facebook', 'JusNoticias'], ['Facebook', 'JusNoticias STJ'], ['Instagram', '@jus_chubut'], ['YouTube', 'Poder Judicial del Chubut'], ['TikTok', '@juschubut'], ['X', '@Jus_Noticias']];
  const pintarRedes = () => {
    ulRedes.replaceChildren();
    if (!redesVivo) { ulRedes.append(el('li', 'pv-det', 'Consultando las redes…')); return; }
    redesVivo.cuentas.forEach(c => {
      const li = el('li', 'pv-red'); const i = el('i'); i.style.background = COLOR[c.red] || '#ccc';
      const nombre = c.red + ' · ' + c.cuenta;
      li.append(i, el('b', '', nombre));
      const linea = el('span');
      if (!c.ok) {
        const ok = (redesVivo.ultimoOk || {})[c.red + '|' + c.cuenta];
        const guardado = ultimoGuardado(c.red, c.cuenta);
        const ult = ok ? ddmm(ok.slice(0, 10)) + ' ' + hhmm(ok) : (guardado ? ddmm(guardado) : 'sin registro');
        linea.textContent = 'sin dato en vivo · último dato: ' + ult;
      } else {
        const partes = [];
        if (typeof c.seguidores === 'number') partes.push(fmt(c.seguidores) + (c.red === 'YouTube' ? ' suscriptores' : ' seguidores'));
        if (c.publicaciones === 0) {
          // Responde pero no publicó en la ventana: se aclara la fecha de lo último, sin sumarlo a la semana.
          partes.push('sin publicaciones en 7 días');
          if (c.ultimaPublicacion) partes.push((['YouTube', 'TikTok'].includes(c.red) ? 'último video: ' : 'última publicación: ') + ddmm(c.ultimaPublicacion));
        } else {
          if (typeof c.interacciones === 'number') partes.push(corto(c.interacciones) + ' interacciones');
          if (typeof c.vistas === 'number') partes.push(corto(c.vistas) + ' vistas');
          if (typeof c.publicaciones === 'number') partes.push(fmt(c.publicaciones) + ' publ.');
        }
        if (c.red === 'Instagram') partes.push(typeof c.alcance === 'number' ? `alcance de la cuenta ${corto(c.alcance)} (${ddmm(c.alcanceDesde)}–${ddmm(c.alcanceHasta)})` : 'alcance de la cuenta: sin dato');
        if (!partes.length) partes.push('sin dato en esta consulta');
        linea.textContent = partes.join(' · ') + (c.publicaciones ? ' · 7 días' : '');
      }
      li.append(linea); ulRedes.append(li);
    });
  };

  const consultar = async () => {
    try {
      const r = await fetch('/api/panel-vivo', { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      redesVivo = await r.json();
      const alguna = redesVivo.cuentas.some(c => c.ok);
      punto.classList.toggle('apagado', !alguna || menosMovimiento);
      estado.textContent = (alguna ? 'en vivo · ' : 'sin dato en vivo · ') + hhmm(redesVivo.consultado);
      tituloRedes.textContent = 'Redes en vivo · consultado ' + hhmm(redesVivo.consultado);
    } catch {
      redesVivo = redesVivo || { cuentas: CUENTAS_BASE.map(([red, cuenta]) => ({ red, cuenta, ok: false })), publicaciones: [] };
      punto.classList.add('apagado');
      estado.textContent = 'sin dato en vivo';
      estado.title = 'Se reintenta en 5 minutos';
    }
    // Chip gris solo si ninguna cuenta de esa red respondió (error). Una red que responde pero no
    // publicó en los 7 días conserva su color.
    chips.querySelectorAll('.pv-chip').forEach(c => {
      if (c.dataset.red === 'Medios') return;
      const cs = redesVivo.cuentas.filter(x => x.red === c.dataset.red);
      const responde = cs.filter(x => x.ok);
      c.classList.toggle('caida', !responde.length);
      c.title = !responde.length ? 'Sin dato en vivo' : responde.every(x => x.publicaciones === 0) ? 'Responde en vivo · sin publicaciones en 7 días' : 'Responde en vivo';
    });
    // Aviso para la barra superior del tablero completo («● en vivo · consultado HH:MM»).
    document.dispatchEvent(new CustomEvent('panelvivo:estado', { detail: { ok: Boolean(redesVivo && redesVivo.cuentas.some(c => c.ok)), consultado: redesVivo && redesVivo.consultado, hora: redesVivo && redesVivo.consultado ? hhmm(redesVivo.consultado) : '' } }));
    pintarRedes(); pintarRedesEtapa(); pintarMovil();
  };

  // ---- Animación de etapas ----
  let i = menosMovimiento ? 0 : -1;
  let pausaHasta = 0;
  function pintarMovil() {
    const k = Math.max(0, Math.min(E.length - 1, i));
    const s = E[k];
    mEtapa.textContent = s.e.querySelector('.pv-mono').textContent;
    mValor.textContent = s.v.textContent; mValor.classList.toggle('texto', s.v.classList.contains('texto'));
    mDet.replaceChildren(...[...s.d.childNodes].map(n => n.cloneNode(true)));
    [...mPuntos.children].forEach((p, j) => p.classList.toggle('on', j <= k));
    movil.classList.toggle('etapa-nota', k === 0);
  }
  const irA = k => {
    i = (k + E.length) % E.length;
    E.forEach((s, j) => { s.e.classList.toggle('is-active', j === i); s.e.classList.toggle('hecha', j < i); s.e.classList.toggle('pendiente', j > i); });
    pintarMovil();
  };
  // Deslizar con el dedo pasa de etapa; tocar la tarjeta pausa la animación 10 s.
  let x0 = null;
  movil.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; pausaHasta = Date.now() + 10000; }, { passive: true });
  movil.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) irA(i + (dx < 0 ? 1 : -1));
    pausaHasta = Date.now() + 10000;
  });
  movil.addEventListener('click', () => { pausaHasta = Date.now() + 10000; });
  pintarEtapas(); pintarRedes(); consultar(); pintarMovil();
  setInterval(() => { if (!document.hidden) consultar(); }, 5 * 60 * 1000);
  if (menosMovimiento) { E.forEach(s => s.e.classList.add('hecha')); pintarMovil(); return; }
  const avanzar = () => {
    if (Date.now() < pausaHasta) return;
    i++;
    if (i > E.length + 1) { i = 0; E.forEach(s => s.e.classList.remove('hecha', 'is-active', 'pendiente')); conectores.forEach(c => c.classList.remove('is-active')); }
    E.forEach((s, k) => { s.e.classList.toggle('is-active', k === i); s.e.classList.toggle('hecha', k < i); s.e.classList.toggle('pendiente', k > i); });
    conectores.forEach((c, k) => { c.classList.remove('is-active'); if (k === i - 1) { void c.offsetWidth; c.classList.add('is-active'); } });
    pintarMovil();
  };
  avanzar(); setInterval(avanzar, 1200);
})();
