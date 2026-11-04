import { useState } from 'react';
import { api, configurado, existe, guardar, guardarAcceso } from './api';
import { Cabecera, Aviso } from './ui';
import { ir } from './main';

export function Logo() {
  return (
    <svg className="sube tiembla" role="img" aria-label="Estrado de juez con un mazo" width="250" height="200" viewBox="0 0 220 176">
      <ellipse cx="110" cy="170" rx="100" ry="5" fill="#2A1A0B" opacity="0.15" />
      <path d="M78 66 L78 26 Q78 6 110 6 Q142 6 142 26 L142 66 Z" fill="#6E1423" />
      <path d="M86 62 L86 28 Q86 14 110 14 Q134 14 134 28 L134 62 Z" fill="none" stroke="#9A2A3C" strokeWidth="1.5" />
      <circle cx="110" cy="10" r="4" fill="#C9A24A" />
      <rect x="26" y="64" width="168" height="11" rx="3" fill="#3A2210" />
      <path d="M38 75 L182 75 L174 148 L46 148 Z" fill="#5A3519" />
      <path d="M50 84 L80 84 L78 140 L52 140 Z" fill="#6B4123" />
      <path d="M140 84 L170 84 L168 140 L142 140 Z" fill="#6B4123" />
      <path d="M90 84 L130 84 L130 140 L90 140 Z" fill="#6B4123" />
      <circle cx="110" cy="108" r="14" fill="#C9A24A" />
      <circle cx="110" cy="108" r="10" fill="none" stroke="#5A3519" strokeWidth="1.5" />
      <path d="M104 106 L116 106 M110 101 L110 115 M103 106 L101 111 L107 111 Z M117 106 L115 111 L121 111 Z" stroke="#5A3519" strokeWidth="1.2" fill="#5A3519" />
      <rect x="20" y="148" width="180" height="9" rx="2" fill="#3A2210" />
      <rect x="10" y="157" width="200" height="11" rx="2" fill="#2A1A0B" />
      <rect x="148" y="58" width="28" height="6" rx="2" fill="#2A1A0B" />
      <g className="mazo">
        <rect x="150" y="30" width="24" height="12" rx="4" fill="#2A1A0B" />
        <rect x="147" y="31.5" width="4" height="9" rx="1.5" fill="#C9A24A" />
        <rect x="173" y="31.5" width="4" height="9" rx="1.5" fill="#C9A24A" />
        <rect x="160" y="40" width="4" height="19" rx="2" fill="#3A2210" transform="rotate(32 162 42)" />
      </g>
    </svg>
  );
}

export function Cinta({ izq, der, alto = 30, size = 13 }: { izq: string; der: string; alto?: number; size?: number }) {
  return (
    <div className="cinta" style={{ display: 'flex', alignItems: 'stretch', height: alto, marginTop: 6, animationDelay: '1.1s' }}>
      <div style={{ width: 14, background: '#8E0E22', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 45% 50%)' }} />
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', background: '#C8102E', color: '#F4EAD2', fontFamily: 'Oswald,sans-serif', fontSize: size, letterSpacing: 2 }}>{izq}</div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', background: '#1F4FA3', color: '#F4EAD2', fontFamily: 'Oswald,sans-serif', fontSize: size, letterSpacing: 2 }}>{der}</div>
      <div style={{ width: 14, background: '#17356E', clipPath: 'polygon(0 0, 100% 0, 55% 50%, 100% 100%, 0 100%)' }} />
    </div>
  );
}

export function Inicio() {
  return (
    <div className="pantalla" style={{ padding: 24, background: 'radial-gradient(ellipse at 50% 30%, #F8F3E8 0%, #F2EEE6 55%, #E8E0D0 100%)', alignItems: 'center' }}>
      <div className="centro" style={{ gap: 10, width: '100%' }}>
        <Logo />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span className="aparece" style={{ fontFamily: 'Oswald,sans-serif', fontSize: 17, letterSpacing: 10, animationDelay: '.6s' }}>BUSCANDO A</span>
          <h1 className="aparece" style={{ margin: 0, fontFamily: 'Cinzel,serif', fontWeight: 900, fontSize: 52, letterSpacing: 2, lineHeight: 1.05, color: '#6E1423', animationDelay: '.8s' }}>PAQUITO</h1>
        </div>
        <Cinta izq="UN JUEGO DE ROJOS" der="Y FACHAS" />
      </div>
      <div className="aparece" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, animationDelay: '1.5s' }}>
        {!configurado && <div className="error">Versión de prueba: falta conectar la base de datos.</div>}
        <a className="btn" href="#/crear" style={{ fontSize: 20 }}>CREAR PARTIDA</a>
        <a className="btn2" href="#/codigo" style={{ minHeight: 50, fontSize: 17 }}>TENGO UN CÓDIGO</a>
        <span style={{ textAlign: 'center', fontSize: 12, marginTop: 4 }}>De 4 a 15 votantes · cada uno con su móvil</span>
      </div>
    </div>
  );
}

