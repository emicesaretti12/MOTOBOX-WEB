-- MOTOBOX — Números de la rifa
-- Ejecutar una vez en Supabase (SQL Editor). La web lee esta tabla para mostrar
-- qué números están reservados o vendidos y se actualiza en vivo.
-- Cargá acá cada número apenas se reserva o se paga. Los datos del comprador
-- (nombre, teléfono) quedan en tu CRM o WhatsApp: esta tabla es pública.

create table if not exists public.rifa_numeros (
  rifa        text        not null default '01',
  numero      integer     not null check (numero >= 0),
  estado      text        not null default 'reservado' check (estado in ('reservado', 'vendido')),
  actualizado timestamptz not null default now(),
  primary key (rifa, numero)
);

alter table public.rifa_numeros enable row level security;

-- La web (clave pública) solo puede leer. Los números se cargan y editan
-- desde el panel de Supabase (Table Editor).
drop policy if exists "Lectura publica de numeros de la rifa" on public.rifa_numeros;
create policy "Lectura publica de numeros de la rifa"
  on public.rifa_numeros for select
  to anon, authenticated
  using (true);

-- Actualizaciones en vivo en la web.
do $$
begin
  alter publication supabase_realtime add table public.rifa_numeros;
exception
  when duplicate_object then null;
end $$;
