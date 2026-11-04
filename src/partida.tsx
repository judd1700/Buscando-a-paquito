import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { api, guardar, leer, usePartida, type Estado, type Jugador, type Ley, type MiVista, type Rol } from './api';
import { Aviso, Cabecera, CartaLey, Carnet, COLOR, DorsoLey, ElegirNombre, NOMBRE_ROL, Nombra, Puntos, Sobre, Tableros, Tag, Tick } from './ui';

type Hacer = (a: string, arg?: number | null) => Promise<void>;
interface Ctx { code: string; st: Estado; jug: Jugador[]; v: MiVista; hacer: Hacer; nom: (s?: number | null) => string }

const vivos = (st: Estado) => (st.alive || []).map((a, i) => a ? i : -1).filter(i => i >= 0);
const cuenta = (st: Estado, key: 'continues' | 'voted' | 'ready') => vivos(st).filter(i => (st[key] || []).includes(i)).length;
// Votan los vivos menos el Ministro y el Funcionario propuestos
const votantes = (st: Estado) => vivos(st).filter(i => i !== st.ministro && i !== st.nominee);

function elegible(st: Estado, s: number) {
  if (!st.alive?.[s] || s === st.ministro) return false;
  if ((st.blocked || []).includes(s)) return false;
  const lg = st.last_gov || [];
  if (vivos(st).length > 5) return !lg.includes(s);
  return lg[1] !== s;
}
function siguienteMinistro(st: Estado) {
  const n = st.n, m = st.ministro ?? 0;
  for (let i = 1; i <= n; i++) if (st.alive?.[(m + i) % n]) return (m + i) % n;
  return m;
}

// ───────────────────────── Partida ─────────────────────────
export function Partida({ code }: { code: string }) {
  const p = usePartida(code);
  const { estado: st, jugadores: jug, vista: v } = p;
  const nom = (s?: number | null) => (s == null ? '' : jug.find(j => j.seat === s)?.name || '');

  if (p.noExiste) return (
    <div className="pantalla"><Cabecera /><div className="centro"><div className="titulo">NO EXISTE ESTA PARTIDA</div><span className="nota">Revisa el código {code}.</span><a className="btn" href="#/" style={{ maxWidth: 260 }}>VOLVER</a></div></div>
  );
  if (!st) return <div className="pantalla"><Cabecera /><div className="centro"><Puntos /></div></div>;

  if (st.phase === 'lobby') return <Sala code={code} st={st} jug={jug} p={p} />;

  if (!v || v.role == null) return (
    <div className="pantalla"><Cabecera />
      <div className="centro"><div className="titulo">LA PARTIDA YA HA EMPEZADO</div>
        <span className="nota" style={{ maxWidth: 300 }}>Este móvil no está en la partida {code}. Si eras uno de los votantes, ábrela desde el mismo móvil y navegador con el que entraste.</span>
        <a className="btn2" href="#/" style={{ maxWidth: 260 }}>VOLVER AL INICIO</a></div></div>
  );

  const ctx: Ctx = { code, st, jug, v, hacer: p.hacer, nom };
  return <Juego ctx={ctx} error={p.error} />;
}

