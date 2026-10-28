// Resumen del tablero completo con el esquema de Plausible: números arriba, gráfico por día,
// tarjetas con pestañas y filtros por clic. Solo cambia el orden y la presentación: las cifras
// salen de los mismos datos y criterios del tablero (window.__tablero). Un dato que falta nunca es 0.
(function () {
  const T = window.__tablero;
  const raiz = document.getElementById('pl-resumen');
  if (!T || !raiz) return;
  const { D, st, meses, notas, TIPOS, esConfirmada, canonMedio, localidadDe, regionMedio, mesLargo, cap } = T;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const fmt = n => typeof n === 'number' ? n.toLocaleString('es-AR') : '—';
  const ddmm = f => f ? f.slice(8, 10) + '/' + f.slice(5, 7) : '';
  const menosMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const notaPorId = new Map(notas.map(n => [Number(n.id), n]));
  const POR_VERIFICAR = loc => !loc || loc === 'Localidad por verificar' || /por verificar/i.test(loc);

  // ---------- Datos base (mismos criterios que calc()) ----------
  const filasTodas = D.repercusion.filter(r => r.confianza !== 'Baja' && Boolean(r.url) && notaPorId.has(Number(r.nota_id))).map(r => {
    const n = notaPorId.get(Number(r.nota_id));
    const medio = canonMedio(r.medio);
    const loc = localidadDe(medio);
    return { ...r, medio, mes: n.mes, fecha: n.fecha, tipo: n.tipo, localidad: loc || '', region: loc ? regionMedio(loc) : '' };
  });
  const propias = (D.redes || []).filter(r => r.propia === 'Sí');
  const interaccion = r => { const v = [r.me_gusta, r.comentarios, r.compartidos].filter(x => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) : null; };
  const CUENTAS_REDES = [
    { id: 'fb', red: 'Facebook', nombre: 'Facebook', es: r => r.red === 'Facebook' && !/STJ/i.test(r.cuenta || '') && /^JusNoticias/i.test(r.cuenta || ''), canal: c => c.red === 'Facebook' && !/STJ/.test(c.cuenta) },
    { id: 'fbstj', red: 'Facebook', nombre: 'FB STJ', es: r => r.red === 'Facebook' && /JusNoticias STJ/i.test(r.cuenta || ''), canal: c => c.red === 'Facebook' && /STJ/.test(c.cuenta) },
    { id: 'ig', red: 'Instagram', nombre: 'Instagram', es: r => r.red === 'Instagram', canal: c => c.red === 'Instagram' },
    { id: 'yt', red: 'YouTube', nombre: 'YouTube', es: r => r.red === 'YouTube', canal: c => c.red === 'YouTube' },
    { id: 'tt', red: 'TikTok', nombre: 'TikTok', es: r => r.red === 'TikTok', canal: c => c.red === 'TikTok' },
    { id: 'x', red: 'X', nombre: 'X', es: r => r.red === 'X' && /Jus_Noticias/i.test(r.cuenta || ''), canal: c => c.red === 'X' }
  ];

  // ---------- Filtro y período ----------
  let filtro = null; // { tipo: 'medio'|'ciudad'|'region'|'nota'|'tema'|'red', valor, etiqueta }
  let metrica = 'publicaciones';
  let pestanas = { medios: 'medios', notas: 'notas', redes: 'fb', visitas: 'visitas' };
  let visitas = { clave: '', estado: 'cargando', actual: null, anterior: null, datos: null };
  let vivo = null;
  const ETIQUETA_FILTRO = { medio: 'Medio', ciudad: 'Ciudad', region: 'Región', nota: 'Nota', tema: 'Tema', red: 'Red' };
  const aplicaFiltro = r => !filtro || ({
    medio: () => r.medio === filtro.valor,
    ciudad: () => r.localidad === filtro.valor,
    region: () => r.region === filtro.valor,
    nota: () => Number(r.nota_id) === Number(filtro.valor),
    tema: () => r.tipo === filtro.valor,
    red: () => true
  })[filtro.tipo]();

  // Períodos por días: el mes en curso se compara contra la misma cantidad de días anteriores,
  // no contra un mes completo.
  const iso = x => x.toISOString().slice(0, 10);
  const sumarDias = (f, n) => { const x = new Date(f + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
  const diasEntre = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000) + 1;
  const primerDato = notas.map(n => n.fecha).filter(Boolean).sort()[0];
  const rangoActual = () => {
    const [hy, hm] = st.hasta.split('-').map(Number);
    let fin = iso(new Date(Date.UTC(hy, hm, 0)));
    const hoy = iso(new Date());
    if (fin > hoy) fin = hoy;
    return [st.desde + '-01', fin];
  };
  const rangoAnterior = ([a, b]) => {
    const n = diasEntre(a, b);
    const previo = [sumarDias(a, -n), sumarDias(a, -1)];
    return previo[0] < primerDato ? null : previo; // antes del inicio de los datos: sin comparación
  };

  // Cifras del rango de fechas [a, b] con el filtro activo. Sin filtro coinciden con calc().
  const cifras = (a, b) => {
    const enP = f => Boolean(f) && f >= a && f <= b;
    const ns0 = notas.filter(n => enP(n.fecha));
    const filas = filasTodas.filter(r => enP(r.fecha) && aplicaFiltro(r));
    let ns = ns0;
    if (filtro && ['medio', 'ciudad', 'region'].includes(filtro.tipo)) { const ids = new Set(filas.map(r => Number(r.nota_id))); ns = ns0.filter(n => ids.has(Number(n.id))); }
    if (filtro && filtro.tipo === 'nota') ns = ns0.filter(n => Number(n.id) === Number(filtro.valor));
    if (filtro && filtro.tipo === 'tema') ns = ns0.filter(n => n.tipo === filtro.valor);
    const idsNs = new Set(ns.map(n => Number(n.id)));
    const filasNs = filas.filter(r => idsNs.has(Number(r.nota_id)));
    const con = new Set(filasNs.map(r => Number(r.nota_id)));
    const posts = propias.filter(r => r.fecha && enP(r.fecha.slice(0, 10)) && (!filtro || filtro.tipo !== 'red' || CUENTAS_REDES.find(c => c.id === filtro.valor).es(r)));
    const inter = posts.map(interaccion).filter(v => typeof v === 'number');
    return {
      notas: ns.length,
      pct: ns.length ? Math.round(con.size / ns.length * 100) : null,
      publicaciones: new Set(filasNs.map(r => r.url)).size,
      medios: new Set(filasNs.map(r => r.medio)).size,
      interacciones: inter.length ? inter.reduce((a, b) => a + b, 0) : null,
      ns, filas: filasNs, posts
    };
  };

  // ---------- Visitas (Google Analytics, se consulta aparte) ----------
  // Google Analytics: hasta ayer y como máximo 90 días.
  const rangoVisitas = ([a, b]) => {
    const ayer = iso(new Date(Date.now() - 86400000));
    const fin = b > ayer ? ayer : b;
    const min = sumarDias(fin, -89);
    const ini = a < min ? min : a;
    return ini > fin ? null : [ini, fin];
  };
  const pedirVisitas = async rango => {
    if (!rango) return null;
    const r = await fetch('/api/google-metrics?desde=' + rango[0] + '&hasta=' + rango[1], { headers: { Accept: 'application/json' } });
    const j = await r.json();
    if (!r.ok || j.estado !== 'ok') throw new Error(j.error || j.estado || ('HTTP ' + r.status));
    return j;
  };
  const cargarVisitas = async () => {
    const clave = st.desde + '|' + st.hasta;
    if (visitas.clave === clave) return;
    visitas = { clave, estado: 'cargando', actual: null, anterior: null, datos: null };
    try {
      const rango = rangoVisitas(rangoActual());
      const actual = await pedirVisitas(rango);
      if (visitas.clave !== clave) return;
      visitas.datos = actual;
      visitas.actual = actual && actual.analytics && typeof actual.analytics.sessions === 'number' ? actual.analytics.sessions : null;
      const ant = rango ? [sumarDias(rango[0], -diasEntre(rango[0], rango[1])), sumarDias(rango[0], -1)] : null;
      if (ant) { try { const a = await pedirVisitas(ant); visitas.anterior = a && a.analytics && typeof a.analytics.sessions === 'number' ? a.analytics.sessions : null; } catch { visitas.anterior = null; } }
      visitas.estado = 'ok';
    } catch (e) { if (visitas.clave === clave) { visitas.estado = 'error'; visitas.error = e.message; } }
    if (visitas.clave === clave) render();
  };

  // ---------- Estructura ----------
  const kpisCaja = el('div', 'pl-kpis');
  const grafCaja = el('section', 'pl-card pl-grafico');
  const compCaja = el('p', 'pl-nota pl-comparacion');
  const avisoCaja = el('div', 'pl-aviso');
  const grilla = el('div', 'pl-grilla');
  raiz.replaceChildren(kpisCaja, compCaja, grafCaja, avisoCaja, grilla);

  const KPIS = [
    { k: 'notas', nombre: 'Notas publicadas' },
    { k: 'pct', nombre: '% con repercusión', suf: '%' },
    { k: 'publicaciones', nombre: 'Publicaciones en medios' },
    { k: 'medios', nombre: 'Medios distintos' },
    { k: 'interacciones', nombre: 'Interacciones en redes' },
    { k: 'visitas', nombre: 'Visitas al sitio' }
  ];
  const variacion = (a, b) => {
    if (typeof a !== 'number' || typeof b !== 'number' || b === 0) return null;
    return Math.round((a - b) / b * 100);
  };

  const pintarKpis = (act, ant) => {
    kpisCaja.replaceChildren();
    KPIS.forEach(m => {
      const b = el('button', 'pl-kpi' + (metrica === m.k ? ' activa' : ''));
      b.type = 'button'; b.setAttribute('aria-pressed', String(metrica === m.k));
      let valor = m.k === 'visitas' ? visitas.actual : act[m.k];
      let previo = m.k === 'visitas' ? visitas.anterior : (ant ? ant[m.k] : null);
      if (m.k === 'visitas' && filtro) { valor = null; previo = null; }
      b.append(el('span', 'pl-kpi-nombre', m.nombre));
      const v = el('strong', 'pl-kpi-valor', typeof valor === 'number' ? fmt(valor) + (m.suf || '') : '—');
      b.append(v);
      const d = variacion(valor, previo);
      if (d !== null && d !== 0) b.append(el('span', 'pl-delta ' + (d > 0 ? 'sube' : 'baja'), (d > 0 ? '↗ ' : '↘ ') + Math.abs(d) + '%'));
      else if (d === 0) b.append(el('span', 'pl-delta igual', '= 0%'));
      if (m.k === 'visitas') {
        const nota = filtro ? 'no se filtra por ' + ETIQUETA_FILTRO[filtro.tipo].toLowerCase() : visitas.estado === 'cargando' ? 'consultando…' : visitas.estado === 'error' ? 'sin dato' : 'sesiones · Google Analytics';
        b.append(el('span', 'pl-kpi-nota', nota));
      }
      b.addEventListener('click', () => { metrica = m.k; render(); });
      kpisCaja.append(b);
    });
  };

  // ---------- Gráfico por día ----------
  const diasDelPeriodo = () => {
    const [dy, dm] = st.desde.split('-').map(Number), [hy, hm] = st.hasta.split('-').map(Number);
    const ini = new Date(Date.UTC(dy, dm - 1, 1)); let fin = new Date(Date.UTC(hy, hm, 0));
    const hoy = new Date(); if (fin > hoy) fin = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
    const out = []; for (let x = new Date(ini); x <= fin; x.setUTCDate(x.getUTCDate() + 1)) out.push(x.toISOString().slice(0, 10));
    return out;
  };
  const serie = (act, dias) => {
    const porDia = (filas, f) => dias.map(d => f(filas.filter(r => r.fecha === d), d));
    switch (metrica) {
      case 'notas': return dias.map(d => act.ns.filter(n => n.fecha === d).length);
      case 'pct': return dias.map(d => { const ns = act.ns.filter(n => n.fecha === d); if (!ns.length) return null; const con = new Set(act.filas.filter(r => r.fecha === d).map(r => Number(r.nota_id))); return Math.round(ns.filter(n => con.has(Number(n.id))).length / ns.length * 100); });
      case 'publicaciones': return porDia(act.filas, rs => new Set(rs.map(r => r.url)).size);
      case 'medios': return porDia(act.filas, rs => new Set(rs.map(r => r.medio)).size);
      case 'interacciones': return dias.map(d => { const v = act.posts.filter(r => r.fecha === d).map(interaccion).filter(x => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) : null; });
      default: return null;
    }
  };
  const pintarGrafico = act => {
    const m = KPIS.find(x => x.k === metrica);
    grafCaja.replaceChildren(el('h2', 'pl-card-titulo', m.nombre + ' por día'));
    const nota = { publicaciones: 'Por fecha de la nota de JusNoticias.', medios: 'Medios distintos por fecha de la nota.', pct: 'Notas de cada día que salieron en al menos un medio.', notas: 'Notas publicadas cada día.', interacciones: 'Reacciones, comentarios y compartidos de las publicaciones propias registradas, por fecha de publicación.' }[metrica];
    if (metrica === 'visitas') {
      const texto = filtro ? 'Las visitas no se filtran por ' + ETIQUETA_FILTRO[filtro.tipo].toLowerCase() + '.'
        : visitas.estado === 'cargando' ? 'Consultando Google Analytics…'
        : typeof visitas.actual === 'number' ? 'Google Analytics no entrega visitas por día en esta conexión: el total del período está en la tarjeta de arriba y el detalle en la pestaña Visitas.'
        : 'Sin dato: Google Analytics no respondió en este momento. Se vuelve a consultar al cambiar el período o al abrir la pestaña Visitas.';
      grafCaja.append(el('p', 'pl-nota', texto)); return;
    }
    const dias = diasDelPeriodo();
    const ys = serie(act, dias);
    const validos = ys.filter(v => typeof v === 'number');
    if (!validos.length) { grafCaja.append(el('p', 'pl-nota', 'Sin datos por día en este período.')); return; }
    const W = Math.max(320, Math.round(grafCaja.clientWidth - 28) || 900), H = W < 600 ? 190 : 220, PI = 36, PB = 26, PT = 12;
    const max = Math.max(1, ...validos);
    const x = i => PI + (dias.length > 1 ? i * (W - PI - 8) / (dias.length - 1) : (W - PI) / 2);
    const y = v => PT + (H - PT - PB) * (1 - v / max);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'pl-svg'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${m.nombre} por día, del ${ddmm(dias[0])} al ${ddmm(dias[dias.length - 1])}. Máximo ${fmt(max)}${m.suf || ''}.`);
    [0, .5, 1].forEach(t => { const yy = PT + (H - PT - PB) * t; const l = document.createElementNS(ns, 'line'); l.setAttribute('x1', PI); l.setAttribute('x2', W - 8); l.setAttribute('y1', yy); l.setAttribute('y2', yy); l.setAttribute('class', 'pl-eje'); svg.append(l); const tx = document.createElementNS(ns, 'text'); tx.setAttribute('x', PI - 6); tx.setAttribute('y', yy + 4); tx.setAttribute('text-anchor', 'end'); tx.textContent = fmt(Math.round(max * (1 - t))); svg.append(tx); });
    // Línea con cortes donde no hay dato (no se dibuja como 0).
    let d = '', abierto = false;
    ys.forEach((v, i) => { if (typeof v !== 'number') { abierto = false; return; } d += (abierto ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); abierto = true; });
    const area = document.createElementNS(ns, 'path');
    if (validos.length === ys.length) { area.setAttribute('d', d + ` L${x(ys.length - 1)} ${H - PB} L${x(0)} ${H - PB} Z`); area.setAttribute('class', 'pl-area'); svg.append(area); }
    const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); path.setAttribute('class', 'pl-linea'); svg.append(path);
    ys.forEach((v, i) => { if (typeof v !== 'number') return; const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', x(i)); c.setAttribute('cy', y(v)); c.setAttribute('r', dias.length > 45 ? 2 : 3); c.setAttribute('class', 'pl-punto'); const t = document.createElementNS(ns, 'title'); t.textContent = `${ddmm(dias[i])}: ${fmt(v)}${m.suf || ''}`; c.append(t); svg.append(c); });
    [[0, 'start'], [dias.length - 1, 'end']].forEach(([i, a]) => { const tx = document.createElementNS(ns, 'text'); tx.setAttribute('x', x(i)); tx.setAttribute('y', H - 6); tx.setAttribute('text-anchor', a); tx.textContent = ddmm(dias[i]); svg.append(tx); });
    grafCaja.append(svg, el('p', 'pl-nota', nota + (metrica === 'interacciones' ? ' Los días sin dato quedan sin línea.' : '')));
  };

  // ---------- Tarjetas con pestañas ----------
  const contar = (filas, clave, etiqueta) => {
    const m = new Map();
    filas.forEach(r => { const k = clave(r); if (!k) return; const x = m.get(k) || { valor: k, etiqueta: etiqueta ? etiqueta(r) : k, urls: new Set() }; x.urls.add(r.url); m.set(k, x); });
    return [...m.values()].map(x => ({ valor: x.valor, etiqueta: x.etiqueta, n: x.urls.size })).sort((a, b) => b.n - a.n || String(a.etiqueta).localeCompare(String(b.etiqueta)));
  };
  const estadoCuenta = c => {
    const canal = (D.canales || []).find(c.canal);
    const v = vivo && vivo.cuentas ? vivo.cuentas.filter(x => x.red === c.red && (c.id === 'fbstj' ? /STJ/.test(x.cuenta) : c.id === 'fb' ? !/STJ/.test(x.cuenta) : true)) : [];
    const enVivo = v.length ? (v.some(x => x.ok) ? 'responde en vivo' : 'sin dato en vivo') : (vivo ? 'sin dato en vivo' : '');
    return [canal && canal.estado, enVivo].filter(Boolean).join(' · ') || 'Sin estado registrado';
  };
  const datosTarjeta = (grupo, pest, act) => {
    if (grupo === 'medios') {
      const conSede = act.filas.filter(r => !POR_VERIFICAR(r.localidad));
      if (pest === 'medios') return { filas: contar(act.filas, r => r.medio).map(x => ({ ...x, tipo: 'medio', sufijo: x.n === 1 ? 'publicación' : 'publicaciones' })) };
      if (pest === 'ciudades') return { filas: contar(conSede, r => r.localidad).map(x => ({ ...x, tipo: 'ciudad', sufijo: x.n === 1 ? 'publicación' : 'publicaciones' })) };
      return { filas: contar(conSede.filter(r => r.region && r.region !== 'Localidad por verificar'), r => r.region).map(x => ({ ...x, tipo: 'region', sufijo: x.n === 1 ? 'publicación' : 'publicaciones' })) };
    }
    if (grupo === 'notas') {
      if (pest === 'notas') {
        const porNota = new Map(); act.filas.forEach(r => { const k = Number(r.nota_id); porNota.set(k, (porNota.get(k) || new Set()).add(r.medio)); });
        return { filas: act.ns.map(n => ({ valor: Number(n.id), etiqueta: n.titulo, n: (porNota.get(Number(n.id)) || new Set()).size, tipo: 'nota', detalle: ddmm(n.fecha) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n || String(a.etiqueta).localeCompare(String(b.etiqueta))).map(x => ({ ...x, sufijo: x.n === 1 ? 'medio' : 'medios' })) };
      }
      const con = new Set(act.filas.map(r => Number(r.nota_id)));
      return { filas: TIPOS.map(t => { const ns = act.ns.filter(n => n.tipo === t); return { valor: t, etiqueta: t, n: ns.filter(n => con.has(Number(n.id))).length, total: ns.length, tipo: 'tema' }; }).filter(x => x.total).sort((a, b) => b.n - a.n).map(x => ({ ...x, sufijo: 'de ' + fmt(x.total) + ' notas' })) };
    }
    if (grupo === 'redes') {
      const c = CUENTAS_REDES.find(x => x.id === pest);
      const posts = act.posts.filter(c.es).map(r => ({ r, i: interaccion(r), v: typeof r.vistas === 'number' && r.vistas > 0 ? r.vistas : null }));
      const usaVistas = posts.some(p => p.v !== null) && !posts.some(p => p.i);
      const filas = posts.map(p => ({ valor: c.id, etiqueta: (p.r.texto || 'Publicación') + '…', n: usaVistas ? p.v : p.i, detalle: ddmm(p.r.fecha), tipo: 'red', sufijo: usaVistas ? 'vistas' : 'interacciones', sinDato: (usaVistas ? p.v : p.i) === null }))
        .sort((a, b) => (b.n ?? -1) - (a.n ?? -1));
      return { filas, estado: estadoCuenta(c), vacio: 'Sin publicaciones registradas de esta cuenta en el período.' };
    }
    // Visitas | Buscadores
    if (filtro) return { filas: [], vacio: 'Las visitas no se filtran por ' + ETIQUETA_FILTRO[filtro.tipo].toLowerCase() + '.' };
    if (visitas.estado === 'cargando') return { filas: [], vacio: 'Consultando Google…' };
    if (visitas.estado === 'error' || !visitas.datos) return { filas: [], vacio: 'Sin dato: no se pudo consultar Google en este momento.' };
    if (pest === 'visitas') return { filas: (visitas.datos.analytics.paginas || []).map(p => ({ valor: p.ruta, etiqueta: p.titulo || p.ruta, n: typeof p.screenPageViews === 'number' ? p.screenPageViews : null, sufijo: 'vistas', enlace: 'https://jusnoticias.juschubut.gov.ar' + (p.ruta || '') })).sort((a, b) => (b.n ?? -1) - (a.n ?? -1)), vacio: 'Sin páginas en este período.' };
    return { filas: ((visitas.datos.searchConsole && visitas.datos.searchConsole.consultas) || []).map(q => ({ valor: q.consulta, etiqueta: q.consulta, n: typeof q.clics === 'number' ? q.clics : null, sufijo: 'clics' })).sort((a, b) => (b.n ?? -1) - (a.n ?? -1)), vacio: 'Sin búsquedas en este período.' };
  };
  const TARJETAS = [
    { grupo: 'medios', titulo: 'Dónde salió', pestanas: [['medios', 'Medios'], ['ciudades', 'Ciudades'], ['regiones', 'Regiones']] },
    { grupo: 'notas', titulo: 'Qué salió', pestanas: [['notas', 'Notas'], ['temas', 'Temas']] },
    { grupo: 'redes', titulo: 'Redes', pestanas: CUENTAS_REDES.map(c => [c.id, c.nombre]) },
    { grupo: 'visitas', titulo: 'Sitio', pestanas: [['visitas', 'Visitas'], ['buscadores', 'Buscadores']] }
  ];
  const filaLista = (x, max, alClic) => {
    const tag = x.enlace ? 'a' : (x.tipo ? 'button' : 'div');
    const f = el(tag, 'pl-fila');
    if (tag === 'button') f.type = 'button';
    if (x.enlace) { f.href = x.enlace; f.target = '_blank'; f.rel = 'noopener'; }
    const fondo = el('i', 'pl-fondo'); fondo.style.width = (typeof x.n === 'number' && max ? Math.max(2, 100 * x.n / max) : 0) + '%'; fondo.setAttribute('aria-hidden', 'true');
    const nombre = el('span', 'pl-fila-nombre', x.etiqueta); if (x.detalle) nombre.prepend(el('span', 'pl-fila-detalle', x.detalle + ' · '));
    const valor = el('span', 'pl-fila-valor', typeof x.n === 'number' ? fmt(x.n) : 'sin dato'); valor.title = typeof x.n === 'number' ? fmt(x.n) + ' ' + (x.sufijo || '') : 'Sin dato';
    f.append(fondo, nombre, valor);
    if (x.tipo && alClic) f.addEventListener('click', () => alClic(x));
    if (x.tipo) f.title = 'Filtrar todo el tablero por ' + x.etiqueta;
    return f;
  };
  const ponerFiltro = x => {
    if (x.tipo === 'red') filtro = { tipo: 'red', valor: x.valor, etiqueta: CUENTAS_REDES.find(c => c.id === x.valor).nombre };
    else filtro = { tipo: x.tipo, valor: x.valor, etiqueta: x.tipo === 'nota' ? (x.etiqueta.length > 60 ? x.etiqueta.slice(0, 58) + '…' : x.etiqueta) : x.etiqueta };
    const modal = $('pl-modal'); if (modal && modal.open) modal.close();
    render();
    if (!menosMovimiento) $('pl-barra').scrollIntoView({ block: 'start' });
  };
  const abrirModal = (titulo, filas, max) => {
    const modal = $('pl-modal'); if (!modal) return;
    $('pl-modal-titulo').textContent = titulo;
    const buscar = $('pl-modal-buscar'); buscar.value = '';
    const pintar = () => {
      const q = buscar.value.trim().toLowerCase();
      const vis = filas.filter(x => !q || String(x.etiqueta).toLowerCase().includes(q));
      $('pl-modal-lista').replaceChildren(...(vis.length ? vis.map(x => filaLista(x, max, ponerFiltro)) : [el('p', 'pl-nota', 'Nada coincide con la búsqueda.')]));
    };
    buscar.oninput = pintar; pintar();
    if (typeof modal.showModal === 'function') modal.showModal();
    buscar.focus();
  };
  const pintarGrilla = act => {
    grilla.replaceChildren();
    TARJETAS.forEach(t => {
      const card = el('section', 'pl-card pl-tarjeta');
      const cab = el('div', 'pl-tarjeta-cab');
      const tabs = el('div', 'pl-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', t.titulo);
      t.pestanas.forEach(([id, nombre]) => { const b = el('button', 'pl-tab', nombre); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(pestanas[t.grupo] === id)); b.addEventListener('click', () => { pestanas[t.grupo] = id; render(); }); tabs.append(b); });
      const dt = datosTarjeta(t.grupo, pestanas[t.grupo], act);
      const max = Math.max(0, ...dt.filas.map(x => typeof x.n === 'number' ? x.n : 0));
      const ver = el('button', 'pl-ver', '⛶'); ver.type = 'button'; ver.title = 'Ver todo'; ver.setAttribute('aria-label', 'Ver la lista completa');
      ver.addEventListener('click', () => abrirModal(t.pestanas.find(p => p[0] === pestanas[t.grupo])[1], dt.filas, max));
      cab.append(tabs, ver);
      card.append(cab);
      if (dt.estado) card.append(el('p', 'pl-estado-fuente', 'Estado de la fuente: ' + dt.estado));
      const lista = el('div', 'pl-lista');
      if (!dt.filas.length) lista.append(el('p', 'pl-nota', dt.vacio || 'Sin datos en este período.'));
      dt.filas.slice(0, 9).forEach(x => lista.append(filaLista(x, max, ponerFiltro)));
      card.append(lista);
      grilla.append(card);
    });
  };
  const pintarAviso = act => {
    avisoCaja.replaceChildren();
    const pv = act.filas.filter(r => POR_VERIFICAR(r.localidad));
    const n = new Set(pv.map(r => r.url)).size;
    if (!n) return;
    const b = el('button', 'pl-aviso-btn'); b.type = 'button';
    b.append(document.createTextNode(`${fmt(n)} ${n === 1 ? 'publicación' : 'publicaciones'} con sede del medio por verificar `), el('span', 'pl-aviso-ir', '→ revisar'));
    b.addEventListener('click', () => { const filas = contar(pv, r => r.medio).map(x => ({ ...x, tipo: 'medio', sufijo: 'publicaciones' })); abrirModal('Medios con sede por verificar', filas, Math.max(...filas.map(x => x.n))); });
    avisoCaja.append(b);
  };

  // Oración de arriba: con un filtro activo, describe lo filtrado (la de siempre la arma el tablero).
  let takeFiltrado = '';
  const pintarTake = act => {
    const take = $('take'); if (!take) return;
    if (!filtro) { if (take.dataset.original !== undefined && take.textContent === takeFiltrado) take.textContent = take.dataset.original; delete take.dataset.original; takeFiltrado = ''; return; }
    if (take.textContent !== takeFiltrado) take.dataset.original = take.textContent;
    const pub = act.publicaciones, med = act.medios;
    takeFiltrado = `Con el filtro ${ETIQUETA_FILTRO[filtro.tipo].toLowerCase()} «${filtro.etiqueta}»: ` + (filtro.tipo === 'red'
      ? (typeof act.interacciones === 'number' ? `${fmt(act.posts.length)} publicaciones propias con ${fmt(act.interacciones)} interacciones registradas.` : `${fmt(act.posts.length)} publicaciones propias, sin dato de interacciones.`)
      : `${fmt(pub)} ${pub === 1 ? 'publicación' : 'publicaciones'} en ${fmt(med)} ${med === 1 ? 'medio' : 'medios'}, sobre ${fmt(act.notas)} ${act.notas === 1 ? 'nota' : 'notas'} del período.`);
    take.textContent = takeFiltrado;
  };

  // ---------- Barra superior ----------
  const pintarActivos = () => {
    const caja = $('pl-activos'); if (!caja) return;
    caja.replaceChildren();
    if (!filtro) return;
    const chip = el('span', 'pl-activo'); chip.append(el('b', '', ETIQUETA_FILTRO[filtro.tipo] + ': '), document.createTextNode(filtro.etiqueta));
    // Por ahora el filtro recalcula el Resumen; las pestañas Medios, Redes y Visitas siguen mostrando todo el período.
    if (st.page !== 'resumen') chip.append(el('span', 'pl-activo-nota', ' (aplica al Resumen)'));
    const x = el('button', 'pl-quitar', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Quitar el filtro ' + filtro.etiqueta);
    x.addEventListener('click', () => { filtro = null; render(); });
    chip.append(x); caja.append(chip);
  };
  const mesActual = () => new Date().toISOString().slice(0, 7);
  const mesMenos = (m, n) => { const [y, mm] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mm - 1 - n, 1)); return d.toISOString().slice(0, 7); };
  const clampMes = m => meses.includes(m) ? m : (m > meses[meses.length - 1] ? meses[meses.length - 1] : meses[0]);
  const PERIODOS = {
    mes: () => { const m = clampMes(mesActual()); return [m, m]; },
    pasado: () => { const m = clampMes(mesMenos(mesActual(), 1)); return [m, m]; },
    tres: () => [clampMes(mesMenos(mesActual(), 2)), clampMes(mesActual())],
    todo: () => [meses[0], meses[meses.length - 1]]
  };
  const periodoActivo = () => Object.keys(PERIODOS).find(k => { const [d, h] = PERIODOS[k](); return d === st.desde && h === st.hasta; }) || 'personalizado';
  const pintarChips = () => {
    const activo = periodoActivo();
    const personal = $('filtro');
    document.querySelectorAll('.pl-chip').forEach(b => {
      const k = b.dataset.periodo;
      const on = k === 'personalizado' ? (activo === 'personalizado' || !personal.hidden) : k === activo && personal.hidden;
      b.classList.toggle('activa', on); b.setAttribute('aria-pressed', String(on));
    });
  };
  document.querySelectorAll('.pl-chip').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.periodo, personal = $('filtro');
    if (k === 'personalizado') { personal.hidden = !personal.hidden; b.setAttribute('aria-expanded', String(!personal.hidden)); pintarChips(); return; }
    personal.hidden = true;
    const [d, h] = PERIODOS[k]();
    T.setRango(d, h);
  }));
  const vivoCaja = $('pl-vivo');
  document.addEventListener('panelvivo:estado', e => {
    const d = e.detail || {};
    if (vivoCaja) { vivoCaja.classList.toggle('ok', Boolean(d.ok)); vivoCaja.lastElementChild.textContent = d.ok ? 'en vivo · consultado ' + (d.hora || '') : 'sin dato en vivo'; }
    render();
  });
  // Estado de las cuentas para las pestañas de Redes (misma consulta del panel en vivo, con caché de 5 min).
  fetch('/api/panel-vivo', { headers: { Accept: 'application/json' } }).then(r => r.ok ? r.json() : null).then(j => { if (j) { vivo = j; render(); } }).catch(() => {});

  // Botones de la barra
  $('pl-info-btn').addEventListener('click', () => { T.show('resumen'); const b = $('info-abrir'); if (b) b.click(); const p = $('infografia'); if (p && !p.hidden) p.scrollIntoView({ block: 'start' }); });
  $('pl-filtro-btn').addEventListener('click', () => {
    const r = rangoActual();
    const act = cifras(r[0], r[1]);
    const todas = [];
    [['medios', 'medios'], ['medios', 'ciudades'], ['medios', 'regiones'], ['notas', 'notas'], ['notas', 'temas']].forEach(([g, p]) => datosTarjeta(g, p, act).filas.forEach(x => todas.push({ ...x, etiqueta: x.etiqueta, detalle: ETIQUETA_FILTRO[x.tipo] })));
    CUENTAS_REDES.forEach(c => todas.push({ valor: c.id, etiqueta: c.nombre, n: null, tipo: 'red', detalle: 'Red' }));
    abrirModal('Filtrar el tablero', todas, Math.max(0, ...todas.map(x => typeof x.n === 'number' ? x.n : 0)));
  });
  // «?»: guía y «Cómo leer» de cada sección, en un panel lateral.
  const cajon = $('pl-cajon');
  const abrirGuia = () => {
    if (!cajon) return;
    const leer = $('pl-cajon-leer');
    if (!leer.childElementCount) {
      leer.append(el('h3', 'pl-cajon-sub', 'Cómo leer cada sección'));
      ['resumen', 'medios', 'notas', 'redes', 'google'].forEach(id => {
        const t = document.getElementById('ayuda-' + id); if (!t) return;
        const det = el('details', 'pl-leer'); det.append(el('summary', '', t.dataset.titulo || id), t.content.cloneNode(true)); leer.append(det);
      });
    }
    const guia = document.getElementById('guia');
    if (guia && guia.parentElement !== $('pl-cajon-guia')) { $('pl-cajon-guia').append(guia); }
    if (guia) guia.hidden = false;
    if (typeof T.drawGuia === 'function') T.drawGuia();
    if (typeof cajon.showModal === 'function') cajon.showModal();
  };
  window.__tableroAbrirGuia = abrirGuia;
  $('pl-ayuda-btn').addEventListener('click', abrirGuia);
  $('pl-cajon-cerrar').addEventListener('click', () => cajon.close());
  cajon.addEventListener('click', e => { if (e.target === cajon) cajon.close(); });
  $('pl-modal-cerrar').addEventListener('click', () => $('pl-modal').close());
  $('pl-modal').addEventListener('click', e => { if (e.target === $('pl-modal')) $('pl-modal').close(); });

  // Panel en vivo: en el tablero completo va arriba de los números; en la portada, donde estaba.
  const panel = document.getElementById('panel-vivo');
  const lugarPortada = panel ? { padre: panel.parentElement, siguiente: panel.nextElementSibling } : null;
  const ubicarPanel = () => {
    if (!panel) return;
    const enTablero = !$('dashboard-app').hidden;
    const host = $('pl-vivo-host');
    if (enTablero && panel.parentElement !== host) host.append(panel);
    if (!enTablero && lugarPortada && panel.parentElement !== lugarPortada.padre) lugarPortada.padre.insertBefore(panel, lugarPortada.siguiente);
  };
  new MutationObserver(ubicarPanel).observe($('dashboard-app'), { attributes: true, attributeFilter: ['hidden'] });

  // Celular: al bajar, la barra sube hasta dejar fijas solo las pestañas (no tapa un tercio de la pantalla).
  const barra = $('pl-barra');
  const enCelular = window.matchMedia('(max-width: 480px)');
  const medirBarra = () => {
    const nav = barra && barra.querySelector('.tabs');
    if (!nav) return;
    barra.style.setProperty('--pl-barra-oculta', enCelular.matches ? nav.offsetTop + 'px' : '0px');
  };
  if (barra && 'ResizeObserver' in window) new ResizeObserver(medirBarra).observe(barra);
  if (enCelular.addEventListener) enCelular.addEventListener('change', medirBarra);
  medirBarra();

  // ---------- Dibujo ----------
  function render() {
    if (st.page !== 'resumen' && !filtro) { pintarChips(); pintarActivos(); pintarTake(null); return; }
    pintarChips(); pintarActivos(); ubicarPanel();
    const rango = rangoActual();
    const act = cifras(rango[0], rango[1]);
    // Sin filtro, los cuatro números de medios salen de calc() del tablero: misma cifra que antes.
    if (!filtro) { const c = T.calc(); act.notas = c.notas; act.pct = c.notas ? c.pct : null; act.publicaciones = c.publicacionesDetectadas; act.medios = c.mediosDetectados; }
    const ant = rangoAnterior(rango);
    const prev = ant ? cifras(ant[0], ant[1]) : null;
    pintarKpis(act, prev);
    compCaja.textContent = ant ? `Del ${ddmm(rango[0])} al ${ddmm(rango[1])}. Las flechas comparan con el ${ddmm(ant[0])} al ${ddmm(ant[1])} (la misma cantidad de días). Las notas de los últimos días todavía pueden sumar publicaciones.` : `Del ${ddmm(rango[0])} al ${ddmm(rango[1])}. Sin período anterior con datos para comparar.`;
    pintarTake(act);
    pintarGrafico(act);
    pintarAviso(act);
    pintarGrilla(act);
    cargarVisitas();
  }
  window.__tableroRender = render;
  const pedido = window.__tableroHashPedido;
  render();
  if (pedido === 'guia') abrirGuia();
  if (pedido === 'filtro' || pedido === 'infografia') $(pedido === 'filtro' ? 'pl-filtro-btn' : 'pl-info-btn').click();
})();
