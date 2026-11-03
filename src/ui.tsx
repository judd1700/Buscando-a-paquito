import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Ley, Rol } from './api';

// ── Iconos ──
export const Estrella = ({ s = 24, c = '#F4EAD2' }) => <svg aria-hidden="true" width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" /></svg>;
export const Escudo = ({ s = 24, c = '#F4EAD2' }) => <svg aria-hidden="true" width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>;
export const Corona = ({ s = 24, c = '#F4EAD2' }) => <svg aria-hidden="true" width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M3 19h18v1.5H3zM4 18l-1-10 5 4 4-7 4 7 5-4-1 10z" /></svg>;
export const Mazo = ({ s = 26, c = '#F4EAD2' }) => <svg aria-hidden="true" width={s} height={s} viewBox="0 0 24 24" fill={c}><g transform="rotate(-45 12 10)"><rect x="6.5" y="2.5" width="11" height="6" rx="1.2" /><rect x="5.2" y="3.2" width="1.8" height="4.6" rx="0.6" /><rect x="17" y="3.2" width="1.8" height="4.6" rx="0.6" /><rect x="11.1" y="8.5" width="1.8" height="11" rx="0.9" /></g><rect x="2" y="19.6" width="10" height="2.6" rx="1" /></svg>;
const Ojo = () => <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
export const Nombra = ({ s = 16, c = 'currentColor' }) => <svg aria-hidden="true" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" /><path d="M16 11h6m-2.5-2.5L22 11l-2.5 2.5" /></svg>;
const Aspa = () => <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M8 8l8 8M16 8l-8 8" /></svg>;
const CoronaLinea = () => <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 18h18M4 18l-1-10 5 4 4-7 4 7 5-4-1 10z" /></svg>;
export const Play = () => <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="#F4EAD2"><path d="M8 5v14l11-7z" /></svg>;
export const Tick = ({ c = '#1E7B3A' }) => <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6"><path d="M4 12.5l5 5L20 6" /></svg>;

export const COLOR: Record<Rol, string> = { facha: '#1F4FA3', rojo: '#C8102E', paquito: '#6E1423' };
export const NOMBRE_ROL: Record<Rol, string> = { facha: 'FACHA', rojo: 'ROJO', paquito: 'PAQUITO' };