// ───────────────────────── Sala de espera ─────────────────────────
function Sala({ code, st, jug, p }: { code: string; st: Estado; jug: Jugador[]; p: ReturnType<typeof usePartida> }) {
  const admin = leer(code).admin;
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enlace = location.origin + location.pathname + '#/p/' + code;
  const miSeat = leer(code).seat;
  const yo = p.token != null && miSeat != null ? jug.find(j => j.seat === miSeat) : undefined;
  const dentro = jug.filter(j => j.claimed).length;

  useEffect(() => {
    QRCode.toString(enlace, { type: 'svg', margin: 0, color: { dark: '#2A1F14', light: '#FFFDF7' } }).then(setQr).catch(() => setQr(''));
  }, [enlace]);

  const coger = async (seat: number) => {
    setError(null);
    try { const r = await api.entrar(code, seat); p.setToken(r.token, seat); }
    catch (e) { setError((e as Error).message); p.recargar(); }
  };
  const soltar = async () => { if (p.token) { try { await api.soltar(p.token); } catch { /* nada */ } } p.setToken(undefined); };
  const repartir = async () => { setError(null); try { await api.repartir(code, admin!); p.recargar(); } catch (e) { setError((e as Error).message); } };
  const copiar = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Buscando a Paquito', text: 'Entra en la partida ' + code, url: enlace });
      else { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    } catch { /* cancelado */ }
  };

  if (admin) return (
    <div className="pantalla">
      <Cabecera yo={'Partida ' + code} />
      <div className="titulo" style={{ fontSize: 20 }}>ESCANEAD, COMPARTID O DICTAD EL CÓDIGO</div>
      <div className="aparece" style={{ alignSelf: 'center', padding: 12, background: '#FFFDF7', border: '1px solid #D9CBA8', borderRadius: 18, width: 180, height: 180 }} dangerouslySetInnerHTML={{ __html: qr }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0, height: 44, display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: 999, background: '#FFFDF7', border: '1px solid #D9CBA8', fontSize: 13, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{enlace.replace(/^https?:\/\//, '')}</div>
        <button type="button" className="btn" style={{ width: 'auto', minHeight: 44, fontSize: 14, letterSpacing: 2 }} onClick={copiar}>{copiado ? 'COPIADO' : 'COPIAR'}</button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, fontSize: 13 }}>
        <span>o en la web, «Tengo un código»:</span>
        <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 22, letterSpacing: 4, color: '#6E1423', background: '#FFFDF7', border: '1.5px solid #6E1423', borderRadius: 999, padding: '2px 14px' }}>{code}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Oswald,sans-serif', fontSize: 13, letterSpacing: 2 }}>
        <span>HAN ENTRADO</span><span>{dentro} / {st.n}</span>
      </div>
      {!yo && <span className="nota" style={{ fontWeight: 600 }}>Toca tu nombre para entrar tú también:</span>}
      <div className="rejilla2">
        {jug.map(j => {
          const mio = yo?.seat === j.seat;
          return (
            <button key={j.seat} type="button" className="chip" disabled={!!yo || j.claimed} onClick={() => coger(j.seat)}
              style={{ cursor: !yo && !j.claimed ? 'pointer' : 'default', outline: mio ? '2px solid #6E1423' : 'none', paddingRight: 10 }}>
              <span>{j.name}{mio ? ' (tú)' : ''}</span>{j.claimed && <Tick />}
            </button>
          );
        })}
      </div>
      <Aviso msg={error} />
      <div className="abajo">
        <button type="button" className="btn" disabled={dentro < st.n} onClick={repartir}>REPARTIR SOBRES</button>
        {dentro < st.n && <span style={{ textAlign: 'center', fontSize: 13 }}>Podréis repartir cuando hayan entrado todos.</span>}
      </div>
    </div>
  );

  return (
    <div className="pantalla">
      <Cabecera yo={'Partida ' + code} />
      {!yo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="titulo" style={{ fontSize: 24 }}>¿QUIÉN ERES?</div>
          <span className="nota">Toca tu nombre. Los que ya han entrado no aparecen.</span>
          <ElegirNombre opciones={jug.filter(j => !j.claimed).map(j => ({ seat: j.seat, name: j.name, ok: true }))} elegido={null} onPick={coger} />
          <Aviso msg={error} />
        </div>
      ) : (
        <div className="centro entra">
          <div className="late" style={{ width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #9A6235, #6B3E1F 60%, #4E2C14)', boxShadow: '0 0 0 5px rgba(107,62,31,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Tick c="#F4EAD2" /></div>
          <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 30 }}>Hola, {yo.name}</span>
          <span className="nota">Estás dentro. Espera a que se reparta tu sobre.</span>
          <span style={{ fontFamily: 'Oswald,sans-serif', letterSpacing: 2, fontSize: 13 }}>HAN ENTRADO {dentro} DE {st.n}</span>
          <button type="button" className="btn2" style={{ maxWidth: 200 }} onClick={soltar}>NO SOY YO</button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Juego ─────────────────────────
function Juego({ ctx, error }: { ctx: Ctx; error: string | null }) {
  const { st, v, nom } = ctx;
  const [verCarnet, setVerCarnet] = useState(false);
  const yo = v.seat;
  const vivo = !!st.alive?.[yo];
  const enSobres = st.phase === 'sobres' || st.phase === 'abiertos';
  useEffect(() => {
    const oscuro = !vivo && st.phase !== 'fin';
    document.documentElement.classList.toggle('fuera', oscuro);
    return () => document.documentElement.classList.remove('fuera');
  }, [vivo, st.phase]);
  const [nueva, setNueva] = useState<Ley | null>(null);
  // Durante la animación de la ley, el tablero aún no la muestra
  const [ocultar, setOcultar] = useState<Ley | null>(null);
  const rojas = (st.rojas || 0) - (ocultar === 'roja' ? 1 : 0);
  const fachas = (st.fachas || 0) - (ocultar === 'facha' ? 1 : 0);

  const boton = !enSobres && (
    <button type="button" aria-label="Ver mi carnet" onClick={() => setVerCarnet(true)} style={{ border: '1px solid #2A1F14', background: '#F4EAD2', borderRadius: 999, padding: '2px 9px', fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 1.5, cursor: 'pointer' }}>MI CARNET</button>
  );

  let cuerpo: ReactNode;
  const ph = st.phase;
  if (ph === 'fin') cuerpo = <Victoria ctx={ctx} />;
  else if (enSobres) cuerpo = <FaseSobre ctx={ctx} />;
  else if (ph === 'nominar') cuerpo = st.ministro === yo ? <Proponer ctx={ctx} /> : <Espera ctx={ctx} verbo={st.skip_vote ? 'nombra sin votación al' : 'está eligiendo'} objeto="FUNCIONARIO" gris nota={st.skip_vote ? 'Poder de la 3.ª ley roja: esta vez no se vota.' : 'Cuando lo proponga, votaréis todos.'} />;
  else if (ph === 'votar') cuerpo = <Votar ctx={ctx} />;
  else if (ph === 'resultado') cuerpo = <Resultado ctx={ctx} />;
  else if (ph === 'leg_ministro' && st.ministro === yo) cuerpo = <Leyes ctx={ctx} quien="m" />;
  else if (ph === 'leg_funcionario' && st.funcionario === yo) cuerpo = <Leyes ctx={ctx} quien="f" />;
  else if (ph === 'leg_ministro' || ph === 'leg_funcionario') cuerpo = <EnSesion ctx={ctx} />;
  else if (ph === 'ley') cuerpo = <LeyAprobada key={`${st.rojas}-${st.fachas}`} ctx={ctx} setOcultar={setOcultar} setNueva={setNueva} />;
  else if (ph === 'poder' && st.ministro === yo) cuerpo = <ElegirPoder ctx={ctx} />;
  else if (ph === 'poder') cuerpo = <Espera ctx={ctx} verbo={st.power === 'carnet' ? 'va a mirar el carnet de' : 'va a eliminar a'} objeto="UN VOTANTE" nota={st.power === 'carnet' ? 'Solo verá si es Rojo o Facha.' : 'Quien salga eliminado ya no vota.'} />;
  else if (ph === 'carnet') cuerpo = st.ministro === yo ? <VerCarnetAjeno ctx={ctx} /> : <Espera ctx={ctx} verbo="está mirando el carnet de" objeto={nom(st.power_target).toUpperCase()} nota="Solo el Ministro sabe lo que ha visto. Puede decirlo… o mentir." />;
  else if (ph === 'eliminado') cuerpo = st.power_target === yo ? <EliminadoTu /> : <Eliminado ctx={ctx} />;
  else cuerpo = <div className="centro"><Puntos /></div>;

  return (
    <div className={'pantalla' + (!vivo && ph !== 'fin' ? ' fuera' : '')}>
      <Cabecera yo={nom(yo)} extra={boton} />
      <Tableros rojas={rojas} fachas={fachas} fallidas={st.fallidas || 0} nueva={nueva} />
      {!vivo && ph !== 'fin' && !(ph === 'eliminado' && st.power_target === yo) && <div className="fuera-banda">Estás fuera de la partida: puedes mirar, pero ya no votas.</div>}
      <Aviso msg={error} />
      {cuerpo}
      {verCarnet && (
        <div role="dialog" aria-label="Tu carnet" onClick={() => setVerCarnet(false)} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(42,31,20,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="aparece" style={{ width: '100%', maxWidth: 398, background: '#F2EEE6', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Sobre abierto><Carnet rol={v.role!} nombre={nom(yo)} /></Sobre>
            <LosTuyos ctx={ctx} />
            <button type="button" className="btn" onClick={() => setVerCarnet(false)}>CERRAR</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LosTuyos({ ctx, delay = 0 }: { ctx: Ctx; delay?: number }) {
  const t = ctx.v.team || [];
  if (!t.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="aparece" style={{ fontFamily: 'Oswald,sans-serif', fontSize: 12, letterSpacing: 3, animationDelay: delay + 's' }}>LOS TUYOS</span>
      <div className="rejilla2">
        {t.map((x, i) => (
          <div key={x.seat} className="chip aparece" style={{ animationDelay: (delay + 0.1 + i * 0.1) + 's' }}>
            <span>{ctx.nom(x.seat)}</span>
            <span className="pill" style={{ background: COLOR[x.role] }}>{NOMBRE_ROL[x.role]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Continuar({ ctx, texto = 'CONTINUAR', espera }: { ctx: Ctx; texto?: string; espera?: string }) {
  const { st, v, hacer } = ctx;
  const vivo = !!st.alive?.[v.seat];
  const hecho = (st.continues || []).includes(v.seat);
  const [enviando, setEnviando] = useState(false);
  if (!vivo) return <span style={{ textAlign: 'center', fontSize: 14 }}>Esperando a los votantes · {cuenta(st, 'continues')} de {vivos(st).length}</span>;
  return (
    <div className="abajo">
      {hecho && <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{espera || 'Esperando al resto'} · {cuenta(st, 'continues')} de {vivos(st).length}</span>}
      <button type="button" className="btn" disabled={hecho || enviando} onClick={async () => { setEnviando(true); await hacer('continuar'); setEnviando(false); }}>{hecho ? 'LISTO' : texto}</button>
    </div>
  );
}

// ── Sobre inicial ──
function FaseSobre({ ctx }: { ctx: Ctx }) {
  const { st, v, hacer, nom } = ctx;
  const abierto = st.phase === 'abiertos';
  const pulsado = (st.ready || []).includes(v.seat);
  const [cerrado, setCerrado] = useState(false);
  const iniciado = (st.continues || []).includes(v.seat);
  return (
    <>
      <Sobre abierto={abierto && !cerrado} onSello={!pulsado ? () => hacer('abrir_sobre') : undefined} latiendo={pulsado && !abierto ? 'rapido' : undefined}>
        <Carnet rol={v.role!} nombre={nom(v.seat)} />
      </Sobre>
      {!abierto && !pulsado && <div style={{ textAlign: 'center', fontFamily: 'Oswald,sans-serif', fontSize: 15, letterSpacing: 1 }}>Pulsa el sello. El sobre se abrirá cuando todos lo hayáis pulsado.</div>}
      {!abierto && pulsado && <div style={{ textAlign: 'center', fontFamily: 'Oswald,sans-serif', fontSize: 15, letterSpacing: 1 }}>Esperando al resto de votantes · {cuenta(st, 'ready')} de {st.n}</div>}
      {abierto && !cerrado && <>
        <LosTuyos ctx={ctx} delay={1.2} />
        {v.role === 'facha' && <span className="aparece nota" style={{ textAlign: 'center', animationDelay: '1.2s' }}>Los Fachas no saben quién es quién. Descubre a los Rojos.</span>}
        <div className="abajo"><button type="button" className="btn" onClick={() => setCerrado(true)}>CERRAR SOBRE</button></div>
      </>}
      {abierto && cerrado && <>
        {!iniciado && <div className="aparece" style={{ textAlign: 'center', fontFamily: 'Oswald,sans-serif', fontSize: 15, letterSpacing: 1 }}>Cuando todos estéis listos, empieza la partida.</div>}
        {iniciado && <div className="aparece" style={{ textAlign: 'center', fontFamily: 'Oswald,sans-serif', fontSize: 15, letterSpacing: 1 }}>Esperando a que todos inicien · {cuenta(st, 'continues')} de {st.n}</div>}
        <div className="abajo">
          <button type="button" className="btn aparece" disabled={iniciado} style={{ background: '#6E1423', boxShadow: '0 4px 0 #3A0A12', fontSize: 20 }} onClick={() => hacer('continuar')}>INICIAR PARTIDA</button>
          <button type="button" className="btn2" onClick={() => setCerrado(false)}>VOLVER A MIRAR</button>
        </div>
      </>}
    </>
  );
}

// ── Esperas ──
function Espera({ ctx, verbo, objeto, nota, gris }: { ctx: Ctx; verbo: string; objeto: string; nota?: string; gris?: boolean }) {
  return (
    <div className="centro" style={{ gap: 18 }}>
      <div className="entra" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <Tag />
        <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 34 }}>{ctx.nom(ctx.st.ministro)}</span>
      </div>
      <div className="entra" style={{ display: 'flex', alignItems: 'center', gap: 14, animationDelay: '.2s' }}>
        <div className="mira" style={{ width: 58, height: 58, borderRadius: '50%', border: '2px dashed #4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Nombra s={30} c="#4A4A4A" /></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 18, letterSpacing: 1 }}>{verbo}</span>
          <span className="tag" style={{ background: gris ? '#4A4A4A' : '#2A1F14', fontSize: 14, letterSpacing: 3, padding: '4px 12px' }}>{objeto}</span>
        </div>
      </div>
      <Puntos />
      {nota && <span className="entra nota" style={{ maxWidth: 280, animationDelay: '.4s' }}>{nota}</span>}
    </div>
  );
}

function EnSesion({ ctx }: { ctx: Ctx }) {
  const { st, nom } = ctx;
  return (
    <div className="centro entra" style={{ gap: 16 }}>
      <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 22, letterSpacing: 2 }}>SESIÓN LEGISLATIVA</span>
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><Tag small /><span style={{ fontSize: 18, fontWeight: 700 }}>{nom(st.ministro)}</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><Tag small f /><span style={{ fontSize: 18, fontWeight: 700 }}>{nom(st.funcionario)}</span></div>
      </div>
      <span className="nota">{st.phase === 'leg_ministro' ? 'El Ministro está descartando una ley' : 'El Funcionario está eligiendo qué ley aprueba'}</span>
      <Puntos />
    </div>
  );
}

// ── Proponer / nombrar Funcionario ──
function Proponer({ ctx }: { ctx: Ctx }) {
  const { st, jug, hacer } = ctx;
  const [elegido, setElegido] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const nombrar = !!st.skip_vote;
  const opciones = jug.filter(j => st.alive?.[j.seat] && j.seat !== st.ministro).map(j => ({ seat: j.seat, name: j.name, ok: elegible(st, j.seat) }));
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Tag /><span style={{ fontSize: 14, fontWeight: 600 }}>{nombrar ? 'Poder de la 3.ª ley roja' : 'Eres tú'}</span></div>
      <div className="titulo" style={{ fontSize: 24 }}>{nombrar ? 'NOMBRA AL FUNCIONARIO' : 'ELIGE A TU FUNCIONARIO'}</div>
      {nombrar && <span className="nota">Esta vez no se vota: el que elijas gobierna contigo directamente.</span>}
      <ElegirNombre opciones={opciones} elegido={elegido} onPick={setElegido} />
      {opciones.some(o => !o.ok) && <span style={{ fontSize: 12, color: '#6B5E4C' }}>Los nombres tachados no pueden ser Funcionario en este turno (último gobierno o Funcionario recién rechazado).</span>}
      <div className="abajo">
        <button type="button" className="btn" style={{ background: '#111' }} disabled={elegido == null || enviando} onClick={async () => { setEnviando(true); await hacer('proponer', elegido); setEnviando(false); }}>{nombrar ? 'NOMBRAR FUNCIONARIO' : 'PROPONER GOBIERNO'}</button>
      </div>
    </>
  );
}

// ── Votación ──
function Papeleta({ si, onClick, tf, op, delay }: { si: boolean; onClick?: () => void; tf: string; op: number; delay: string }) {
  const c = si ? '#1E7B3A' : '#C8102E';
  return (
    <div className="papeleta-entra" style={{ animationDelay: delay }}>
      <button type="button" aria-label={si ? 'Votar SÍ' : 'Votar NO'} onClick={onClick} disabled={!onClick}
        style={{ width: '100%', height: 168, background: '#FFFDF7', border: '1px solid #D9CBA8', boxShadow: '0 3px 8px rgba(60,40,20,0.15)', cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '14px 6px', transition: 'transform .6s cubic-bezier(.2,.8,.2,1), opacity .4s', transform: tf, opacity: op, borderRadius: 12 }}>
        <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 9, letterSpacing: 2 }}>PAPELETA DE VOTO</span>
        <span style={{ width: 52, height: 52, border: '2px solid ' + c, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6"><path d={si ? 'M4 12.5l5 5L20 6' : 'M6 6l12 12M18 6L6 18'} /></svg>
        </span>
        <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 48, lineHeight: 1, color: c }}>{si ? 'SÍ' : 'NO'}</span>
      </button>
    </div>
  );
}

function Gobierno({ ctx }: { ctx: Ctx }) {
  const { st, nom } = ctx;
  const caja = (f: boolean, n: string, d: string) => (
    <div className="entra" style={{ display: 'flex', flexDirection: 'column', gap: 4, background: '#FFFDF7', border: '1px solid #D9CBA8', padding: '10px 12px', borderRadius: 12, animationDelay: d, minWidth: 0 }}>
      <span style={{ alignSelf: 'flex-start' }}><Tag small f={f} /></span>
      <span style={{ fontSize: 20, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>
    </div>
  );
  return <div className="rejilla2" style={{ gap: 8 }}>{caja(false, nom(st.ministro), '0s')}{caja(true, nom(st.nominee), '.12s')}</div>;
}

function Votar({ ctx }: { ctx: Ctx }) {
  const { st, v, hacer } = ctx;
  const enGobierno = v.seat === st.ministro || v.seat === st.nominee;
  const votaYo = !!st.alive?.[v.seat] && !enGobierno;
  const servidor = v.my_vote;
  const [local, setLocal] = useState<boolean | null>(null);
  const voto = local ?? (servidor == null ? null : servidor);
  const votar = async (si: boolean) => { if (voto != null) return; setLocal(si); await hacer('votar', si ? 1 : 0); };
  const tf = (si: boolean) => voto == null ? 'none' : voto === si ? `translateX(${si ? 'calc(50% + 6px)' : 'calc(-50% - 6px)'}) scale(1.05)` : 'translateY(30px) scale(.85)';
  const op = (si: boolean) => voto == null || voto === si ? 1 : 0;
  const total = votantes(st).length;
  const hechos = votantes(st).filter(i => (st.voted || []).includes(i)).length;
  return (
    <>
      <div className="titulo">GOBIERNO PROPUESTO</div>
      <Gobierno ctx={ctx} />
      {votaYo ? (
        <div className="rejilla2" style={{ gap: 12, marginTop: 6 }}>
          <Papeleta si onClick={voto == null ? () => votar(true) : undefined} tf={tf(true)} op={op(true)} delay=".25s" />
          <Papeleta si={false} onClick={voto == null ? () => votar(false) : undefined} tf={tf(false)} op={op(false)} delay=".4s" />
        </div>
      ) : (
        <div className="centro" style={{ gap: 10 }}>
          {enGobierno && <span className="aparece" style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 20 }}>Tú no votas</span>}
          <span className="aparece nota" style={{ maxWidth: 290 }}>{enGobierno ? 'El Gobierno propuesto no vota. Los demás deciden si gobernáis.' : 'Los votantes están decidiendo.'}</span>
          <Puntos />
        </div>
      )}
      <div className="abajo">
        <div style={{ textAlign: 'center', fontFamily: 'Oswald,sans-serif', fontSize: 16, letterSpacing: 1 }}>
          {voto != null && votaYo ? `Has votado ${voto ? 'SÍ' : 'NO'} · ` : ''}Han votado {hechos} de {total}
        </div>
        {voto == null && votaYo && <span style={{ textAlign: 'center', fontSize: 12, color: '#6B5E4C' }}>El Ministro y el Funcionario propuestos no votan. Si hay empate, el gobierno queda rechazado.</span>}
      </div>
    </>
  );
}

function Resultado({ ctx }: { ctx: Ctx }) {
  const { st, jug, nom } = ctx;
  const votos = st.votes || {};
  const si = Object.values(votos).filter(Boolean).length;
  const no = Object.values(votos).length - si;
  const ok = !!st.elected;
  const crisis = !ok && (st.fallidas || 0) + 1 >= 3;
  const lista = jug.filter(j => votos[String(j.seat)] != null);
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, margin: '10px 0 6px' }}>
        <span className="sella sello-texto" style={{ color: ok ? '#1E7B3A' : '#C8102E' }}>{ok ? 'GOBIERNO APROBADO' : 'GOBIERNO RECHAZADO'}</span>
        <span className="aparece" style={{ fontSize: 15, fontWeight: 600, animationDelay: '.3s', textAlign: 'center' }}>
          {si} SÍ · {no} NO · {ok ? `${nom(st.ministro)} y ${nom(st.nominee)} gobiernan` : crisis ? '¡tercer rechazo: crisis!' : 'el contador de crisis sube'}
        </span>
      </div>
      <div className="rejilla2">
        {lista.map((j, i) => {
          const s = votos[String(j.seat)];
          return (
            <div key={j.seat} className="chip entra" style={{ height: 40, animationDelay: (0.4 + i * 0.08) + 's' }}>
              <span style={{ fontSize: 16 }}>{j.name}</span>
              <span className="gira" style={{ background: s ? '#1E7B3A' : '#C8102E', color: '#fff', fontFamily: 'Oswald,sans-serif', fontWeight: 500, fontSize: 14, padding: '2px 10px', borderRadius: 999, animationDelay: (0.6 + i * 0.08) + 's' }}>{s ? 'SÍ' : 'NO'}</span>
            </div>
          );
        })}
      </div>
      {!ok && <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{crisis ? 'Se aprobará automáticamente la primera ley del mazo.' : `El cargo de Ministro pasa a ${nom(siguienteMinistro(st))}`}</span>}
      <Continuar ctx={ctx} />
    </>
  );
}

// ── Sesión legislativa (Ministro y Funcionario) ──
function Leyes({ ctx, quien }: { ctx: Ctx; quien: 'm' | 'f' }) {
  const { v, hacer } = ctx;
  const mano = (v.hand || []) as Ley[];
  const [sel, setSel] = useState<number | null>(null);
  const [fase, setFase] = useState<'elige' | 'marcada' | 'lista' | 'enviando'>('elige');
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  const m = quien === 'm';
  const pick = (i: number) => {
    if (fase !== 'elige') return;
    setSel(i); setFase('marcada');
    t.current = window.setTimeout(() => setFase('lista'), 900);
  };
  const enviar = async () => {
    setFase('enviando');
    await new Promise(r => setTimeout(r, m ? 800 : 300));
    await hacer(m ? 'descartar' : 'aprobar', sel);
  };
  const deshacer = () => { setSel(null); setFase('elige'); };
  const W = 358;
  const pos3 = [0, 125, 250], pos2 = [61, 189];
  const titulo = m
    ? (fase === 'lista' ? 'ESTAS DOS LEYES PASAN AL FUNCIONARIO' : fase === 'enviando' ? 'ENVIANDO AL FUNCIONARIO…' : 'TOCA LA LEY QUE QUIERES DESCARTAR')
    : (fase === 'elige' ? 'TE LLEGAN DOS LEYES: TOCA LA QUE APRUEBAS' : fase === 'enviando' ? 'APROBANDO…' : 'ESTA ES LA LEY QUE APRUEBAS');
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Tag f={!m} /><span style={{ fontSize: 14, fontWeight: 600 }}>Solo lo ves tú</span></div>
      <div className="titulo" style={{ minHeight: 52 }}>{titulo}</div>
      <EscalaFila w={W}>
        {mano.map((c, i) => {
          let left = (m ? pos3 : pos2)[i] ?? 0, tf = 'none', op = 1, z = 1;
          const marcada = sel === i;
          if (m) {
            if (fase === 'marcada' && marcada) op = 0.6;
            if (fase === 'lista' || fase === 'enviando') {
              const vivas = [0, 1, 2].filter(k => k !== sel);
              if (marcada) { op = 0; tf = 'translateY(40px) scale(.8)'; } else left = pos2[vivas.indexOf(i)];
            }
            if (fase === 'enviando' && !marcada) { tf = 'translate(320px,-40px) rotate(25deg) scale(.7)'; op = 0; }
          } else if (sel != null) {
            if (marcada) { left = 125; z = 3; if (fase === 'enviando') tf = 'translateY(-60px) scale(1.08)'; }
            else { op = fase === 'marcada' ? 0.6 : 0; tf = fase === 'marcada' ? 'none' : 'translateY(40px) scale(.8)'; }
          }
          const sello = (m && fase === 'marcada' && marcada) || (!m && fase === 'marcada' && !marcada);
          return (
            <div key={i} className={m ? 'reparte' : 'llega'} style={{ position: 'absolute', top: 8, left, zIndex: z, transition: 'left .6s cubic-bezier(.2,.8,.2,1)', animationDelay: (i * (m ? 0.15 : 0.18)) + 's' }}>
              <button type="button" aria-label={'Ley ' + c} onClick={() => pick(i)} style={{ position: 'relative', padding: 0, border: 0, background: 'transparent', cursor: fase === 'elige' ? 'pointer' : 'default', transition: 'transform .7s cubic-bezier(.4,0,.2,1), opacity .5s', transform: tf, opacity: op }}>
                <CartaLey t={c} />
                {sello && <span className="sella2" style={{ position: 'absolute', top: 76, left: -6, right: -6, background: '#F2EEE6', color: '#2A1F14', border: '2px solid #2A1F14', fontFamily: 'Oswald,sans-serif', fontSize: 12, letterSpacing: 2, padding: '3px 0', textAlign: 'center', borderRadius: 6 }}>DESCARTADA</span>}
              </button>
            </div>
          );
        })}
      </EscalaFila>
      {fase === 'lista' && (
        <div className="abajo">
          <button type="button" className="btn entra" style={{ background: '#111' }} onClick={enviar}>{m ? 'PASAR 2 AL FUNCIONARIO' : 'APROBAR LEY'}</button>
          <button type="button" className="btn2" onClick={deshacer}>ME HE EQUIVOCADO</button>
        </div>
      )}
    </>
  );
}

function EscalaFila({ w, children }: { w: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => setK(Math.min(1, el.clientWidth / w)); f();
    const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect();
  }, [w]);
  return <div ref={ref} style={{ width: '100%', height: 196 * k, position: 'relative' }}><div style={{ position: 'absolute', width: w, height: 196, transform: `scale(${k})`, transformOrigin: 'top left' }}>{children}</div></div>;
}

// ── La ley llega a todos (con giro y vuelo al tablero) ──
function LeyAprobada({ ctx, setOcultar, setNueva }: { ctx: Ctx; setOcultar: (l: Ley | null) => void; setNueva: (l: Ley | null) => void }) {
  const { st, code } = ctx;
  const ley = st.last_law as Ley;
  const crisis = !!st.by_crisis;
  const clave = `paquito-ley:${code}:${st.rojas}-${st.fachas}`;
  const yaVista = (() => { try { return sessionStorage.getItem(clave) === '1'; } catch { return false; } })();
  const [fase, setFase] = useState<'aviso' | 'carta' | 'vuela' | 'puesta'>(yaVista ? 'puesta' : crisis ? 'aviso' : 'carta');
  const [tf, setTf] = useState('none');
  const carta = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (fase !== 'puesta') setOcultar(ley);
    return () => { setOcultar(null); setNueva(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let t: number;
    if (fase === 'aviso') t = window.setTimeout(() => setFase('carta'), 1800);
    if (fase === 'carta') t = window.setTimeout(() => {
      const n = ley === 'roja' ? st.rojas : st.fachas;
      const hueco = document.querySelector(`[data-slot="${ley}-${n}"]`);
      const c = carta.current;
      if (hueco && c) {
        const a = hueco.getBoundingClientRect(), b = c.getBoundingClientRect();
        setTf(`translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width})`);
      }
      setFase('vuela');
    }, 2300);
    if (fase === 'vuela') t = window.setTimeout(() => {
      setOcultar(null); setNueva(ley); setFase('puesta');
      try { sessionStorage.setItem(clave, '1'); } catch { /* nada */ }
    }, 1050);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const roja = ley === 'roja';
  const ganan = (st.rojas || 0) >= 6 || (st.fachas || 0) >= 5;
  let sub = '', texto = '', extra = '';
  if (crisis) { sub = 'LEY APROBADA POR CRISIS'; texto = 'El contador vuelve a cero.'; extra = 'El gobierno rechazado no puede repetir en la próxima propuesta. Esta ley no tiene poder.'; }
  else if (ganan) { sub = roja ? 'SEXTA LEY ROJA' : 'QUINTA LEY FACHA'; texto = roja ? '¡Ganan los Rojos!' : '¡Ganan los Fachas!'; }
  else if (roja) {
    const r = st.rojas || 0;
    sub = ['', 'PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA'][r] + ' LEY ROJA';
    texto = ['', 'Esta ley no tiene poder.', 'El Ministro verá en secreto el carnet de un votante.', 'El próximo Ministro elige al Funcionario sin votación.', 'El Ministro elimina a un votante.', 'El Ministro elimina a otro votante.'][r];
    if (r === 3) extra = 'A partir de ahora, si Paquito sale elegido Funcionario, ganan los Rojos.';
  } else { sub = 'LEY FACHA'; texto = `A los Fachas les faltan ${5 - (st.fachas || 0)} leyes para ganar.`; }

  return (
    <>
      {fase === 'aviso' && (
        <div className="centro aparece">
          <span className="sella" style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 30, letterSpacing: 2, color: '#8E0E22', border: '3px double #8E0E22', borderRadius: 12, padding: '6px 18px' }}>CRISIS</span>
          <span className="nota" style={{ fontSize: 15, maxWidth: 290 }}>Tercer gobierno rechazado. Se aprueba la primera ley del mazo, sin poderes.</span>
        </div>
      )}
      {(fase === 'carta' || fase === 'vuela') && (
        <div className="centro" style={{ justifyContent: 'flex-start', gap: 16 }}>
          <div style={{ fontFamily: 'Oswald,sans-serif', fontWeight: 500, fontSize: crisis ? 20 : 22, letterSpacing: 2, color: crisis ? '#8E0E22' : roja ? '#C8102E' : '#1F4FA3', transition: 'opacity .4s', opacity: fase === 'vuela' ? 0 : 1 }}>
            {crisis ? 'LEY AUTOMÁTICA POR CRISIS' : roja ? 'LEY ROJA APROBADA' : 'LEY FACHA APROBADA'}
          </div>
          <div ref={carta} style={{ width: 160, height: 237, zIndex: 5, perspective: 900, transformOrigin: 'top left', transition: 'transform 1s cubic-bezier(.5,0,.2,1)', transform: tf }}>
            <div className="gira3d" style={{ position: 'relative', width: 160, height: 237 }}>
              <div className="cara"><CartaLey t={ley} w={160} h={237} grande /></div>
              <div className="cara dorso"><DorsoLey /></div>
            </div>
          </div>
        </div>
      )}
      {fase === 'puesta' && (
        <>
          <div className="centro aparece" style={{ gap: 12, animationDelay: '.3s' }}>
            <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 13, letterSpacing: 3 }}>{sub}</span>
            <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 20, lineHeight: 1.3, maxWidth: 300 }}>{texto}</span>
            {extra && <span style={{ fontSize: 13, maxWidth: 290, lineHeight: 1.4, color: '#8E0E22' }}>{extra}</span>}
          </div>
          <Continuar ctx={ctx} />
        </>
      )}
    </>
  );
}

// ── Poderes ──
function ElegirPoder({ ctx }: { ctx: Ctx }) {
  const { st, jug, v, hacer } = ctx;
  const [elegido, setElegido] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const carnet = st.power === 'carnet';
  const opciones = jug.filter(j => st.alive?.[j.seat] && j.seat !== v.seat).map(j => ({ seat: j.seat, name: j.name, ok: true }));
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Tag /><span style={{ fontSize: 14, fontWeight: 600 }}>Poder de la {st.rojas}.ª ley roja{carnet ? ' · solo lo ves tú' : ''}</span></div>
      <div className="titulo">{carnet ? '¿DE QUIÉN QUIERES VER EL CARNET?' : '¿A QUIÉN ELIMINAS?'}</div>
      {!carnet && <span className="nota">Quien elimines queda fuera de la partida. Si eliminas a Paquito, ganan los Fachas.</span>}
      <ElegirNombre opciones={opciones} elegido={elegido} onPick={setElegido} />
      <div className="abajo">
        <button type="button" className="btn" style={{ background: carnet ? '#111' : '#8E0E22', boxShadow: '0 4px 0 #0E0A06' }} disabled={elegido == null || enviando}
          onClick={async () => { setEnviando(true); await hacer(carnet ? 'revisar' : 'eliminar', elegido); setEnviando(false); }}>{carnet ? 'REVISAR CARNET' : 'ELIMINAR'}</button>
      </div>
    </>
  );
}

