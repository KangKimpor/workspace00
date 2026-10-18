begin;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);

-- New metadata travels through the existing RPC and its field-clock merge.
do $$declare
  owner_id text := '11111111-1111-4111-8111-111111111111';
  clock_one jsonb := '{"wall":100,"counter":0,"node":"desktop"}';
  clock_two jsonb := '{"wall":200,"counter":0,"node":"phone"}';
  record jsonb;
  saved jsonb;
begin
  record := jsonb_build_object('id','phase-one-database','userId',owner_id,'kind','entity','table','databases','entityId','reading','schemaVersion',1);
  perform public.push_changes(jsonb_build_array(record || jsonb_build_object('fields',jsonb_build_object(
    'properties',jsonb_build_object('value','[{"id":"title","name":"Name","type":"title"},{"id":"status","name":"Status","type":"status","options":["To read","Finished"]}]'::jsonb,'clock',clock_one),
    'views',jsonb_build_object('value','[{"id":"table","name":"All items","type":"table"}]'::jsonb,'clock',clock_one),
    'defaultProperties',jsonb_build_object('value','{"status":"To read"}'::jsonb,'clock',clock_one)
  ))));
  perform public.push_changes(jsonb_build_array(record || jsonb_build_object('id','phase-one-view-filter','fields',jsonb_build_object(
    'views.table.filter',jsonb_build_object('value','{"operator":"and","children":[{"property":"status","operator":"equals","value":"Finished"}]}'::jsonb,'clock',clock_two)
  ))));
  perform public.push_changes(jsonb_build_array(record || jsonb_build_object('id','phase-one-view-visible','fields',jsonb_build_object(
    'views.table.visibleProperties',jsonb_build_object('value','["title"]'::jsonb,'clock',clock_one)
  ))));
  select fields into saved from public.databases where id='reading';
  if saved->'views.table.filter'->'value'->'children'->0->>'value' is distinct from 'Finished' or
     saved->'views.table.visibleProperties'->'value' is distinct from '["title"]'::jsonb or
     saved->'defaultProperties'->'value'->>'status' is distinct from 'To read' then
    raise exception 'Database configuration lost an independent device edit';
  end if;
  perform public.push_changes(jsonb_build_array(jsonb_build_object(
    'id','phase-one-page','userId',owner_id,'kind','entity','table','pages','entityId','book','schemaVersion',1,
    'fields',jsonb_build_object(
      'title',jsonb_build_object('value','A saved book','clock',clock_one),
      'databaseId',jsonb_build_object('value','reading','clock',clock_one),
      'properties.__archived',jsonb_build_object('value','2026-10-18T00:00:00.000Z','clock',clock_one)
    )
  )));
  if not exists(select 1 from public.pages where id='book' and fields->'properties.__archived'->>'value'='2026-10-18T00:00:00.000Z') then
    raise exception 'Archive metadata did not persist';
  end if;
end $$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$declare denied boolean := false; begin
  if exists(select 1 from public.pages where id='book') or exists(select 1 from public.databases where id='reading') then
    raise exception 'Private page or database readable by another account';
  end if;
  if jsonb_array_length(public.pull_changes('0',200)->'changes') <> 0 then raise exception 'Another account can pull private workspace edits'; end if;
  begin
    perform public.push_changes('[{"id":"phase-one-spoof","userId":"11111111-1111-4111-8111-111111111111","kind":"entity","table":"databases","entityId":"reading","schemaVersion":1,"fields":{}}]');
  exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Another account can change a private database'; end if;
  denied := false;
  begin
    perform public.push_changes('[{"id":"phase-one-foreign-doc","userId":"22222222-2222-4222-8222-222222222222","kind":"document","entityId":"book","schemaVersion":1,"update":"AAA="}]');
  exception when raise_exception then denied := true; end;
  if not denied then raise exception 'Another account can write a private page document'; end if;
end $$;
rollback;
select 'Page/database persistence, concurrent configuration and private-access checks passed' as result;
