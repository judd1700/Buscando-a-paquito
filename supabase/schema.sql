-- Buscando a Paquito · base de datos y lógica del juego
-- Pegar entero en Supabase → SQL Editor → Run. Se puede volver a ejecutar sin problema.

create extension if not exists pgcrypto;

-- ───────────── Tablas ─────────────
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  seat int not null,
  name text not null,
  claimed boolean not null default false,
  unique (game_id, seat)
);

-- Lo que nadie puede leer directamente: roles, mazo, cartas en mano, votos secretos, tokens
create table if not exists secrets (
  game_id uuid primary key references games(id) on delete cascade,
  admin_token uuid not null default gen_random_uuid(),
  roles text[] not null default '{}',
  deck text[] not null default '{}',
  hand text[] not null default '{}',
  votes jsonb not null default '{}',
  investigations jsonb not null default '{}'
);

-- Codigo de acceso a la web (mientras sea privada). Se guarda aparte, no en el codigo.
create table if not exists config (key text primary key, value text not null);

create table if not exists player_tokens (
  player_id uuid primary key references players(id) on delete cascade,
  token uuid unique not null default gen_random_uuid()
);

alter table games enable row level security;
alter table players enable row level security;
alter table secrets enable row level security;
alter table player_tokens enable row level security;
alter table config enable row level security;

drop policy if exists games_read on games;
create policy games_read on games for select using (true);
drop policy if exists players_read on players;
create policy players_read on players for select using (true);
-- secrets y player_tokens: sin políticas → nadie puede leerlas desde la web

-- Tiempo real para que todos los móviles vean los cambios
do $$ begin
  begin alter publication supabase_realtime add table games; exception when others then null; end;
  begin alter publication supabase_realtime add table players; exception when others then null; end;
end $$;

-- ───────────── Utilidades ─────────────
create or replace function _new_deck() returns text[] language sql volatile as $$
  select array_agg(c order by random()) from (
    select 'roja' as c from generate_series(1,10)
    union all select 'facha' from generate_series(1,6)
  ) t;
$$;

create or replace function _draw(g uuid, k int) returns text[] language plpgsql as $$
declare d text[]; out text[];
begin
  select deck into d from secrets where game_id = g for update;
  if coalesce(array_length(d,1),0) < 3 then d := _new_deck(); end if;
  out := d[1:k];
  update secrets set deck = d[k+1:array_length(d,1)] where game_id = g;
  return out;
end $$;

create or replace function _alive_count(st jsonb) returns int language sql immutable as $$
  select count(*)::int from jsonb_array_elements(st->'alive') a where a = 'true'::jsonb;
$$;

create or replace function _all_in(st jsonb, key text) returns boolean language sql immutable as $$
  select not exists (
    select 1 from jsonb_array_elements(st->'alive') with ordinality a(v, i)
    where a.v = 'true'::jsonb and not ((st->key) @> to_jsonb((a.i - 1)::int))
  );
$$;

create or replace function _next_ministro(st jsonb) returns int language plpgsql immutable as $$
declare n int := (st->>'n')::int; m int := (st->>'ministro')::int; i int;
begin
  for i in 1..n loop
    if (st->'alive'->((m + i) % n))::boolean then return (m + i) % n; end if;
  end loop;
  return m;
end $$;

create or replace function _new_round(st jsonb) returns jsonb language sql immutable as $$
  select st || jsonb_build_object('phase','nominar','ministro', _next_ministro(st),
    'nominee', null, 'funcionario', null, 'votes', null, 'voted', '[]'::jsonb,
    'continues', '[]'::jsonb, 'power', null, 'power_target', null);
$$;

create or replace function _eligible(st jsonb, s int) returns boolean language plpgsql immutable as $$
begin
  if s < 0 or s >= (st->>'n')::int then return false; end if;
  if not (st->'alive'->s)::boolean then return false; end if;
  if s = (st->>'ministro')::int then return false; end if;
  if (st->'blocked') @> to_jsonb(s) then return false; end if;
  if _alive_count(st) > 5 then
    if (st->'last_gov') @> to_jsonb(s) then return false; end if;
  else
    if (st->'last_gov'->>1)::int = s then return false; end if;
  end if;
  return true;
end $$;

-- Aprueba una ley; devuelve el estado nuevo (sin decidir el poder todavía)
create or replace function _enact(st jsonb, law text, crisis boolean) returns jsonb language plpgsql immutable as $$
declare r int := (st->>'rojas')::int; f int := (st->>'fachas')::int;
begin
  if law = 'roja' then r := r + 1; else f := f + 1; end if;
  st := st || jsonb_build_object('rojas', r, 'fachas', f, 'last_law', law, 'by_crisis', crisis,
    'phase', 'ley', 'continues', '[]'::jsonb, 'fallidas', 0);
  return st;