function VerCarnetAjeno({ ctx }: { ctx: Ctx }) {
  const { v, nom, hacer } = ctx;
  const inv = v.investigation;
  const [abierto, setAbierto] = useState(false);
  if (!inv) return <div className="centro"><Puntos /></div>;
  return (
    <>
      <div style={{ fontFamily: 'Oswald,sans-serif', fontWeight: 500, fontSize: 18, letterSpacing: 3, textAlign: 'center' }}>EL CARNET DE {nom(inv.seat).toUpperCase()}</div>
      <div className="llega-sobre">
        <Sobre abierto={abierto} onSello={() => setAbierto(true)} latiendo="lento">
          <Carnet rol={inv.party as Rol} nombre={nom(inv.seat)} partido />
        </Sobre>
      </div>
      {!abierto && <div style={{ textAlign: 'center', fontFamily: 'Oswald,sans-serif', fontSize: 15, letterSpacing: 1 }}>Pulsa el sello para abrirlo</div>}
      {abierto && <span className="aparece nota" style={{ textAlign: 'center' }}>Solo ves el partido: Paquito sale como Rojo.</span>}
      {abierto && <div className="abajo"><button type="button" className="btn" onClick={() => hacer('continuar')}>ENTENDIDO</button></div>}
    </>
  );
}

