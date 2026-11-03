import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Inicio, Crear, Codigo, Acceso } from './inicio';
import { accesoGuardado } from './api';
import { Partida } from './partida';

export function ir(ruta: string) { location.hash = '#' + ruta; }

function ruta() { return location.hash.replace(/^#/, '') || '/'; }

function App() {
  const [r, setR] = useState(ruta());
  useEffect(() => {
    const f = () => { setR(ruta()); window.scrollTo(0, 0); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  const [dentro, setDentro] = useState(() => accesoGuardado() != null);
  const m = r.match(/^\/p\/([A-Za-z0-9]{4})/);
  // Quien llega con el enlace o el QR de una partida entra directamente
  if (m) return <Partida key={m[1].toUpperCase()} code={m[1].toUpperCase()} />;
  if (!dentro) return <Acceso onOk={() => setDentro(true)} />;
  if (r === '/crear') return <Crear />;
  if (r === '/codigo') return <Codigo />;
  return <Inicio />;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