// Escala un bloque de ancho fijo (diseño a 358 px) al ancho del móvil
export function Escalar({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const medir = () => setK(Math.min(1.15, el.clientWidth / w));
    medir();
    const ro = new ResizeObserver(medir); ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return (
    <div ref={ref} style={{ width: '100%', height: h * k, position: 'relative' }}>
      <div style={{ width: w, height: h, transform: `scale(${k})`, transformOrigin: 'top left', position: 'absolute', left: 0, top: 0 }}>{children}</div>
    </div>
  );
}

export function Cabecera({ yo, extra }: { yo?: string; extra?: ReactNode }) {
  return (
    <div className="cab">
      <span className="marca">BUSCANDO A PAQUITO</span>
      <span className="yo">{extra}{yo}</span>
    </div>
  );
}

export function Tag({ f, small }: { f?: boolean; small?: boolean }) {
  return <span className={'tag ' + (f ? 'tag-f' : 'tag-m')} style={{ fontSize: small ? 12 : 15, padding: small ? '3px 9px' : '5px 12px' }}>{f ? 'FUNCIONARIO' : 'MINISTRO'}</span>;
}

export function Puntos() {
  return <div style={{ display: 'flex', gap: 8 }}><span className="punto" /><span className="punto" style={{ animationDelay: '.2s' }} /><span className="punto" style={{ animationDelay: '.4s' }} /></div>;
}

// ── Tableros ──
const PODER = ['', 'El Ministro ve el carnet de un votante', 'El Ministro elige al próximo Funcionario', 'El Ministro elimina a un votante', 'El Ministro elimina a otro votante', 'Ganan los Rojos'];
const ICONO = [null, <Ojo key="o" />, <Nombra key="n" />, <Aspa key="a" />, <Aspa key="b" />, <CoronaLinea key="c" />];

function Hueco({ on, roja, n, label, icon, nueva }: { on: boolean; roja: boolean; n: number; label: string; icon: ReactNode; nueva: boolean }) {
  const osc = roja ? '#8E0E22' : '#17356E';
  if (on) return (
    <div data-slot={(roja ? 'roja-' : 'facha-') + n} className={nueva ? 'ley-nueva' : ''} style={{ width: 50, height: 74, background: roja ? '#C8102E' : '#1F4FA3', border: '1px solid #F4EAD2', outline: '1px solid ' + (roja ? '#4A0712' : '#0A1D40'), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: '#F4EAD2', borderRadius: 6 }}>
      <Mazo />
      <span style={{ fontFamily: 'Cinzel,serif', fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>LEY {n}</span>
    </div>
  );
  return (
    <div data-slot={(roja ? 'roja-' : 'facha-') + n} style={{ width: 50, height: 74, padding: '3px 2px', background: '#F4EAD2', border: '1px dashed ' + osc, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: osc, borderRadius: 7, textAlign: 'center' }}>
      {icon}
      <span style={{ fontFamily: 'Archivo,sans-serif', fontSize: 7.5, fontWeight: 600, lineHeight: 1.15 }}>{label}</span>
    </div>
  );
}

export function Tableros({ rojas, fachas, fallidas, nueva }: { rojas: number; fachas: number; fallidas: number; nueva?: Ley | null }) {
  const camara = (roja: boolean, children: ReactNode, cuenta: string) => (
    <div style={{ background: roja ? '#8E0E22' : '#17356E', padding: 3, boxShadow: '0 2px 0 ' + (roja ? '#4A0712' : '#0A1D40'), borderRadius: 14 }}>
      <div style={{ border: '1px solid #E9D9B4', padding: '5px 8px 6px', display: 'flex', flexDirection: 'column', gap: 5, background: `repeating-linear-gradient(135deg, ${roja ? '#9A1026' : '#1B3C7B'} 0 6px, ${roja ? '#8E0E22' : '#17356E'} 6px 12px)`, borderRadius: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#F4EAD2' }}>
          <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 12, letterSpacing: 2.5 }}>{roja ? 'CÁMARA ROJA' : 'CÁMARA FACHA'}</span>
          <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: 1.5 }}>{cuenta}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>{children}</div>
        {roja && <span style={{ fontSize: 9, color: '#F4EAD2', textAlign: 'center' }}>Desde la 3.ª ley roja: si Paquito sale elegido Funcionario, ganan los Rojos.</span>}
      </div>
    </div>
  );
  return (
    <Escalar w={358} h={278}>
      <div style={{ width: 358, display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'Oswald,sans-serif', color: '#2A1F14' }}>
        {camara(true, [0, 1, 2, 3, 4, 5].map(i => <Hueco key={i} on={i < rojas} roja n={i + 1} label={PODER[i]} icon={ICONO[i]} nueva={nueva === 'roja' && i === rojas - 1} />), `${rojas} DE 6 LEYES`)}
        {camara(false, [0, 1, 2, 3, 4].map(i => <Hueco key={i} on={i < fachas} roja={false} n={i + 1} label={i === 4 ? 'Ganan los Fachas' : ''} icon={i === 4 ? <CoronaLinea /> : null} nueva={nueva === 'facha' && i === fachas - 1} />), `${fachas} DE 5 LEYES`)}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F4EAD2', border: '1px solid #2A1F14', padding: '5px 10px', borderRadius: 999 }}>
          <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 10, letterSpacing: 1.5 }}>ELECCIONES FALLIDAS</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: 12, height: 1, background: '#2A1F14' }} />
                {i < fallidas
                  ? <span className="ley-nueva" style={{ width: 14, height: 14, borderRadius: '50%', background: '#2A1F14' }} />
                  : <span style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid #2A1F14' }} />}
              </span>
            ))}
            <span style={{ width: 12, height: 1, background: '#2A1F14' }} />
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: '#8E0E22' }}>CRISIS</span>
          </div>
        </div>
      </div>
    </Escalar>
  );
}

// ── Carta de ley ──
export function CartaLey({ t, w = 108, h = 180, grande }: { t: Ley; w?: number; h?: number; grande?: boolean }) {
  const roja = t === 'roja';
  return (
    <div style={{ width: w, height: h, padding: grande ? 7 : 5, background: roja ? '#C8102E' : '#1F4FA3', borderRadius: grande ? 14 : 10, boxShadow: grande ? '0 10px 24px rgba(60,40,20,0.35)' : '0 3px 8px rgba(60,40,20,0.25)' }}>
      <div style={{ height: '100%', border: (grande ? 1.5 : 1) + 'px solid #F4EAD2', borderRadius: grande ? 9 : 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: grande ? '14px 6px' : '10px 4px', color: '#F4EAD2', fontFamily: 'Oswald,sans-serif' }}>
        <span style={{ fontSize: grande ? 10 : 7, letterSpacing: grande ? 2 : 1.5 }}>BOLETÍN OFICIAL</span>
        {roja ? <Estrella s={grande ? 54 : 34} /> : <Escudo s={grande ? 50 : 32} />}
        <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: grande ? 24 : 16, lineHeight: 1.1, textAlign: 'center' }}>LEY<br />{roja ? 'ROJA' : 'FACHA'}</span>
        <span style={{ fontSize: grande ? 10 : 7, letterSpacing: grande ? 2 : 1.5 }}>DECRETO</span>
      </div>
    </div>
  );
}

export function DorsoLey() {
  return (
    <div style={{ width: '100%', height: '100%', borderRadius: 14, background: '#EFE3C6', border: '1.5px solid #D9CBA8', boxShadow: '0 10px 24px rgba(60,40,20,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ width: 74, height: 74, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #9A6235, #6B3E1F 60%, #4E2C14)', boxShadow: '0 0 0 4px rgba(107,62,31,0.3)' }} />
      <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 11, letterSpacing: 3, color: '#6B3E1F' }}>BOLETÍN OFICIAL</span>
    </div>
  );
}

