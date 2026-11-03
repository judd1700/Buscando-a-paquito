import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

const URL_SB = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY_SB = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const configurado = Boolean(URL_SB && KEY_SB);
export const sb: SupabaseClient | null = configurado ? createClient(URL_SB!, KEY_SB!) : null;

export type Rol = 'facha' | 'rojo' | 'paquito';
export type Ley = 'roja' | 'facha';

export interface Estado {
  phase: string;
  n: number;
  alive?: boolean[];
  ministro?: number;
  nominee?: number | null;
  funcionario?: number | null;
  rojas?: number;
  fachas?: number;
  fallidas?: number;
  last_gov?: number[];
  blocked?: number[];
  skip_vote?: boolean;
  appointed?: boolean;
  ready?: number[];
  continues?: number[];
  voted?: number[];
  votes?: Record<string, boolean> | null;
  elected?: boolean;
  last_law?: Ley;
  by_crisis?: boolean;
  power?: 'carnet' | 'eliminar' | null;
  power_target?: number | null;
  winner?: 'rojos' | 'fachas';
  reason?: string;
  roles?: Rol[];
}

export interface Jugador { seat: number; name: string; claimed: boolean }
export interface MiVista {
  seat: number;
  role?: Rol;
  team?: { seat: number; role: Rol }[];
  hand?: Ley[] | null;
  investigation?: { seat: number; party: 'facha' | 'rojo' } | null;
  my_vote?: boolean | null;
}

// ── Lo que guarda cada móvil ──
interface Guardado { token?: string; seat?: number; admin?: string }
const clave = (code: string) => 'paquito:' + code.toUpperCase();
export function leer(code: string): Guardado {
  try { return JSON.parse(localStorage.getItem(clave(code)) || '{}'); } catch { return {}; }
}
export function guardar(code: string, g: Guardado) {
  try { localStorage.setItem(clave(code), JSON.stringify({ ...leer(code), ...g })); } catch { /* sin almacenamiento */ }
}
export function olvidarToken(code: string) {
  const g = leer(code); delete g.token; delete g.seat;
  try { localStorage.setItem(clave(code), JSON.stringify(g)); } catch { /* nada */ }
}

function traducir(e: unknown): string {
  const m = (e as { message?: string })?.message || String(e);
  if (/fetch|network/i.test(m)) return 'No hay conexión. Comprueba internet y vuelve a intentarlo.';
  return m;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!sb) throw new Error('La web aún no está conectada a la base de datos.');
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(traducir(error));
  return data as T;
}

export function accesoGuardado(): string | null {
  try { return localStorage.getItem('paquito:acceso'); } catch { return null; }
}
export function guardarAcceso(c: string) {
  try { localStorage.setItem('paquito:acceso', c); } catch { /* nada */ }
}

export const api = {
  comprobarAcceso: (c: string) => rpc<boolean>('check_access', { p_access: c }),
  crear: (nombres: string[]) => rpc<{ game_id: string; code: string; admin_token: string }>('create_game', { p_names: nombres, p_access: accesoGuardado() || '' }),
  entrar: (code: string, seat: number) => rpc<{ game_id: string; seat: number; token: string }>('claim_seat', { p_code: code, p_seat: seat }),
  soltar: (token: string) => rpc<void>('release_seat', { p_token: token }),
  repartir: (code: string, admin: string) => rpc<void>('deal', { p_code: code, p_admin_token: admin }),
  vista: (token: string) => rpc<MiVista>('my_view', { p_token: token }),
  accion: (token: string, action: string, arg: number | null = null) => rpc<void>('act', { p_token: token, p_action: action, p_arg: arg }),
};

export async function existe(code: string): Promise<boolean> {
  if (!sb) throw new Error('La web aún no está conectada a la base de datos.');
  const { data, error } = await sb.from('games').select('id').eq('code', code.toUpperCase()).maybeSingle();
  if (error) throw new Error(traducir(error));
  return Boolean(data);
}

// ── Partida en tiempo real ──
export function usePartida(code: string) {
  const [gameId, setGameId] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [vista, setVista] = useState<MiVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [token, setTokenState] = useState<string | undefined>(() => leer(code).token);
  const ultimo = useRef('');

  const cargar = useCallback(async () => {
    if (!sb) return;
    const { data: g, error: e1 } = await sb.from('games').select('id,state,updated_at').eq('code', code.toUpperCase()).maybeSingle();
    if (e1) { setError(traducir(e1)); return; }
    if (!g) { setNoExiste(true); return; }
    setGameId(g.id);
    const huella = g.updated_at + JSON.stringify(g.state);
    const { data: ps } = await sb.from('players').select('seat,name,claimed').eq('game_id', g.id).order('seat');
    setJugadores((ps as Jugador[]) || []);
    if (huella !== ultimo.current) {
      ultimo.current = huella;
      setEstado(g.state as Estado);
    }
    const t = leer(code).token;
    if (t) {
      try { setVista(await api.vista(t)); setError(null); }
      catch (e) { const m = traducir(e); if (/reconozco/.test(m)) { olvidarToken(code); setTokenState(undefined); setVista(null); } else setError(m); }
    } else setVista(null);
  }, [code]);

  useEffect(() => {
    cargar();
    // Además del tiempo real, comprobamos cada 4 s por si el móvil se ha dormido
    const iv = setInterval(cargar, 4000);
    const vis = () => { if (document.visibilityState === 'visible') cargar(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, [cargar]);

  useEffect(() => {
    if (!sb || !gameId) return;
    const ch = sb.channel('partida-' + gameId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: 'id=eq.' + gameId }, () => cargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: 'game_id=eq.' + gameId }, () => cargar())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [gameId, cargar]);

  const setToken = (t: string | undefined, seat?: number) => {
    if (t) guardar(code, { token: t, seat }); else olvidarToken(code);
    setTokenState(t);
    cargar();
  };

  const hacer = useCallback(async (action: string, arg: number | null = null) => {
    const t = leer(code).token;
    if (!t) return;
    try { await api.accion(t, action, arg); setError(null); } catch (e) { setError(traducir(e)); }
    cargar();
  }, [code, cargar]);

  return { gameId, estado, jugadores, vista, error, setError, noExiste, token, setToken, hacer, recargar: cargar };
}
