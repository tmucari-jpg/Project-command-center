-- Execute only in the isolated validation database until release authorization.
-- Each queue item, business write and receipt forms one transaction.
create or replace function public.apply_offline_item_atomic(p_id uuid,p_type text,p_payload jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare
 uid uuid := auth.uid(); target_table text; entity text; allowed text[]; cols text;
 data jsonb; receipt public.sync_queue%rowtype; pid uuid; did uuid; aid uuid;
 linked_pid uuid; linked_did uuid; target_id uuid; op text := 'create';
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if p_id is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Invalid offline payload'; end if;
 case p_type
 when 'create_action' then target_table:='actions';entity:='action';allowed:=array['project_id','deliverable_id','title','description','priority','due_at','estimated_minutes','completion_criteria'];
 when 'create_idea' then target_table:='ideas';entity:='idea';allowed:=array['project_id','title','description','source','potential','priority','next_decision'];
 when 'create_evidence' then target_table:='evidence';entity:='evidence';allowed:=array['project_id','deliverable_id','action_id','evidence_type','title','description','url'];
 when 'create_blocker' then target_table:='blockers';entity:='blocker';allowed:=array['project_id','deliverable_id','action_id','title','description','impact','responsible','resolution_due_at'];
 when 'create_factory_intake' then target_table:='project_factory_cases';entity:='factory_case';allowed:=array['title','description','problem','project_type','target_user','expected_value','constraints','source'];
 when 'update_action_status' then target_table:='actions';entity:='action';op:='update';
 when 'update_project_next_action' then target_table:='projects';entity:='project';op:='update';
 else raise exception 'Unsupported offline operation';
 end case;
 -- Unique insert + row lock serializes retries and competing requests.
 insert into public.sync_queue(id,user_id,entity_type,operation,payload,status,attempts)
 values(p_id,uid,entity,op,p_payload,'syncing',1) on conflict(id) do nothing;
 select * into receipt from public.sync_queue where id=p_id and user_id=uid for update;
 if not found then raise exception 'Receipt inaccessible'; end if;
 if receipt.payload<>p_payload or receipt.entity_type<>entity or receipt.operation<>op then raise exception 'Offline operation content conflict'; end if;
 if receipt.status='synced' then return; end if;
 pid:=nullif(p_payload->>'project_id','')::uuid;
 did:=nullif(p_payload->>'deliverable_id','')::uuid;
 aid:=nullif(p_payload->>'action_id','')::uuid;
 if aid is not null then
   select a.project_id,a.deliverable_id into linked_pid,linked_did from public.actions a where a.id=aid and a.user_id=uid;
   if not found then raise exception 'Action inaccessible'; end if;
   if pid is not null and linked_pid is not null and pid<>linked_pid or did is not null and linked_did is not null and did<>linked_did then raise exception 'Action relation mismatch'; end if;
   pid:=coalesce(linked_pid,pid); did:=coalesce(linked_did,did);
 end if;
 if did is not null then
   select d.project_id into linked_pid from public.deliverables d where d.id=did and d.user_id=uid;
   if not found then raise exception 'Deliverable inaccessible'; end if;
   if pid is not null and linked_pid is not null and pid<>linked_pid then raise exception 'Deliverable relation mismatch'; end if;
   pid:=coalesce(linked_pid,pid);
 end if;
 if pid is not null and not exists(select 1 from public.projects p where p.id=pid and p.user_id=uid) then raise exception 'Project inaccessible'; end if;
 if op='update' then
   if p_type='update_action_status' then
     if p_payload->>'status' is null or p_payload->>'status' not in ('pending','in_progress','blocked','completed','cancelled') then raise exception 'Invalid action status'; end if;
     update public.actions set status=p_payload->>'status' where id=aid and user_id=uid returning id,project_id into target_id,pid;
   else
     if nullif(btrim(p_payload->>'next_action'),'') is null or length(p_payload->>'next_action')>2000 then raise exception 'Invalid next action'; end if;
     update public.projects set next_action=btrim(p_payload->>'next_action') where id=pid and user_id=uid returning id into target_id;
   end if;
   if target_id is null then raise exception 'Update target inaccessible'; end if;
 else
   select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into data from jsonb_each(p_payload) where key=any(allowed);
   data:=data||jsonb_build_object('id',p_id,'user_id',uid);
   if p_type<>'create_factory_intake' then data:=data||jsonb_build_object('project_id',pid); end if;
   if p_type in ('create_action','create_evidence','create_blocker') then data:=data||jsonb_build_object('deliverable_id',did); end if;
   if p_type='create_action' then data:=data||'{"status":"pending","is_next_action":false}'::jsonb; end if;
   if p_type='create_idea' then data:=data||'{"status":"captured"}'::jsonb; end if;
   if p_type='create_blocker' then data:=data||'{"status":"open"}'::jsonb; end if;
   if p_type='create_evidence' and pid is null and did is null and aid is null then raise exception 'Evidence relation required'; end if;
   if p_type='create_factory_intake' then
     data:=data||jsonb_build_object('stage','viability','competitive_intelligence_required',p_payload->>'project_type'='commercial','governance_gate','g2_viability','governance_gate_status','in_progress','g1_completed_at',now());
   end if;
   -- Table comes only from the CASE above; every column is server whitelisted.
   select string_agg(format('%I',key),',' order by key) into cols from jsonb_object_keys(data) as key;
   execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1)',target_table,cols,cols,target_table) using data;
   target_id:=p_id;
   if p_type='create_factory_intake' then
     insert into public.project_gate_events(user_id,factory_case_id,gate,event_type,rationale,created_by) values
     (uid,p_id,'g1_triage','approved','Intake offline declarado pelo utilizador; não constitui aprovação de viabilidade.',uid),
     (uid,p_id,'g2_viability','entered',null,uid);
   end if;
 end if;
 update public.sync_queue set status='synced',project_id=pid,entity_id=target_id,synced_at=now() where id=p_id and user_id=uid;
end; $$;
revoke all on function public.apply_offline_item_atomic(uuid,text,jsonb) from public,anon;
grant execute on function public.apply_offline_item_atomic(uuid,text,jsonb) to authenticated;