// ── Carnet horizontal (dentro del sobre) ──
export function Carnet({ rol, nombre, partido }: { rol: Rol; nombre: string; partido?: boolean }) {
  // partido = solo se ve el partido (poder de revisar carnet): Paquito sale como ROJO
  const r: Rol = partido && rol === 'paquito' ? 'rojo' : rol;
  const c = COLOR[r];
  return (
    <div style={{ width: 290, height: 160, background: '#F4EAD2', border: '2px solid ' + c, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 10px rgba(60,40,20,0.25)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: c, color: '#F4EAD2', fontFamily: 'Oswald,sans-serif', fontSize: 10, letterSpacing: 3, textAlign: 'center', padding: '6px 0' }}>CARNET DE AFILIADO</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px' }}>
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {r === 'rojo' ? <Estrella s={32} /> : r === 'facha' ? <Escudo s={30} /> : <Corona s={32} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 30, lineHeight: 1, color: c }}>{NOMBRE_ROL[r]}</span>
          <span style={{ fontFamily: 'Oswald,sans-serif', fontSize: 12, letterSpacing: 1 }}>{r === 'paquito' ? 'Líder del Partido Rojo' : r === 'rojo' ? 'Partido Rojo' : 'Partido Facha'}</span>
          <span style={{ fontSize: 11, marginTop: 6, borderTop: '1px dotted #2A1F14', paddingTop: 3 }}>{nombre}</span>
        </div>
      </div>
    </div>
  );
}

// ── Sobre con sello de lacre ──
export function Sobre({ abierto, onSello, latiendo, selloVisible = true, children }: { abierto: boolean; onSello?: () => void; latiendo?: 'lento' | 'rapido'; selloVisible?: boolean; children: ReactNode }) {
  const abs: CSSProperties = { position: 'absolute', left: 14, width: 330 };
  return (
    <Escalar w={358} h={250}>
      <div style={{ position: 'relative', width: 358, height: 250, perspective: 900 }}>
        <div style={{ ...abs, top: 80, height: 170, background: '#E3D3AE', borderRadius: 10, boxShadow: '0 6px 14px rgba(60,40,20,0.25)' }} />
        <div style={{ position: 'absolute', left: 34, zIndex: 2, transition: 'top 0.9s cubic-bezier(.2,.8,.2,1) 0.5s, opacity 0.3s 0.5s', top: abierto ? 0 : 95, opacity: abierto ? 1 : 0 }}>{children}</div>
        <div style={{ ...abs, top: 135, height: 115, background: '#EFE3C6', clipPath: 'polygon(0 0, 50% 45%, 100% 0, 100% 100%, 0 100%)', borderRadius: '0 0 4px 4px', zIndex: 3 }} />
        <div style={{ ...abs, top: 80, height: 170, zIndex: 3, pointerEvents: 'none', background: 'linear-gradient(to top right, transparent 49.6%, rgba(120,90,50,0.18) 50%, transparent 50.4%), linear-gradient(to top left, transparent 49.6%, rgba(120,90,50,0.18) 50%, transparent 50.4%)' }} />
        <div style={{ ...abs, top: 80, height: 95, background: '#E8DAB8', clipPath: 'polygon(0 0, 100% 0, 50% 100%)', transformOrigin: 'top center', transition: 'transform 0.6s ease-in-out, z-index 0s 0.3s', transform: abierto ? 'rotateX(180deg)' : 'rotateX(0deg)', zIndex: abierto ? 1 : 4 }} />
        <button type="button" aria-label="Abrir el sobre" onClick={onSello} className={latiendo === 'rapido' ? 'late-rapido' : latiendo === 'lento' ? 'late' : ''}
          style={{ position: 'absolute', left: 145, top: 141, width: 68, height: 68, padding: 0, border: 0, borderRadius: '50%', cursor: onSello ? 'pointer' : 'default', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 35% 30%, #9A6235, #6B3E1F 60%, #4E2C14)', boxShadow: '0 0 0 4px rgba(107,62,31,0.35), 0 3px 6px rgba(0,0,0,0.35)', transition: 'opacity 0.3s', opacity: abierto || !selloVisible ? 0 : 1, pointerEvents: abierto || !onSello ? 'none' : 'auto' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: '1.5px dashed rgba(244,234,210,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play /></div>
        </button>
      </div>
    </Escalar>
  );
}

// ── Rejilla de nombres para elegir ──
export function ElegirNombre({ opciones, elegido, onPick }: { opciones: { seat: number; name: string; ok: boolean }[]; elegido: number | null; onPick: (s: number) => void }) {
  return (
    <div className="rejilla3">
      {opciones.map((o, i) => (
        <button key={o.seat} type="button" disabled={!o.ok} className={'nombre-btn entra' + (elegido === o.seat ? ' sel' : '')} style={{ animationDelay: (0.2 + i * 0.07) + 's' }} onClick={() => onPick(o.seat)}>{o.name}</button>
      ))}
    </div>
  );
}

export function Aviso({ msg }: { msg: string | null }) {
  return msg ? <div className="error" role="alert">{msg}</div> : null;
}