export function Crear() {
  const [texto, setTexto] = useState('');
  const [lista, setLista] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const anadir = () => {
    const t = texto.trim().replace(/\s+/g, ' ').slice(0, 16);
    if (!t) return;
    if (lista.length >= 15) { setError('Como máximo 15 votantes.'); return; }
    if (lista.some(n => n.toLowerCase() === t.toLowerCase())) { setError('Ese nombre ya está. Añade una inicial para distinguirlos.'); return; }
    setLista([...lista, t]); setTexto(''); setError(null);
  };
  const siguiente = async () => {
    setEnviando(true); setError(null);
    try {
      const r = await api.crear(lista);
      guardar(r.code, { admin: r.admin_token });
      ir('/p/' + r.code);
    } catch (e) { setError((e as Error).message); setEnviando(false); }
  };
  return (
    <div className="pantalla">
      <Cabecera yo="Nueva partida" />
      <div className="titulo" style={{ fontSize: 24 }}>¿QUIÉN VA A VOTAR?</div>
      <span className="nota">Escribe los nombres en el orden en que estáis sentados. Ese será el orden de los Ministros. Tú también cuentas.</span>
      <form style={{ display: 'flex', gap: 8 }} onSubmit={e => { e.preventDefault(); anadir(); }}>
        <label htmlFor="nombre-votante" style={{ position: 'absolute', left: -9999 }}>Nombre del votante</label>
        <input id="nombre-votante" value={texto} onChange={e => setTexto(e.target.value)} placeholder="Nombre del votante" autoComplete="off"
          style={{ flex: 1, minWidth: 0, height: 50, borderRadius: 999, border: '1.5px solid #2A1F14', background: '#FFFDF7', padding: '0 18px', fontSize: 17, fontFamily: 'Archivo,sans-serif' }} />
        <button type="submit" className="btn" style={{ width: 'auto', minHeight: 50, fontSize: 15, letterSpacing: 2 }}>AÑADIR</button>
      </form>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Oswald,sans-serif', fontSize: 13, letterSpacing: 2 }}>
        <span>VOTANTES</span><span>{lista.length} / 15</span>
      </div>
      <div className="rejilla2">
        {lista.map((n, i) => (
          <div key={n} className="chip entra">
            <span><span style={{ fontFamily: 'Oswald,sans-serif', color: '#8A7F6E', marginRight: 8 }}>{i + 1}</span>{n}</span>
            <button type="button" aria-label={'Quitar a ' + n} onClick={() => setLista(lista.filter(x => x !== n))} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 6px', color: '#8A7F6E' }}>×</button>
          </div>
        ))}
      </div>
      <Aviso msg={error} />
      <div className="abajo">
        <span style={{ textAlign: 'center', fontSize: 13 }}>{lista.length < 4 ? `Faltan ${4 - lista.length} para poder empezar` : 'Ya podéis empezar'}</span>
        <button type="button" className="btn" disabled={lista.length < 4 || enviando} onClick={siguiente}>{enviando ? 'CREANDO…' : 'SIGUIENTE'}</button>
      </div>
    </div>
  );
}

export function Codigo() {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const entrar = async () => {
    const c = codigo.trim().toUpperCase();
    if (c.length !== 4) { setError('El código tiene 4 letras o números.'); return; }
    try { if (await existe(c)) ir('/p/' + c); else setError('No existe ninguna partida con ese código.'); }
    catch (e) { setError((e as Error).message); }
  };
  return (
    <div className="pantalla">
      <Cabecera />
      <div className="centro entra" style={{ gap: 16 }}>
        <div className="titulo" style={{ fontSize: 24 }}>CÓDIGO DE LA PARTIDA</div>
        <span className="nota" style={{ maxWidth: 300 }}>Pídeselo a quien ha creado la partida. Si has escaneado el QR o abierto el enlace, no hace falta.</span>
        <label htmlFor="codigo" style={{ position: 'absolute', left: -9999 }}>Código de la partida</label>
        <input id="codigo" maxLength={4} value={codigo} placeholder="····" autoCapitalize="characters" autoComplete="off"
          onChange={e => setCodigo(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') entrar(); }}
          style={{ width: 220, height: 80, textAlign: 'center', fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 44, letterSpacing: 12, borderRadius: 18, border: '2px solid #2A1F14', background: '#FFFDF7', color: '#6E1423' }} />
        <Aviso msg={error} />
        <button type="button" className="btn" style={{ maxWidth: 260 }} onClick={entrar}>ENTRAR</button>
        <a href="#/" className="nota" style={{ color: '#2A1F14' }}>Volver</a>
      </div>
    </div>
  );
}

export function Acceso({ onOk }: { onOk: () => void }) {
  const [c, setC] = useState('');
  const [error, setError] = useState<string | null>(null);
  const entrar = async () => {
    setError(null);
    try {
      if (await api.comprobarAcceso(c)) { guardarAcceso(c.trim()); onOk(); }
      else setError('Código incorrecto.');
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <div className="pantalla" style={{ padding: 24, background: 'radial-gradient(ellipse at 50% 30%, #F8F3E8 0%, #F2EEE6 55%, #E8E0D0 100%)' }}>
      <div className="centro" style={{ gap: 18 }}>
        <div className="late" style={{ width: 96, height: 96, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #9A6235, #6B3E1F 60%, #4E2C14)', boxShadow: '0 0 0 5px rgba(107,62,31,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg aria-hidden="true" width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#F4EAD2" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        </div>
        <span style={{ fontFamily: 'Cinzel,serif', fontWeight: 700, fontSize: 22, letterSpacing: 2 }}>ACCESO RESTRINGIDO</span>
        <span className="nota" style={{ maxWidth: 290 }}>Esta web aún es privada. Escribe el código de acceso para entrar.</span>
        <label htmlFor="acceso" style={{ position: 'absolute', left: -9999 }}>Código de acceso</label>
        <input id="acceso" type="password" value={c} onChange={e => setC(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') entrar(); }} autoComplete="off"
          style={{ width: '100%', maxWidth: 280, height: 56, textAlign: 'center', fontSize: 22, letterSpacing: 4, borderRadius: 999, border: '2px solid #2A1F14', background: '#FFFDF7' }} />
        <Aviso msg={error} />
        <button type="button" className="btn" style={{ maxWidth: 280 }} disabled={!c.trim()} onClick={entrar}>ENTRAR</button>
      </div>
    </div>
  );
}