function Eliminado({ ctx }: { ctx: Ctx }) {
  const n = ctx.nom(ctx.st.power_target);
  return (
    <>
      <div className="centro">
        <span className="aparece" style={{ fontFamily: 'Oswald,sans-serif', fontSize: 13, letterSpacing: 3 }}>EL MINISTRO HA ELIMINADO A</span>
        <div className="aparece" style={{ position: 'relative', padding: '12px 34px', borderRadius: 14, background: '#FFFDF7', border: '1px solid #D9CBA8', animationDelay: '.2s' }}>
          <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 36 }}>{n}</span>
          <div className="tacha" style={{ position: 'absolute', left: 10, right: 10, top: '50%', height: 4, borderRadius: 4, background: '#8E0E22' }} />
        </div>
        <span className="aparece nota" style={{ maxWidth: 290, animationDelay: '1s' }}>{n} ya no vota y no puede ser Ministro ni Funcionario. No se sabe qué carnet tenía.</span>
      </div>
      <Continuar ctx={ctx} />
    </>
  );
}

function EliminadoTu() {
  return (
    <div className="centro" style={{ gap: 16 }}>
      <span className="aparece" style={{ fontFamily: 'Oswald,sans-serif', fontSize: 14, letterSpacing: 3 }}>EL MINISTRO</span>
      <span className="aparece" style={{ fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 30, lineHeight: 1.15, color: '#8E0E22', animationDelay: '.2s' }}>TE HA ELIMINADO</span>
      <div className="sella" style={{ width: 110, height: 110, borderRadius: '50%', border: '3px double #8E0E22', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8E0E22', fontFamily: 'Oswald,sans-serif', fontSize: 18, letterSpacing: 3, lineHeight: 1.1, animationDelay: '.6s' }}>ESTÁS<br />FUERA</div>
      <span className="aparece nota" style={{ fontSize: 15, maxWidth: 290, animationDelay: '1s' }}>Puedes seguir mirando la partida, pero ya no votas ni tienes cargos. No digas qué carnet tenías.</span>
    </div>
  );
}

// ── Final ──
function Victoria({ ctx }: { ctx: Ctx }) {
  const { st, jug } = ctx;
  const rojos = st.winner === 'rojos';
  const roles = st.roles || [];
  const nuevaPartida = () => { guardar(ctx.code, {}); location.hash = '#/'; };
  return (
    <>
      <div className="centro" style={{ gap: 12 }}>
        <span className="aparece" style={{ fontFamily: 'Oswald,sans-serif', fontSize: 18, letterSpacing: 8 }}>GANAN LOS</span>
        <div className="cinta" style={{ display: 'flex', alignItems: 'stretch', height: 74, animationDelay: '.2s' }}>
          <div style={{ width: 22, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 45% 50%)', background: rojos ? '#8E0E22' : '#17356E' }} />
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 26px', color: '#F4EAD2', fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 46, letterSpacing: 4, background: rojos ? '#C8102E' : '#1F4FA3' }}>{rojos ? 'ROJOS' : 'FACHAS'}</div>
          <div style={{ width: 22, clipPath: 'polygon(0 0, 100% 0, 55% 50%, 100% 100%, 0 100%)', background: rojos ? '#8E0E22' : '#17356E' }} />
        </div>
        <span className="aparece" style={{ fontFamily: 'Oswald,sans-serif', fontSize: 16, letterSpacing: 1, animationDelay: '.8s' }}>{st.reason}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="aparece" style={{ fontFamily: 'Oswald,sans-serif', fontSize: 12, letterSpacing: 3, animationDelay: '1.1s' }}>ASÍ ESTABAN LOS CARNETS</span>
        <div className="rejilla2">
          {jug.map((j, i) => {
            const r = roles[j.seat];
            return (
              <div key={j.seat} className="chip entra" style={{ animationDelay: (1.2 + i * 0.06) + 's', opacity: st.alive?.[j.seat] ? 1 : 0.6 }}>
                <span style={{ textDecoration: st.alive?.[j.seat] ? 'none' : 'line-through' }}>{j.name}</span>
                {r && <span className="pill" style={{ background: COLOR[r] }}>{NOMBRE_ROL[r]}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <button type="button" className="btn" onClick={nuevaPartida}>NUEVA PARTIDA</button>
    </>
  );
}