end $$;

create or replace function _finish(g uuid, st jsonb, winner text, reason text) returns jsonb language plpgsql as $$
declare r text[];
begin
  select roles into r from secrets where game_id = g;
  return st || jsonb_build_object('phase','fin','winner',winner,'reason',reason,'roles',to_jsonb(r));
end $$;

-- ───────────── Crear y entrar ─────────────
create or replace function check_access(p_access text) returns boolean
language sql security definer set search_path = public as $$
  select coalesce((select value from config where key = 'access_code') = trim(p_access), true);
$$;

drop function if exists create_game(text[]);
create or replace function create_game(p_names text[], p_access text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g uuid; c text; n int := coalesce(array_length(p_names,1),0); i int; tok uuid;
begin
  if not check_access(coalesce(p_access,'')) then raise exception 'Código de acceso incorrecto'; end if;
  if n < 5 or n > 15 then raise exception 'Hacen falta entre 5 y 15 votantes'; end if;
  loop
    c := substr(translate(upper(encode(gen_random_bytes(6),'base64')),'+/=0O1IL','XYZ23456'),1,4);
    exit when not exists (select 1 from games where code = c);
  end loop;
  insert into games(code, state) values (c, jsonb_build_object('phase','lobby','n',n)) returning id into g;
  insert into secrets(game_id) values (g) returning admin_token into tok;
  for i in 1..n loop
    insert into players(game_id, seat, name) values (g, i-1, trim(p_names[i]));
  end loop;
  return jsonb_build_object('game_id', g, 'code', c, 'admin_token', tok);
end $$;

create or replace function claim_seat(p_code text, p_seat int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g uuid; p uuid; t uuid;
begin
  select id into g from games where code = upper(p_code);
  if g is null then raise exception 'No existe ninguna partida con ese código'; end if;
  select id into p from players where game_id = g and seat = p_seat and not claimed for update;
  if p is null then raise exception 'Ese nombre ya está cogido'; end if;
  update players set claimed = true where id = p;
  insert into player_tokens(player_id) values (p) returning token into t;
  update games set updated_at = now() where id = g;
  return jsonb_build_object('game_id', g, 'seat', p_seat, 'token', t);
end $$;

-- El organizador reparte los sobres
create or replace function deal(p_code text, p_admin_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid; n int; nf int; nr int; rl text[]; m int;
begin
  select ga.id, (ga.state->>'n')::int into g, n from games ga join secrets s on s.game_id = ga.id
   where ga.code = upper(p_code) and s.admin_token = p_admin_token and ga.state->>'phase' = 'lobby';
  if g is null then raise exception 'No puedes repartir esta partida'; end if;
  if exists (select 1 from players where game_id = g and not claimed) then raise exception 'Faltan votantes por entrar'; end if;
  select f, r into nf, nr from (values (5,3,1),(6,4,1),(7,4,2),(8,5,2),(9,5,3),(10,6,3),(11,7,3),(12,7,4),(13,8,4),(14,8,5),(15,9,5)) v(k,f,r) where k = n;
  select array_agg(x order by random()) into rl from (
    select 'facha' x from generate_series(1,nf) union all select 'rojo' from generate_series(1,nr) union all select 'paquito'
  ) t;
  m := floor(random()*n)::int;
  update secrets set roles = rl, deck = _new_deck() where game_id = g;
  update games set updated_at = now(), state = jsonb_build_object(
    'phase','sobres','n',n,'alive',(select jsonb_agg(true) from generate_series(1,n)),
    'ministro', (m + n - 1) % n, 'rojas',0,'fachas',0,'fallidas',0,
    'last_gov','[]'::jsonb,'blocked','[]'::jsonb,'skip_vote',false,
    'ready','[]'::jsonb,'continues','[]'::jsonb,'voted','[]'::jsonb)
  where id = g;
end $$;

-- ───────────── Lo que ve cada uno en secreto ─────────────
create or replace function my_view(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pl players; sc secrets; st jsonb; me text; team jsonb := '[]'; hand jsonb := null; inv jsonb := null; i int;
begin
  select p.* into pl from players p join player_tokens t on t.player_id = p.id where t.token = p_token;
  if pl.id is null then raise exception 'No te reconozco en esta partida'; end if;
  select * into sc from secrets where game_id = pl.game_id;
  select state into st from games where id = pl.game_id;
  if array_length(sc.roles,1) is null then return jsonb_build_object('seat', pl.seat); end if;
  me := sc.roles[pl.seat + 1];
  if me in ('rojo','paquito') then
    for i in 1..array_length(sc.roles,1) loop
      if i - 1 <> pl.seat and sc.roles[i] in ('rojo','paquito') then
        team := team || jsonb_build_object('seat', i-1, 'role', sc.roles[i]);
      end if;
    end loop;
  end if;
  if (st->>'phase' = 'leg_ministro' and (st->>'ministro')::int = pl.seat)
     or (st->>'phase' = 'leg_funcionario' and (st->>'funcionario')::int = pl.seat) then
    hand := to_jsonb(sc.hand);
  end if;
  inv := sc.investigations->(pl.seat::text);
  return jsonb_build_object('seat', pl.seat, 'role', me, 'team', team, 'hand', hand, 'investigation', inv,
    'my_vote', sc.votes->(pl.seat::text));
end $$;

-- ───────────── Todas las acciones del juego ─────────────
-- p_action: abrir_sobre | continuar | proponer | votar | descartar | aprobar | revisar | eliminar
create or replace function act(p_token uuid, p_action text, p_arg int default null) returns void
language plpgsql security definer set search_path = public as $$
declare pl players; g uuid; st jsonb; ph text; s int; sc secrets; n int; yes int; elected boolean;
  law text; h text[]; pw text; role text;
begin
  select p.* into pl from players p join player_tokens t on t.player_id = p.id where t.token = p_token;
  if pl.id is null then raise exception 'No te reconozco en esta partida'; end if;
  g := pl.game_id; s := pl.seat;
  select state into st from games where id = g for update;
  select * into sc from secrets where game_id = g for update;
  ph := st->>'phase'; n := (st->>'n')::int;

  if ph not in ('lobby','sobres','abiertos','fin') and not (st->'alive'->s)::boolean
     and p_action <> 'continuar' then raise exception 'Estás fuera de la partida'; end if;

  -- Sobres
  if p_action = 'abrir_sobre' and ph = 'sobres' then
    if not (st->'ready') @> to_jsonb(s) then st := jsonb_set(st, '{ready}', (st->'ready') || to_jsonb(s)); end if;
    if _all_in(st, 'ready') then st := st || jsonb_build_object('phase','abiertos','continues','[]'::jsonb); end if;

  elsif p_action = 'continuar' then
    if not (st->'continues') @> to_jsonb(s) then st := jsonb_set(st, '{continues}', (st->'continues') || to_jsonb(s)); end if;
    if ph = 'carnet' and s = (st->>'ministro')::int then
      st := _new_round(st);
    elsif _all_in(st, 'continues') then
      if ph = 'abiertos' then
        st := _new_round(st);
      elsif ph = 'resultado' then
        if (st->>'elected')::boolean then
          st := st || jsonb_build_object('funcionario', st->'nominee', 'last_gov', jsonb_build_array(st->'ministro', st->'nominee'), 'blocked','[]'::jsonb);
          if (st->>'rojas')::int >= 3 and sc.roles[(st->>'nominee')::int + 1] = 'paquito' then
            st := _finish(g, st, 'rojos', 'Paquito ha sido elegido Funcionario');
          else
            h := _draw(g, 3); update secrets set hand = h where game_id = g;
            st := st || jsonb_build_object('phase','leg_ministro');
          end if;
        else
          st := jsonb_set(st, '{fallidas}', to_jsonb((st->>'fallidas')::int + 1));
          if (st->>'fallidas')::int >= 3 then
            law := (_draw(g, 1))[1];
            st := st || jsonb_build_object('blocked', jsonb_build_array(st->'ministro', st->'nominee'), 'last_gov', '[]'::jsonb);
            st := _enact(st, law, true);
          else
            st := _new_round(st);
          end if;
        end if;
      elsif ph = 'ley' then
        if (st->>'rojas')::int >= 6 then st := _finish(g, st, 'rojos', 'Se han aprobado 6 leyes rojas');
        elsif (st->>'fachas')::int >= 5 then st := _finish(g, st, 'fachas', 'Se han aprobado 5 leyes fachas');
        elsif st->>'last_law' = 'roja' and not (st->>'by_crisis')::boolean then
          pw := case (st->>'rojas')::int when 2 then 'carnet' when 3 then 'nombrar' when 4 then 'eliminar' when 5 then 'eliminar' else null end;
          if pw = 'nombrar' then st := _new_round(st) || jsonb_build_object('skip_vote', true);
          elsif pw is not null then st := st || jsonb_build_object('phase','poder','power',pw,'continues','[]'::jsonb);
          else st := _new_round(st); end if;
        else
          st := _new_round(st);
        end if;
      elsif ph = 'eliminado' then
        st := _new_round(st);
      end if;
    end if;

  -- Proponer Funcionario
  elsif p_action = 'proponer' and ph = 'nominar' and s = (st->>'ministro')::int then
    if not _eligible(st, p_arg) then raise exception 'No puedes proponer a ese votante'; end if;
    st := st || jsonb_build_object('nominee', p_arg, 'blocked', '[]'::jsonb);
    if (st->>'skip_vote')::boolean then
      st := st || jsonb_build_object('skip_vote', false, 'funcionario', p_arg, 'appointed', true,
        'last_gov', jsonb_build_array(st->'ministro', p_arg), 'blocked','[]'::jsonb);
      if (st->>'rojas')::int >= 3 and sc.roles[p_arg + 1] = 'paquito' then
        st := _finish(g, st, 'rojos', 'Paquito ha sido nombrado Funcionario');
      else
        h := _draw(g, 3); update secrets set hand = h where game_id = g;
        st := st || jsonb_build_object('phase','leg_ministro');
      end if;
    else
      update secrets set votes = '{}' where game_id = g;
      st := st || jsonb_build_object('phase','votar','voted','[]'::jsonb,'appointed',false);
    end if;

  -- Votar
  elsif p_action = 'votar' and ph = 'votar' then
    if (st->'voted') @> to_jsonb(s) then raise exception 'Ya has votado'; end if;
    update secrets set votes = votes || jsonb_build_object(s::text, p_arg = 1) where game_id = g returning * into sc;
    st := jsonb_set(st, '{voted}', (st->'voted') || to_jsonb(s));
    if _all_in(st, 'voted') then
      select count(*) into yes from jsonb_each(sc.votes) v where v.value = 'true'::jsonb;
      elected := yes * 2 > _alive_count(st);
      st := st || jsonb_build_object('phase','resultado','votes', sc.votes, 'elected', elected, 'continues','[]'::jsonb);
    end if;

  -- Sesión legislativa
  elsif p_action = 'descartar' and ph = 'leg_ministro' and s = (st->>'ministro')::int then
    if p_arg not between 0 and 2 then raise exception 'Carta no válida'; end if;
    h := sc.hand;
    update secrets set hand = h[1:p_arg] || h[p_arg+2:3] where game_id = g;
    st := st || jsonb_build_object('phase','leg_funcionario');
  elsif p_action = 'aprobar' and ph = 'leg_funcionario' and s = (st->>'funcionario')::int then
    if p_arg not between 0 and 1 then raise exception 'Carta no válida'; end if;
    law := sc.hand[p_arg + 1];
    update secrets set hand = '{}' where game_id = g;
    st := _enact(st, law, false);

  -- Poderes
  elsif p_action = 'revisar' and ph = 'poder' and st->>'power' = 'carnet' and s = (st->>'ministro')::int then
    if p_arg = s or not (st->'alive'->p_arg)::boolean then raise exception 'Elige a otro votante'; end if;
    role := case when sc.roles[p_arg + 1] = 'facha' then 'facha' else 'rojo' end;
    update secrets set investigations = investigations || jsonb_build_object(s::text, jsonb_build_object('seat', p_arg, 'party', role)) where game_id = g;
    st := st || jsonb_build_object('phase','carnet','power_target', p_arg);
  elsif p_action = 'eliminar' and ph = 'poder' and st->>'power' = 'eliminar' and s = (st->>'ministro')::int then
    if p_arg = s or not (st->'alive'->p_arg)::boolean then raise exception 'Elige a otro votante'; end if;
    st := jsonb_set(st, array['alive', p_arg::text], 'false'::jsonb);
    if sc.roles[p_arg + 1] = 'paquito' then
      st := _finish(g, st || jsonb_build_object('power_target', p_arg), 'fachas', 'Paquito ha sido eliminado');
    else
      st := st || jsonb_build_object('phase','eliminado','power_target', p_arg, 'continues','[]'::jsonb);
    end if;
  else
    raise exception 'Ahora no puedes hacer eso';
  end if;

  update games set state = st, updated_at = now() where id = g;
end $$;

grant execute on function check_access(text), create_game(text[],text), claim_seat(text,int), deal(text,uuid), my_view(uuid), act(uuid,text,int) to anon, authenticated;
revoke execute on function _draw(uuid,int), _finish(uuid,jsonb,text,text) from anon, authenticated;

-- «No soy yo»: libera el nombre para elegir otro (solo antes de repartir)
create or replace function release_seat(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p uuid; g uuid;
begin
  select pl.id, pl.game_id into p, g from players pl join player_tokens t on t.player_id = pl.id where t.token = p_token;
  if p is null then return; end if;
  if (select state->>'phase' from games where id = g) <> 'lobby' then raise exception 'La partida ya ha empezado'; end if;
  delete from player_tokens where player_id = p;
  update players set claimed = false where id = p;
  update games set updated_at = now() where id = g;
end $$;
grant execute on function release_seat(uuid) to anon, authenticated;
