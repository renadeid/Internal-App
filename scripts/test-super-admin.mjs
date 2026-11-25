// Isolated PostgreSQL checks. Usage: node scripts/test-super-admin.mjs <runtime directory>
// Install @electric-sql/pglite in that directory. No remote database or env file is used.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
const { PGlite } = createRequire(resolve(process.argv[2], 'package.json'))('@electric-sql/pglite')
const db = new PGlite()
let checks = 0
const check = (a,b,label) => { assert.deepEqual(a,b,label); checks++ }
const scalar = async (sql,args=[]) => Object.values((await db.query(sql,args)).rows[0])[0]
async function denied(sql,args=[],code='42501') { await assert.rejects(db.query(sql,args), e => e.code === code); checks++ }
const ids = Object.fromEntries(['org','otherOrg','admin','member','second','viewer','outsider','department','otherDepartment'].map((k,i) => [k, `00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]))
async function actor(id) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id ?? '']); await db.exec('set role authenticated') }
try {
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
 for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) await db.exec(readFileSync(resolve('supabase/migrations',file),'utf8'))
 for (const name of ['admin','member','second','viewer','outsider']) await db.query('insert into auth.users(id,email) values($1,$2)',[ids[name],name+'@test.invalid'])
 await db.query("insert into public.organizations(id,name,slug) values($1,'Test','test'),($2,'Other','other')",[ids.org,ids.otherOrg])
 for (const name of ['admin','member','second','viewer']) await db.query('insert into public.organization_memberships(organization_id,profile_id,role) values($1,$2,$3)',[ids.org,ids[name],name === 'admin' ? 'org_admin' : name === 'viewer' ? 'viewer' : 'member'])
 await db.query("insert into public.organization_memberships(organization_id,profile_id,role) values($1,$2,'org_admin')",[ids.otherOrg,ids.outsider])
 await db.query("insert into public.departments(id,organization_id,name,slug) values($1,$2,'Team','team'),($3,$4,'Other','other')",[ids.department,ids.org,ids.otherDepartment,ids.otherOrg])
 await db.query("insert into public.department_memberships(organization_id,department_id,profile_id,role) values($1,$2,$3,'member')",[ids.org,ids.department,ids.member])
 let sequence=0
 const payload = (mode,extra={}) => ({ organizationId:ids.org,name:'Project',slug:'project-'+(++sequence),description:'',leadDepartmentId:ids.department,ownerId:ids.admin,accessMode:mode,memberIds:[ids.member],...extra })
 const create = (mode,extra={}) => scalar('select public.admin_create_project($1::jsonb)',[JSON.stringify(payload(mode,extra))])
 const hasMember = (project,profile) => scalar('select count(*)::int from public.project_members where project_id=$1 and profile_id=$2',[project,profile])
 await actor(ids.member); await denied('select public.admin_create_project($1::jsonb)',[JSON.stringify(payload('organization'))])
 await actor(ids.outsider); await denied('select public.admin_create_project($1::jsonb)',[JSON.stringify(payload('organization'))])
 await actor(ids.admin)
 const selected=await create('members'); check(await hasMember(selected,ids.member),1,'selected member granted'); check(await hasMember(selected,ids.second),0,'unselected excluded')
 const department=await create('department'); check(await hasMember(department,ids.member),1,'department member granted'); check(await hasMember(department,ids.second),0,'other departments excluded')
 const everyone=await create('organization'); check(await hasMember(everyone,ids.second),1,'current employees granted'); check(await hasMember(everyone,ids.outsider),0,'other organization excluded')
 const custom=await create('custom',{permissions:{edit:true,manageMembers:true,approve:true,manageAssets:true}})
 check(await scalar('select can_edit and can_manage_members and can_approve_deliverables and can_manage_assets from public.project_members where project_id=$1 and profile_id=$2',[custom,ids.member]),true,'custom flags saved')
 const viewer=await create('custom',{memberIds:[ids.viewer],permissions:{edit:true,manageMembers:true,approve:true,manageAssets:true}})
 check(await scalar("select role='viewer' and not can_edit and not can_manage_members and not can_approve_deliverables and not can_manage_assets from public.project_members where project_id=$1 and profile_id=$2",[viewer,ids.viewer]),true,'viewer remains read only')
 const before=await scalar('select count(*)::int from public.projects')
 await denied('select public.admin_create_project($1::jsonb)',[JSON.stringify(payload('members',{memberIds:[ids.outsider]}))],'23503')
 await denied('select public.admin_create_project($1::jsonb)',[JSON.stringify(payload('members',{leadDepartmentId:ids.otherDepartment}))],'23503')
 await denied('select public.admin_create_project($1::jsonb)',[JSON.stringify(payload('members',{memberIds:[]}))],'22023')
 check(await scalar('select count(*)::int from public.projects'),before,'failed creation is atomic')
 const invited=await create('invitation'); check(await hasMember(invited,ids.member),0,'pending invitation has no membership')
 const invitation=await scalar('select id from public.project_invitations where project_id=$1',[invited])
 await actor(ids.second); check(await scalar('select count(*)::int from public.my_project_invitations($1)',[ids.org]),0,'other employees cannot see invitation details'); check(await scalar('select count(*)::int from public.projects where id=$1',[invited]),0,'uninvited cannot read'); await denied('select public.accept_project_invitation($1)',[invitation])
 await actor(ids.member); check(await scalar('select project_name from public.my_project_invitations($1)',[ids.org]),'Project','recipient sees project invitation name'); check(await scalar('select count(*)::int from public.projects where id=$1',[invited]),0,'invitee cannot read before acceptance')
 check(await scalar('select public.accept_project_invitation($1)',[invitation]),invited,'invitee accepts')
 check(await hasMember(invited,ids.member),1,'accepted invitation grants membership')
 check(await scalar('select count(*)::int from public.project_invitations where id=$1',[invitation]),0,'invitation consumed')
 await denied('select public.accept_project_invitation($1)',[invitation])
 await actor(ids.admin); await db.query("insert into public.tasks(organization_id,project_id,title,assignee_id) values($1,$2,'Assigned task',$3)",[ids.org,selected,ids.member]); checks++
 await db.query('select public.admin_invite_project_member($1,$2,$3)',[ids.org,selected,ids.second]); checks++
 await denied('select public.admin_invite_project_member($1,$2,$3)',[ids.org,selected,ids.outsider],'22023')
 await denied("update public.organization_memberships set role='member' where organization_id=$1 and profile_id=$2",[ids.org,ids.admin],'P0001')
 await actor(ids.member); await denied('select public.admin_add_member($1,$2)',[ids.org,'outsider@test.invalid'])
 await actor(ids.admin); await db.query('select public.admin_add_member($1,$2)',[ids.org,'outsider@test.invalid']); check(await scalar('select role from public.organization_memberships where organization_id=$1 and profile_id=$2',[ids.org,ids.outsider]),'member','existing account added without elevated role')
 await actor(ids.admin)
 const limited=await create('members',{historyAccess:'assigned_only'})
 const ownTask=await scalar("insert into public.tasks(organization_id,project_id,title,assignee_id,created_at) values($1,$2,'Old assigned work',$3,'2020-01-01') returning id",[ids.org,limited,ids.member])
 await db.query("insert into public.tasks(organization_id,project_id,title,assignee_id) values($1,$2,'Private history',$3)",[ids.org,limited,ids.admin])
 const campaign=await scalar("insert into public.campaigns(organization_id,project_id,slug,name,owner_id,type,starts_on,ends_on) values($1,$2,'history','Private campaign',$3,'other','2026-01-01','2026-02-01') returning id",[ids.org,limited,ids.admin])
 await db.query("insert into public.deliverables(organization_id,project_id,campaign_id,title,type,creator_id) values($1,$2,$3,'Private deliverable','document',$4)",[ids.org,limited,campaign,ids.admin])
 await db.exec("reset role")
 const eventId=await scalar("select gen_random_uuid()")
 await db.query("select private.open_operation('activity',$1)",[eventId])
 await db.query("insert into public.activity_events(id,organization_id,project_id,actor_id,verb,summary) values($1,$2,$3,$4,'created','Private historical event')",[eventId,ids.org,limited,ids.admin])
 await db.query("select private.close_operation('activity',$1)",[eventId])
 await actor(ids.admin)
 const asset=await scalar("select gen_random_uuid()")
 await db.query("insert into public.assets(id,organization_id,slug,name,type,owner_id,visibility) values($1,$2,'private-project','Private file','document',$3,'project_members')",[asset,ids.org,ids.admin])
 await db.query('insert into public.asset_project_links(organization_id,project_id,asset_id) values($1,$2,$3)',[ids.org,limited,asset])
 await actor(ids.member)
 check(await scalar('select count(*)::int from public.projects where id=$1',[limited]),1,'restricted member opens project header')
 check(await scalar('select count(*)::int from public.tasks where project_id=$1',[limited]),1,'only assigned task visible, including old assigned work')
 check(await scalar('select title from public.tasks where id=$1',[ownTask]),'Old assigned work','assignment rather than joining date controls access')
 check(await scalar('select count(*)::int from public.campaigns where project_id=$1',[limited]),0,'campaign history hidden')
 check(await scalar('select count(*)::int from public.deliverables where project_id=$1',[limited]),0,'deliverable history hidden')
 check(await scalar('select count(*)::int from public.activity_events where project_id=$1',[limited]),0,'activity history hidden')
 check(await scalar('select count(*)::int from public.assets where id=$1',[asset]),0,'private project files hidden')
 check(await scalar('select count(*)::int from public.project_members where project_id=$1',[limited]),1,'only own membership visible')
 check(await scalar('select private.project_flag($1,$2)',[limited,'edit']),false,'no project-wide edit access')
 check(await scalar('select private.can_write_project($1)',[limited]),false,'restricted member cannot write project work')
 await denied("insert into public.tasks(organization_id,project_id,title,assignee_id) values($1,$2,'Unauthorized task',$3)",[ids.org,limited,ids.member])
 check(await scalar("with changed as (update public.tasks set title='Unauthorized' where id=$1 returning id) select count(*)::int from changed",[ownTask]),0,'assigned-only access does not allow task edits')
 check(await scalar("with changed as (update public.project_members set history_access='full_history' where project_id=$1 and profile_id=$2 returning id) select count(*)::int from changed",[limited,ids.member]),0,'cannot upgrade own history mode')
 await actor(ids.second)
 check(await scalar('select count(*)::int from public.tasks where project_id=$1',[limited]),0,'new employee has no implicit access')
 await actor(ids.admin)
 await db.query('select public.admin_invite_project_member($1,$2,$3,$4)',[ids.org,limited,ids.second,'assigned_only'])
 const limitedInvite=await scalar('select id from public.project_invitations where project_id=$1 and profile_id=$2',[limited,ids.second])
 await actor(ids.second)
 check(await scalar('select history_access from public.my_project_invitations($1) where id=$2',[ids.org,limitedInvite]),'assigned_only','invitation displays assigned-only mode')
 check(await scalar('select count(*)::int from public.projects where id=$1',[limited]),0,'invitation alone grants no project access')
 await scalar('select public.accept_project_invitation($1)',[limitedInvite])
 check(await scalar('select history_access from public.project_members where project_id=$1 and profile_id=$2',[limited,ids.second]),'assigned_only','acceptance preserves chosen visibility')
 check(await scalar('select count(*)::int from public.tasks where project_id=$1',[limited]),0,'accepted member with no assignments sees no tasks')
 await actor(ids.admin)
 await db.query('update public.tasks set assignee_id=$1 where id=$2',[ids.second,ownTask])
 await actor(ids.member)
 check(await scalar('select count(*)::int from public.tasks where project_id=$1',[limited]),0,'reassignment immediately revokes prior visibility')
 await actor(ids.second)
 check(await scalar('select count(*)::int from public.tasks where project_id=$1',[limited]),1,'new assignee immediately sees task')
 await actor(ids.admin)
 await db.query("update public.project_members set history_access='full_history' where project_id=$1 and profile_id=$2",[limited,ids.member])
 await actor(ids.member)
 check(await scalar('select count(*)::int from public.tasks where project_id=$1',[limited]),2,'full-history member sees all tasks')
 check(await scalar('select count(*)::int from public.campaigns where project_id=$1',[limited]),1,'full-history member sees campaign history')
 check(await scalar('select count(*)::int from public.assets where id=$1',[asset]),1,'full-history member sees project assets')
 await actor(ids.admin)
 await db.query("update public.project_members set history_access='assigned_only',can_edit=true,can_manage_members=true,can_approve_deliverables=true,can_manage_assets=true where project_id=$1 and profile_id=$2",[limited,ids.member])
 check(await scalar('select not can_edit and not can_manage_members and not can_approve_deliverables and not can_manage_assets from public.project_members where project_id=$1 and profile_id=$2',[limited,ids.member]),true,'restricted mode clears broad flags')
 check(await scalar('select count(*)::int from public.tasks where project_id=$1',[limited]),2,'Super admin retains full visibility')
 await denied("update public.project_members set history_access='assigned_only' where project_id=$1 and profile_id=$2",[limited,ids.admin],'23514')
 await denied('select public.admin_create_project($1::jsonb)',[JSON.stringify(payload('members',{historyAccess:'invalid'}))],'22023')

 await actor(ids.admin)
 const adminWork=await create('members',{memberIds:[ids.member]})
 const adminTask=await scalar("insert into public.tasks(organization_id,project_id,title,assignee_id) values($1,$2,'Existing admin-edit task',$3) returning id",[ids.org,adminWork,ids.member])
 const adminCampaign=await scalar("insert into public.campaigns(organization_id,project_id,slug,name,owner_id,type,starts_on,ends_on) values($1,$2,'admin-edit-campaign','Existing campaign',$3,'other','2026-01-01','2026-02-01') returning id",[ids.org,adminWork,ids.admin])
 const adminDeliverable=await scalar("insert into public.deliverables(organization_id,project_id,campaign_id,title,type,creator_id) values($1,$2,$3,'Existing deliverable','document',$4) returning id",[ids.org,adminWork,adminCampaign,ids.admin])
 const adminAsset=await scalar('select gen_random_uuid()')
 await db.query("insert into public.assets(id,organization_id,slug,name,type,owner_id,visibility) values($1,$2,'admin-edit-asset','Existing asset','document',$3,'restricted')",[adminAsset,ids.org,ids.admin])
 await db.exec('reset role')
 await db.query("select set_config('request.jwt.claim.sub','',false)")
 const otherWork=await scalar("insert into public.projects(organization_id,slug,name,lead_department_id,owner_id) values($1,'foreign-work','Foreign work',$2,$3) returning id",[ids.otherOrg,ids.otherDepartment,ids.outsider])
 const otherTask=await scalar("insert into public.tasks(organization_id,project_id,title,assignee_id) values($1,$2,'Foreign task',$3) returning id",[ids.otherOrg,otherWork,ids.outsider])
 await actor(ids.admin)
 const allProjects=await scalar('select count(*)::int from public.projects where organization_id=$1',[ids.org])
 await db.query("update public.organization_memberships set role='admin' where organization_id=$1 and profile_id=$2",[ids.org,ids.second])
 // Give the Admin an old powerful membership as a deliberate bypass attempt.
 await db.query("insert into public.project_members(organization_id,project_id,profile_id,role,can_edit,can_manage_members,can_approve_deliverables,can_manage_assets) values($1,$2,$3,'project_manager',true,true,true,true)",[ids.org,adminWork,ids.second])
 await db.query("insert into public.department_memberships(organization_id,department_id,profile_id,role) values($1,$2,$3,'manager')",[ids.org,ids.department,ids.second])
 await actor(ids.second)
 check(await scalar('select count(*)::int from public.projects where organization_id=$1',[ids.org]),allProjects,'Admin reads every project in its own organization')
 check(await scalar('select count(*)::int from public.projects where organization_id=$1',[ids.otherOrg]),0,'Admin cannot read another organization')
 check(await scalar("with changed as (update public.projects set name='Edited project' where id=$1 returning id) select count(*)::int from changed",[adminWork]),1,'Admin edits an existing project')
 check(await scalar("with changed as (update public.tasks set title='Edited task',status='in_progress' where id=$1 returning id) select count(*)::int from changed",[adminTask]),1,'Admin edits task details and status')
 check(await scalar("with changed as (update public.campaigns set name='Edited campaign' where id=$1 returning id) select count(*)::int from changed",[adminCampaign]),1,'Admin edits an existing campaign')
 check(await scalar("with changed as (update public.deliverables set title='Edited deliverable' where id=$1 returning id) select count(*)::int from changed",[adminDeliverable]),1,'Admin edits an existing deliverable')
 check(await scalar("with changed as (update public.assets set name='Edited asset' where id=$1 returning id) select count(*)::int from changed",[adminAsset]),1,'Admin edits an existing restricted asset')
 check(await scalar("with changed as (update public.departments set name='Edited department' where id=$1 returning id) select count(*)::int from changed",[ids.department]),1,'Admin edits an existing department')
 check(await scalar("with changed as (update public.tasks set title='Forbidden cross-organization edit' where id=$1 returning id) select count(*)::int from changed",[otherTask]),0,'Admin cannot edit another organization task')
 await denied('select public.add_asset_version($1,$2,$3)',[adminAsset,'Forbidden new version','No creation'])
 check(await scalar('select private.project_flag($1,$2)',[adminWork,'manage_members']),false,'Old manager flags do not grant Admin permission-management access')
 check(await scalar('select private.project_flag($1,$2)',[adminWork,'approve_deliverables']),false,'Old approval flags do not override edit-only role')
 await denied("insert into public.projects(organization_id,slug,name,lead_department_id,owner_id) values($1,'admin-created','Forbidden project',$2,$3)",[ids.org,ids.department,ids.second])
 await denied("insert into public.tasks(organization_id,project_id,title) values($1,$2,'Forbidden new task')",[ids.org,adminWork])
 await denied("insert into public.campaigns(organization_id,project_id,slug,name,owner_id,type,starts_on,ends_on) values($1,$2,'admin-created','Forbidden campaign',$3,'other','2026-01-01','2026-02-01')",[ids.org,adminWork,ids.second])
 await denied("insert into public.deliverables(organization_id,project_id,campaign_id,title,type,creator_id) values($1,$2,$3,'Forbidden deliverable','document',$4)",[ids.org,adminWork,adminCampaign,ids.second])
 await denied("insert into public.assets(organization_id,slug,name,type,owner_id) values($1,'admin-created','Forbidden asset','document',$2)",[ids.org,ids.second])
 await denied("insert into public.departments(organization_id,name,slug) values($1,'Forbidden department','admin-created')",[ids.org])
 await denied("insert into public.project_members(organization_id,project_id,profile_id,role) values($1,$2,$3,'project_member')",[ids.org,adminWork,ids.viewer])
 await denied('select public.admin_create_project($1::jsonb)',[JSON.stringify(payload('members'))])
 await denied('select public.admin_add_member($1,$2)',[ids.org,'viewer@test.invalid'])
 await denied('select public.admin_invite_project_member($1,$2,$3,$4)',[ids.org,adminWork,ids.viewer,'full_history'])
 await denied("update public.projects set archived_at=now() where id=$1",[adminWork])
 await denied("update public.tasks set archived_at=now() where id=$1",[adminTask])
 await denied("update public.deliverables set archived_at=now() where id=$1",[adminDeliverable])
 await denied("update public.assets set archived_at=now() where id=$1",[adminAsset])
 await denied('select public.archive_campaign($1,$2)',[adminCampaign,ids.org])
 await denied('delete from public.projects where id=$1',[adminWork])
 await denied('delete from public.tasks where id=$1',[adminTask])
 check(await scalar("with changed as (update public.project_members set can_manage_members=true where project_id=$1 and profile_id=$2 returning id) select count(*)::int from changed",[adminWork,ids.second]),0,'Admin cannot mutate project permission flags')
 check(await scalar("with changed as (update public.organization_memberships set role='org_admin' where organization_id=$1 and profile_id=$2 returning id) select count(*)::int from changed",[ids.org,ids.second]),0,'Admin cannot promote itself to Super admin')
 check(await scalar('with removed as (delete from public.project_members where project_id=$1 and profile_id=$2 returning id) select count(*)::int from removed',[adminWork,ids.member]),0,'Admin cannot remove project members')
 // Archival RPCs are SECURITY DEFINER, so test both archive and restore explicitly.
 await actor(ids.admin)
 await scalar('select public.archive_campaign($1,$2)',[adminCampaign,ids.org])
 await actor(ids.second)
 await denied('select public.unarchive_campaign($1,$2)',[adminCampaign,ids.org])
 await actor(ids.admin)
 await db.query('update public.tasks set archived_at=now() where id=$1',[adminTask])
 await actor(ids.second)
 await denied('update public.tasks set archived_at=null where id=$1',[adminTask])
 await actor(ids.admin)
 check(await scalar('select public.unarchive_campaign($1,$2)',[adminCampaign,ids.org]),'restored','Super admin retains archive/restore access')
 const superCreated=await create('members')
 check(Boolean(superCreated),true,'Super admin retains project creation access')

 // Permanent deletion: exercise a populated project without touching remote data.
 await db.query('insert into public.asset_project_links(organization_id,project_id,asset_id) values($1,$2,$3)',[ids.org,adminWork,adminAsset])
 await db.exec('reset role')
 await db.query("select set_config('request.jwt.claim.sub','',false)")
 const deletionEvent=await scalar('select gen_random_uuid()')
 await db.query("select private.open_operation('activity',$1)",[deletionEvent])
 await db.query("insert into public.activity_events(id,organization_id,project_id,verb,summary) values($1,$2,$3,'created','Project history')",[deletionEvent,ids.org,adminWork])
 await actor(ids.admin)
 await db.query('select public.admin_invite_project_member($1,$2,$3)',[ids.org,adminWork,ids.viewer])
 for (const user of [ids.second,ids.member,ids.viewer,ids.outsider]) {
  await actor(user)
  await denied('select public.admin_delete_project($1,$2,$3)',[ids.org,adminWork,'Edited project'])
 }
 await actor(ids.admin)
 await denied('select public.admin_delete_project($1,$2,$3)',[ids.otherOrg,otherWork,'Foreign work'])
 await denied('select public.admin_delete_project($1,$2,$3)',[ids.org,adminWork,'Wrong name'],'22023')
 check(await scalar('select count(*)::int from public.tasks where project_id=$1',[adminWork]),1,'wrong confirmation preserves project work')
 check(await scalar('select public.admin_delete_project($1,$2,$3)',[ids.org,adminWork,'Edited project']),true,'Super admin deletes populated project')
 for (const table of ['projects','tasks','campaigns','deliverables','approval_requests','activity_events','project_members','project_invitations','project_departments','asset_project_links']) {
  check(await scalar(`select count(*)::int from public.${table} where ${table==='projects'?'id':'project_id'}=$1`,[adminWork]),0,`deletion clears ${table}`)
 }
 check(await scalar('select count(*)::int from public.assets where id=$1',[adminAsset]),1,'shared library asset survives project deletion')
 check(await scalar('select public.admin_delete_project($1,$2,$3)',[ids.org,adminWork,'Edited project']),false,'repeated deletion reports unavailable')
 await actor(ids.admin)
 const leadProject=await create('members',{memberIds:[ids.member,ids.second]})
 const privateProject=await create('members',{memberIds:[ids.viewer]})
 await db.query("update public.organization_memberships set role='team_lead' where organization_id=$1 and profile_id=$2",[ids.org,ids.member])
 await actor(ids.member)
 check(await scalar('select count(*)::int from public.projects where id=$1',[privateProject]),0,'Team lead cannot access ungranted projects')
 const leadTask=await scalar("insert into public.tasks(organization_id,project_id,title,assignee_id) values($1,$2,'Team assignment',$3) returning id",[ids.org,leadProject,ids.second])
 check(Boolean(leadTask),true,'Team lead creates a task assigned to another organization member with project access')
 await db.query('update public.tasks set assignee_id=$1 where id=$2',[ids.member,leadTask])
 check(await scalar('select assignee_id from public.tasks where id=$1',[leadTask]),ids.member,'Team lead can reassign tasks')
 await denied('update public.tasks set assignee_id=$1 where id=$2',[ids.viewer,leadTask],'P0001')
 await denied('update public.tasks set assignee_id=$1 where id=$2',[ids.outsider,leadTask],'P0001')
 await denied("insert into public.tasks(organization_id,project_id,title) values($1,$2,'Private task')",[ids.org,privateProject])
 await denied('update public.tasks set archived_at=now() where id=$1',[leadTask])
 await denied('delete from public.tasks where id=$1',[leadTask])
 await denied('select public.admin_delete_project($1,$2,$3)',[ids.org,leadProject,'Project'])
 await denied('select public.admin_invite_project_member($1,$2,$3)',[ids.org,leadProject,ids.viewer])
 check(await scalar("with changed as (update public.organization_memberships set role='org_admin' where organization_id=$1 and profile_id=$2 returning id) select count(*)::int from changed",[ids.org,ids.member]),0,'Team lead cannot elevate organization role')
 await actor(ids.admin)
 await db.query("update public.project_members set history_access='assigned_only' where project_id=$1 and profile_id=$2",[leadProject,ids.member])
 await actor(ids.member)
 await denied("insert into public.tasks(organization_id,project_id,title) values($1,$2,'Restricted creation')",[ids.org,leadProject])
 await actor(ids.admin)
 await db.query("update public.project_members set history_access='full_history' where project_id=$1 and profile_id=$2",[leadProject,ids.member])
 await db.query('update public.projects set archived_at=now() where id=$1',[leadProject])
 await actor(ids.member)
 await denied("insert into public.tasks(organization_id,project_id,title) values($1,$2,'Archived project creation')",[ids.org,leadProject])
 await actor(ids.admin)
 const publicProject=await create('members')
 await db.query("insert into public.tasks(organization_id,project_id,title) values($1,$2,'Shared task')",[ids.org,publicProject])
 const publicToken='a'.repeat(64), assetToken='b'.repeat(64)
 const publicLink=await scalar('select public.create_viewer_link($1,$2,$3,$4)',[ids.org,publicProject,'project',publicToken])
 const assetLink=await scalar('select public.create_viewer_link($1,$2,$3,$4,$5::jsonb)',[ids.org,'local-asset','asset',assetToken,JSON.stringify({title:'Shared asset',description:'Public copy',url:'https://example.com/file.pdf',private_field:'secret'})])
 check(Boolean(assetLink),true,'Super admin creates an asset snapshot')
 await actor(ids.member)
 await denied('select public.create_viewer_link($1,$2,$3,$4)',[ids.org,publicProject,'project','c'.repeat(64)])
 await denied('select public.manage_viewer_links($1,$2,$3,$4)',[ids.org,publicProject,'project',publicLink])
 await actor(ids.admin)
 await denied('select public.create_viewer_link($1,$2,$3,$4)',[ids.otherOrg,otherWork,'project','c'.repeat(64)])
 await db.exec('reset role; set role anon')
 check(await scalar("select public.read_viewer_link($1)->'content'->'tasks'->0->>'title'",[publicToken]),'Shared task','Anonymous viewer sees only explicitly shared project snapshot')
 check(await scalar("select public.read_viewer_link($1)->'content'->>'private_field'",[assetToken]),null,'Arbitrary private asset fields are never published')
 check(await scalar('select public.read_viewer_link($1)', ['f'.repeat(64)]),null,'Unknown link is unavailable')
 await denied('select * from public.viewer_links')
 await denied('select * from public.projects')
 await denied('select public.create_viewer_link($1,$2,$3,$4)',[ids.org,publicProject,'project','c'.repeat(64)])
 await actor(ids.admin)
 await db.query('select public.manage_viewer_links($1,$2,$3,$4)',[ids.org,publicProject,'project',publicLink])
 await db.exec('reset role; set role anon')
 check(await scalar('select public.read_viewer_link($1)',[publicToken]),null,'Revocation immediately denies anonymous reads')
 await db.exec('reset role')
 await db.query("update public.viewer_links set expires_at=now()-interval '1 second' where id=$1",[assetLink])
 await db.exec('set role anon')
 check(await scalar('select public.read_viewer_link($1)',[assetToken]),null,'Expired links are unavailable')
 await actor(ids.admin)
 const taskInviteProject=await create('invitation',{memberIds:[ids.member]})
 const chosenTask=await scalar("insert into public.tasks(organization_id,project_id,title) values($1,$2,'Chosen task') returning id",[ids.org,taskInviteProject])
 const someoneElseTask=await scalar("insert into public.tasks(organization_id,project_id,title,assignee_id) values($1,$2,'Someone else task',$3) returning id",[ids.org,taskInviteProject,ids.admin])
 await denied('select public.admin_invite_project_tasks($1,$2,$3,$4,$5,$6)',[ids.org,taskInviteProject,ids.member,'assigned_only',[someoneElseTask],true],'22023')
 await denied('select public.admin_invite_project_tasks($1,$2,$3,$4,$5,$6)',[ids.org,taskInviteProject,ids.member,'assigned_only',[otherTask],true],'22023')
 await db.query('select public.admin_invite_project_tasks($1,$2,$3,$4,$5,$6)',[ids.org,taskInviteProject,ids.member,'assigned_only',[chosenTask],true])
 const taskInvitation=await scalar('select id from public.project_invitations where project_id=$1 and profile_id=$2',[taskInviteProject,ids.member])
 check(await scalar('select assignee_id from public.tasks where id=$1',[chosenTask]),null,'Pending task invitation does not assign work')
 await actor(ids.member)
 check(await scalar('select count(*)::int from public.tasks where project_id=$1',[taskInviteProject]),0,'Pending task invitation grants no task access')
 check(await scalar("select task_titles[1] from public.my_project_task_invitations($1) where id=$2",[ids.org,taskInvitation]),'Chosen task','Recipient can review selected task title before acceptance')
 await db.query('select public.accept_project_invitation($1)',[taskInvitation])
 check(await scalar('select assignee_id from public.tasks where id=$1',[chosenTask]),ids.member,'Accepting atomically assigns selected work')
 check(await scalar('select count(*)::int from public.tasks where project_id=$1',[taskInviteProject]),1,'Accepted restricted invitation exposes only own task')
 check(await scalar('select public.set_assigned_task_status($1,$2,$3,$4)',[ids.org,taskInviteProject,chosenTask,'in_progress']),true,'Explicit status grant permits Team lead assigned-only progress update')
 check(await scalar('select status from public.tasks where id=$1',[chosenTask]),'in_progress','Status update persists')
 check(await scalar('select public.set_assigned_task_status($1,$2,$3,$4)',[ids.org,taskInviteProject,someoneElseTask,'done']),false,'Status permission cannot change another person task')
 check(await scalar("with changed as (update public.tasks set title='Forbidden title' where id=$1 returning id) select count(*)::int from changed",[chosenTask]),0,'Status-only member cannot edit task details directly')
 check(await scalar('with changed as (update public.tasks set assignee_id=$1 where id=$2 returning id) select count(*)::int from changed',[ids.admin,chosenTask]),0,'Status-only member cannot reassign work')
 await denied('select public.admin_invite_project_tasks($1,$2,$3,$4,$5,$6)',[ids.org,taskInviteProject,ids.viewer,'assigned_only',[],false])
 await actor(ids.admin)
 await db.query('update public.project_members set can_update_assigned_status=false where project_id=$1 and profile_id=$2',[taskInviteProject,ids.member])
 await actor(ids.member)
 await denied('select public.set_assigned_task_status($1,$2,$3,$4)',[ids.org,taskInviteProject,chosenTask,'done'])
 check(await scalar('with changed as (update public.project_members set can_update_assigned_status=true where project_id=$1 and profile_id=$2 returning id) select count(*)::int from changed',[taskInviteProject,ids.member]),0,'Restricted member cannot grant itself status access')
 await actor(ids.admin)
 await db.query('update public.project_members set can_update_assigned_status=true where project_id=$1 and profile_id=$2',[taskInviteProject,ids.member])
 await db.query('update public.tasks set archived_at=now() where id=$1',[chosenTask])
 await actor(ids.member)
 check(await scalar('select public.set_assigned_task_status($1,$2,$3,$4)',[ids.org,taskInviteProject,chosenTask,'done']),false,'Archived task status stays protected')
 await actor(ids.admin)
 const changedTask=await scalar("insert into public.tasks(organization_id,project_id,title) values($1,$2,'Changed after invitation') returning id",[ids.org,taskInviteProject])
 await denied('select public.admin_invite_project_tasks($1,$2,$3,$4,$5,$6)',[ids.org,taskInviteProject,ids.viewer,'assigned_only',[changedTask],true],'22023')
 await db.query('select public.admin_invite_project_tasks($1,$2,$3,$4,$5,$6)',[ids.org,taskInviteProject,ids.viewer,'assigned_only',[changedTask],false])
 const staleInvite=await scalar('select id from public.project_invitations where project_id=$1 and profile_id=$2',[taskInviteProject,ids.viewer])
 await db.query('update public.tasks set assignee_id=$1 where id=$2',[ids.admin,changedTask])
 await actor(ids.viewer)
 await denied('select public.accept_project_invitation($1)',[staleInvite],'22023')
 check(await hasMember(taskInviteProject,ids.viewer),0,'Changed task rolls back invitation acceptance without granting membership')
 await actor(ids.admin)
 check(await scalar('select count(*)::int from public.project_invitations where id=$1',[staleInvite]),1,'Failed acceptance retains invitation for correction')
 await db.query('update public.tasks set assignee_id=null where id=$1',[changedTask])
 await actor(ids.viewer)
 await db.query('select public.accept_project_invitation($1)',[staleInvite])
 await denied('select public.set_assigned_task_status($1,$2,$3,$4)',[ids.org,taskInviteProject,changedTask,'done'])

 // Shared files are registered only through the server role after byte verification.
 await actor(ids.admin)
 const fileProject=await create('custom',{memberIds:[ids.member,ids.viewer],permissions:{manageAssets:true}})
 const limitedEmployee=await scalar('select gen_random_uuid()')
 const unrelatedEmployee=await scalar('select gen_random_uuid()')
 await db.exec('reset role')
 await db.query("insert into auth.users(id,email) values($1,'limited-file@test.invalid'),($2,'unrelated-file@test.invalid')",[limitedEmployee,unrelatedEmployee])
 await db.query("insert into public.organization_memberships(organization_id,profile_id,role) values($1,$2,'member'),($3,$4,'member')",[ids.org,limitedEmployee,ids.otherOrg,unrelatedEmployee])
 await db.query("insert into public.project_members(organization_id,project_id,profile_id,role,history_access) values($1,$2,$3,'project_member','assigned_only')",[ids.org,fileProject,limitedEmployee])
 const sharedId=await scalar('select gen_random_uuid()'),sharedVersion=await scalar('select gen_random_uuid()')
 const filePayload={organizationId:ids.org,assetId:sharedId,versionId:sharedVersion,projectId:fileProject,visibility:'project_members',contentHash:'a'.repeat(64),name:'Shared project file',description:'Private design',tags:['brand'],collection:'Brand',fileName:'logo.png',mime:'image/png',size:100,type:'image'}
 await actor(ids.member)
 await denied('select public.register_shared_asset($1,$2::jsonb)',[ids.member,JSON.stringify(filePayload)])
 await db.exec('reset role; set role service_role')
 check(await scalar('select public.register_shared_asset($1,$2::jsonb)',[ids.member,JSON.stringify(filePayload)]),sharedId,'server registers scoped file atomically')
 check(await scalar('select public.register_shared_asset($1,$2::jsonb)',[ids.member,JSON.stringify(filePayload)]),sharedId,'file finalization is idempotent')
 for(const duplicateName of ['Shared project file','SHARED PROJECT FILE','  shared   project file  ']){
  await denied('select public.register_shared_asset($1,$2::jsonb)',[ids.member,JSON.stringify({...filePayload,assetId:await scalar('select gen_random_uuid()'),versionId:await scalar('select gen_random_uuid()'),name:duplicateName})],'23505')
 }
 await denied('select public.register_shared_asset($1,$2::jsonb)',[ids.member,JSON.stringify({...filePayload,assetId:await scalar('select gen_random_uuid()'),versionId:await scalar('select gen_random_uuid()'),name:'Renamed same bytes'})],'23505')
 check(await scalar('select public.shared_asset_content_exists($1,$2)',[ids.org,'a'.repeat(64)]),true,'identical bytes detected regardless of name')
 check(await scalar('select public.shared_asset_content_exists($1,$2)',[ids.otherOrg,'a'.repeat(64)]),false,'content checks stay within company')
 check(await scalar('select public.shared_asset_name_exists($1,$2)',[ids.org,' SHARED   PROJECT FILE ']),true,'duplicate preflight normalizes case and whitespace')
 check(await scalar('select public.shared_asset_name_exists($1,$2)',[ids.otherOrg,'Shared project file']),false,'names are scoped to company')
 await denied('select public.register_shared_asset($1,$2::jsonb)',[ids.second,JSON.stringify({...filePayload,assetId:ids.second})])
 await denied('select public.register_shared_asset($1,$2::jsonb)',[ids.viewer,JSON.stringify({...filePayload,assetId:ids.viewer})])
 await denied('select public.register_shared_asset($1,$2::jsonb)',[unrelatedEmployee,JSON.stringify({...filePayload,assetId:unrelatedEmployee})])
 await actor(ids.member)
 check((await scalar('select public.shared_asset_file($1)',[sharedId])).path,ids.org+'/'+sharedId+'/v1/'+sharedVersion,'full-history member gets only scoped file descriptor')
 check((await scalar('select public.list_shared_assets($1)',[ids.org])).some(a=>a.id===sharedId&&a.hasFile&&a.canEdit),true,'uploader sees shared file in library')
 await denied("update public.assets set visibility='company' where id=$1",[sharedId])
 await denied('delete from public.asset_project_links where asset_id=$1',[sharedId])
 await actor(ids.admin)
 await db.query("update public.project_members set history_access='assigned_only' where project_id=$1 and profile_id=$2",[fileProject,ids.member])
 await actor(ids.member)
 check(await scalar('select public.shared_asset_file($1)',[sharedId]),null,'downgraded uploader cannot bypass assigned-only file restrictions')
 await actor(ids.admin)
 await db.query("update public.project_members set history_access='full_history',can_manage_assets=true where project_id=$1 and profile_id=$2",[fileProject,ids.member])

 await actor(limitedEmployee)
 check(await scalar('select public.shared_asset_file($1)',[sharedId]),null,'assigned-only membership cannot download project files')
 check((await scalar('select public.list_shared_assets($1)',[ids.org])).some(a=>a.id===sharedId),false,'assigned-only file metadata stays hidden')
 await actor(unrelatedEmployee)
 await denied('select public.list_shared_assets($1)',[ids.org])
 check(await scalar('select public.shared_asset_file($1)',[sharedId]),null,'another company cannot read files')
 await actor(ids.viewer)
 check((await scalar('select public.shared_asset_file($1)',[sharedId])).assetId,sharedId,'full-history viewer can download')
 await denied('select public.edit_shared_asset($1,$2::jsonb)',[sharedId,JSON.stringify({name:'No',description:'',tags:[],collection:'General'})])
 await denied('select public.delete_shared_asset($1,$2)',[sharedId,'Shared project file'])
 await actor(ids.second)
 await db.query('select public.edit_shared_asset($1,$2::jsonb)',[sharedId,JSON.stringify({name:'Admin edited file',description:'Edited',tags:['reviewed'],collection:'Brand'})]);checks++
 await denied('select public.delete_shared_asset($1,$2)',[sharedId,'Admin edited file'])
 await denied('select public.edit_shared_asset($1,$2::jsonb)',[sharedId,JSON.stringify({name:'Admin edited file',description:'',tags:[],collection:'General',visibility:'company',projectId:''})])
 await actor(ids.admin)
 const fileToken='e'.repeat(64)
 const sharedLink=await scalar('select public.create_viewer_link($1,$2,$3,$4,$5::jsonb)',[ids.org,sharedId,'asset',fileToken,JSON.stringify({title:'Forged',url:'https://evil.invalid'})])
 await db.exec('reset role; set role anon')
 const fileSnapshot=await scalar('select public.read_viewer_link($1)',[fileToken])
 check(fileSnapshot.content.title,'Admin edited file','public asset snapshot uses database metadata, not caller fields')
 check(fileSnapshot.content.versionId,sharedVersion,'public link snapshots a specific stored version')
 check(fileSnapshot.content.url,'','public snapshot excludes forged external file URLs')
 await denied('select public.shared_asset_file($1)',[sharedId])
 await actor(ids.admin)

 await db.query('select public.edit_shared_asset($1,$2::jsonb)',[sharedId,JSON.stringify({name:'Admin edited file',description:'',tags:[],collection:'General',visibility:'company',projectId:''})]);checks++
 await actor(limitedEmployee)
 check((await scalar('select public.shared_asset_file($1)',[sharedId])).assetId,sharedId,'company-wide file access is explicit and available to organization members')
 await db.exec('reset role; set role anon')
 check(await scalar('select public.read_viewer_link($1)',[fileToken]),null,'changing file access revokes previous public links')
 await actor(ids.admin)
 const deletionFileToken='f'.repeat(64)
 await db.query('select public.create_viewer_link($1,$2,$3,$4)',[ids.org,sharedId,'asset',deletionFileToken]);checks++
 await db.exec('reset role; set role anon')
 check((await scalar('select public.read_viewer_link($1)',[deletionFileToken])).content.versionId,sharedVersion,'new public token works before deletion')
 await actor(ids.admin)
 await denied('select public.delete_shared_asset($1,$2)',[sharedId,'Wrong name'],'22023')
 const removedFiles=await scalar('select public.delete_shared_asset($1,$2)',[sharedId,'Admin edited file'])
 check(removedFiles,[{bucket:'shared-assets',path:ids.org+'/'+sharedId+'/v1/'+sharedVersion}],'deletion returns only actual stored file paths')
 check(await scalar('select count(*)::int from public.asset_versions where asset_id=$1',[sharedId]),0,'file version metadata removed with asset')
 check(await scalar('select count(*)::int from public.projects where id=$1',[fileProject]),1,'asset deletion keeps project')
 await db.exec('reset role; set role anon')
 check(await scalar('select public.read_viewer_link($1)',[deletionFileToken]),null,'asset deletion revokes anonymous file sharing')
 await actor(ids.admin)
 // Employee departure transfers existing work without granting ordinary recipients new access.
 await db.exec('reset role');const departing=await scalar('select gen_random_uuid()');
 await db.query("insert into auth.users(id,email) values($1,'departing@test.invalid')",[departing]);
 await db.query("insert into public.organization_memberships(organization_id,profile_id,role) values($1,$2,'member')",[ids.org,departing]);
 await actor(ids.admin);const departureProject=await create('organization');
 await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)");
 await db.query('update public.projects set owner_id=$1 where id=$2',[departing,departureProject]);
 const departureCampaign=await scalar("insert into public.campaigns(organization_id,project_id,slug,name,owner_id,type,starts_on,ends_on) values($1,$2,'departure','Departure campaign',$3,'other','2026-01-01','2026-02-01') returning id",[ids.org,departureProject,departing]);
 const departureTask=await scalar("insert into public.tasks(organization_id,project_id,title,assignee_id) values($1,$2,'Departure task',$3) returning id",[ids.org,departureProject,departing]);
 await db.exec('set role service_role');
 await denied('select public.transfer_departing_employee_work($1,$2,$3,$4)',[ids.member,ids.org,departing,ids.admin]);
 await denied('select public.transfer_departing_employee_work($1,$2,$3,$4)',[ids.admin,ids.org,departing,ids.viewer],'P0001');
 await denied('select public.transfer_departing_employee_work($1,$2,$3,$4)',[ids.admin,ids.org,departing,unrelatedEmployee],'P0001');
 const moved=await scalar('select public.transfer_departing_employee_work($1,$2,$3,$4)',[ids.admin,ids.org,departing,ids.admin]);
 check(moved,{projects:1,campaigns:1,assets:0,tasks:1},'departure transfers all ownership and assignments');
 await db.exec('reset role');
 check(await scalar('select owner_id from public.projects where id=$1',[departureProject]),ids.admin,'project ownership retained by recipient');
 check(await scalar('select owner_id from public.campaigns where id=$1',[departureCampaign]),ids.admin,'campaign ownership retained by recipient');
 check(await scalar('select assignee_id from public.tasks where id=$1',[departureTask]),ids.admin,'task assigned to recipient');
 // Shared asset folders enforce the same audience as their files.
 await actor(ids.admin);
 const companyFolder=await scalar('select public.create_asset_folder($1,$2,$3)',[ids.org,'Brand images',null]);
 const projectFolder=await scalar('select public.create_asset_folder($1,$2,$3)',[ids.org,'Project images',fileProject]);
 await denied('select public.create_asset_folder($1,$2,$3)',[ids.org,' BRAND  IMAGES ',null],'23505');
 await actor(ids.viewer);check(await scalar('select count(*)::int from public.asset_folders where id=$1',[companyFolder]),1,'viewer reads company folder');
 await denied('select public.create_asset_folder($1,$2,$3)',[ids.org,'Viewer folder',null]);
 await actor(ids.second);await denied('select public.create_asset_folder($1,$2,$3)',[ids.org,'Admin folder',null]);
 await actor(limitedEmployee);check(await scalar('select count(*)::int from public.asset_folders where id=$1',[projectFolder]),0,'assigned-only access hides project folder');
 await actor(unrelatedEmployee);check(await scalar('select count(*)::int from public.asset_folders where id=$1',[companyFolder]),0,'other organization cannot read folder');
 await db.exec('reset role; set role service_role');
 const folderAsset=await scalar('select gen_random_uuid()'),folderVersion=await scalar('select gen_random_uuid()');
 const folderPayload={...filePayload,assetId:folderAsset,versionId:folderVersion,name:'Folder image',contentHash:'b'.repeat(64),folderId:projectFolder};
 check(await scalar('select public.register_shared_asset($1,$2::jsonb)',[ids.admin,JSON.stringify(folderPayload)]),folderAsset,'verified file is registered directly in selected folder');
 await actor(ids.admin);check(await scalar('select folder_id from public.assets where id=$1',[folderAsset]),projectFolder,'folder selection is stored centrally');
 await denied('select public.move_asset_to_folder($1,$2)',[folderAsset,companyFolder],'22023');
 check(await scalar('select folder_id from public.assets where id=$1',[folderAsset]),projectFolder,'failed move preserves original folder and access');
 await db.query('select public.move_asset_to_folder($1,$2)',[folderAsset,null]);checks++;
 check(await scalar('select folder_id from public.assets where id=$1',[folderAsset]),null,'file can move back to root without deleting it');
 await db.query('select public.move_asset_to_folder($1,$2)',[folderAsset,projectFolder]);checks++;
 await actor(ids.viewer);await denied('select public.move_asset_to_folder($1,$2)',[folderAsset,null]);
 await actor(ids.admin);await denied("update public.assets set visibility='company' where id=$1",[folderAsset],'23514');
 await denied('insert into public.asset_project_links(organization_id,project_id,asset_id) values($1,$2,$3)',[ids.org,departureProject,folderAsset],'23514');
 check((await scalar('select public.list_shared_assets($1)',[ids.org])).find(a=>a.id===folderAsset).folderId,projectFolder,'library includes authorized folder identity');

 // Task submissions: restricted assignee, serialized revisions, reviewer permissions and database guards.
 await actor(ids.admin);
 const workMember=await scalar('select gen_random_uuid()'),workLead=await scalar('select gen_random_uuid()');
 await db.exec('reset role');
 await db.query("insert into auth.users(id,email) values($1,'work-member@test.invalid'),($2,'work-lead@test.invalid')",[workMember,workLead]);
 await db.query("insert into public.organization_memberships(organization_id,profile_id,role) values($1,$2,'member'),($1,$3,'team_lead')",[ids.org,workMember,workLead]);
 await actor(ids.admin);
 const workProject=await create('members',{memberIds:[workMember,workLead,ids.viewer]});
 await db.query("update public.project_members set history_access='assigned_only',can_update_assigned_status=true where project_id=$1 and profile_id=$2",[workProject,workMember]);
 const workTask=await scalar("insert into public.tasks(organization_id,project_id,title,assignee_id) values($1,$2,'Review me',$3) returning id",[ids.org,workProject,workMember]);
 const unrelatedTask=await scalar("insert into public.tasks(organization_id,project_id,title,assignee_id) values($1,$2,'Private comparison',$3) returning id",[ids.org,workProject,workLead]);
 await denied("insert into public.tasks(organization_id,project_id,title,status) values($1,$2,'Bypass','done')",[ids.org,workProject],'23514');
 await actor(workMember);await denied('select public.task_work_panel($1)',[unrelatedTask]);
 check((await scalar('select public.task_work_panel($1)',[workTask])).canSubmit,true,'restricted assignee can submit');
 await denied("select public.set_assigned_task_status($1,$2,$3,'done')",[ids.org,workProject,workTask],'23514');
 await denied("select public.set_assigned_task_status($1,$2,$3,'in_review')",[ids.org,workProject,workTask],'23514');
 const submissionId=await scalar('select gen_random_uuid()');
 const workPayload={id:submissionId,organizationId:ids.org,taskId:workTask,note:'First draft',link:'https://example.com/draft'};
 await denied('select public.register_task_submission($1,$2::jsonb)',[workMember,JSON.stringify(workPayload)]);
 await db.exec('reset role;set role service_role');
 await denied('select public.register_task_submission($1,$2::jsonb)',[workLead,JSON.stringify(workPayload)]);
 check(await scalar('select public.register_task_submission($1,$2::jsonb)',[workMember,JSON.stringify(workPayload)]),submissionId,'server finalizes authorized draft');
 check(await scalar('select public.register_task_submission($1,$2::jsonb)',[workMember,JSON.stringify(workPayload)]),submissionId,'same upload finalization is idempotent');
 await denied('select public.register_task_submission($1,$2::jsonb)',[workMember,JSON.stringify({...workPayload,id:await scalar('select gen_random_uuid()')})],'22023');
 await actor(workMember);check(await scalar('select status from public.tasks where id=$1',[workTask]),'in_review','submission sets review state atomically');
 await denied("select public.set_assigned_task_status($1,$2,$3,'in_progress')",[ids.org,workProject,workTask],'23514');
 await denied('select * from public.task_submissions');
 await denied("select public.review_task_submission($1,'approved','')",[submissionId]);
 await actor(ids.viewer);await denied("select public.review_task_submission($1,'approved','')",[submissionId]);
 await actor(workLead);check((await scalar('select public.task_work_panel($1)',[workTask])).canReview,true,'Team lead can review project work');
 await denied("select public.review_task_submission($1,'changes_requested','   ')",[submissionId],'22023');
 await db.query("select public.review_task_submission($1,'changes_requested','Please add the missing detail.')",[submissionId]);checks++;
 check(await scalar('select status from public.tasks where id=$1',[workTask]),'in_progress','requested changes reopen task');
 await denied("select public.review_task_submission($1,'approved','')",[submissionId],'22023');
 await actor(workMember);check((await scalar('select public.task_work_panel($1)',[workTask])).submissions[0].reviewNote,'Please add the missing detail.','assignee sees reviewer feedback');
 const revisionId=await scalar('select gen_random_uuid()');
 await db.exec('reset role;set role service_role');
 await db.query('select public.register_task_submission($1,$2::jsonb)',[workMember,JSON.stringify({...workPayload,id:revisionId,note:'Revised draft',fileName:'result.txt',mime:'text/plain',size:12})]);checks++;
 await actor(workLead);check((await scalar('select public.task_work_panel($1)',[workTask])).submissions.map(s=>s.revision),[2,1],'prior revision and feedback are retained');
 await actor(unrelatedEmployee);await denied('select public.task_submission_file($1)',[revisionId]);
 await actor(ids.viewer);check((await scalar('select public.task_submission_file($1)',[revisionId])).fileName,'result.txt','full-history viewer can download submitted file');
 await actor(ids.admin);await denied('update public.tasks set assignee_id=$1 where id=$2',[workLead,workTask],'23514');
 await actor(workLead);await db.query("select public.review_task_submission($1,'approved','Looks good.')",[revisionId]);checks++;
 check(await scalar('select status from public.tasks where id=$1',[workTask]),'done','review approval completes task');
 await actor(workMember);check((await scalar('select public.task_work_panel($1)',[workTask])).canSubmit,false,'completed task no longer accepts submissions');
 check((await scalar('select public.task_work_panel($1)',[workTask])).submissions[0].status,'approved','approved work remains visible');
 check(await scalar("select count(*)::int from public.notifications where recipient_id=$1 and title like '%Review me'",[workMember]),2,'changes and approval notify employee');
 await actor(ids.admin);const selfTask=await scalar("insert into public.tasks(organization_id,project_id,title,assignee_id) values($1,$2,'Self review test',$3) returning id",[ids.org,workProject,ids.admin]);
 const selfSubmission=await scalar('select gen_random_uuid()');
 await db.exec('reset role;set role service_role');await db.query('select public.register_task_submission($1,$2::jsonb)',[ids.admin,JSON.stringify({...workPayload,id:selfSubmission,taskId:selfTask})]);
 await actor(ids.admin);await denied("select public.review_task_submission($1,'approved','')",[selfSubmission]);
 await actor(workLead);await db.query("select public.review_task_submission($1,'approved','Independent review')",[selfSubmission]);checks++;
 check(await scalar('select status from public.tasks where id=$1',[selfTask]),'done','different authorized reviewer can approve Super admin work');
 console.log(`Passed ${checks} PostgreSQL permission and workflow checks across all migrations.`)
} catch (error) { console.error(JSON.stringify({message:error.message,code:error.code,query:error.query})); process.exitCode=1 } finally { await db.close() }
