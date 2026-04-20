-- Добавляет структурированные поля для регистрации в НИУ ВШЭ:
--   campus           — кампус ВШЭ (moscow / spb / nnov / perm)
--   education_level  — ступень обучения (bachelor / master / specialist / phd)
--   program          — название образовательной программы (свободный текст)
--
-- Все поля nullable + backward-compatible: существующие профили не ломаются.

alter table profiles add column if not exists campus text;
alter table profiles add column if not exists education_level text;
alter table profiles add column if not exists program text;

-- Constraint: education_level из фиксированного набора
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_education_level_check'
  ) then
    alter table profiles add constraint profiles_education_level_check
      check (education_level is null or education_level in ('bachelor', 'master', 'specialist', 'phd'));
  end if;
end $$;

-- Constraint: campus из 4 кампусов ВШЭ
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'profiles_campus_check'
  ) then
    alter table profiles add constraint profiles_campus_check
      check (campus is null or campus in ('moscow', 'spb', 'nnov', 'perm'));
  end if;
end $$;

-- Comment-аннотации для документирования
comment on column profiles.campus is 'HSE campus: moscow|spb|nnov|perm';
comment on column profiles.education_level is 'Education stage: bachelor|master|specialist|phd';
comment on column profiles.program is 'Educational program name (free text, e.g. "Прикладная математика и информатика")';
