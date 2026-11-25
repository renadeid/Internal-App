"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CalendarDays, UserRound, Flag, FolderOpen, Check } from "lucide-react"
import { useOrganization } from "@/components/auth/organization-provider"
import { Button } from "@/components/ui/button"
import { getOrganizationTask } from "@/lib/auth/get-organization-tasks"
import { type OrganizationTask, taskPriorityLabel, taskStatusLabel } from "@/lib/auth/organization-tasks"
import { subscribeTaskListRefresh } from "@/lib/auth/task-list-refresh"
import { surfaceClass } from "@/lib/presentation"
import { TaskWorkContent } from "./task-work-dialog"
import { AssignedTaskStatus } from "./assigned-task-status"

export function TaskDetail({ taskId }: { taskId: string }) {
 const { activeOrganization } = useOrganization()
 const organizationId = activeOrganization?.id
 const [snapshot, setSnapshot] = useState<{key:string;task:OrganizationTask|null;error:string}|null>(null)
 const [attempt, setAttempt] = useState(0)
 const key = organizationId + ":" + taskId
 useEffect(() => {
  if (!organizationId) return
  let active = true
  async function load() {
   try {
    const result = await getOrganizationTask(organizationId!, taskId)
    if (!active) return
    setSnapshot({key, task:result.status === "ready" ? result.tasks[0] ?? null : null, error:result.status === "error" ? "Task details could not be loaded. Please retry." : result.status !== "ready" ? "This task is unavailable or you do not have access to it in this organization." : ""})
   } catch { if (active) setSnapshot({key,task:null,error:"Task details could not be loaded. Please retry."}) }
  }
  void load()
  const unsubscribe = subscribeTaskListRefresh(() => void load())
  return () => { active = false; unsubscribe() }
 }, [organizationId, taskId, key, attempt])
 const current = snapshot?.key === key ? snapshot : null
 const task = current?.task
 return <div className="mx-auto grid w-full max-w-6xl gap-6">
  <Link href="/tasks" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/>Back to my tasks</Link>
  {!organizationId ? <p role="status">Select an organization to open this task.</p> : !current ? <p role="status">Loading task details…</p> : !task ? <section className={surfaceClass+" p-6"}><p role="alert">{current.error || "This task is unavailable."}</p><Button className="mt-4" variant="outline" onClick={()=>setAttempt(value=>value+1)}>Retry</Button></section> : <>
   <header className={surfaceClass+" overflow-hidden p-6 sm:p-8"}>
    <div className="flex flex-wrap items-center gap-2 text-xs font-medium"><span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">{taskStatusLabel(task.status)}</span>{task.archivedAt ? <span className="rounded-full bg-muted px-3 py-1.5">Archived · read only</span> : null}<span className="text-muted-foreground">TASK DETAILS</span></div>
    <h1 className="mt-4 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{task.title}</h1>
    <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
     <Detail icon={<UserRound className="size-4"/>} label="Assigned to" value={task.assigneeName ?? "Unassigned"}/>
     <Detail icon={<CalendarDays className="size-4"/>} label="Due date" value={task.dueOn ? new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(task.dueOn+"T12:00:00Z")) : "No due date"}/>
     <Detail icon={<Flag className="size-4"/>} label="Priority" value={taskPriorityLabel(task.priority)}/>
     <div className="min-w-0"><p className="flex items-center gap-2 text-xs text-muted-foreground"><FolderOpen className="size-4"/>Project</p>{task.projectName ? <Link className="mt-2 block text-sm font-medium text-primary hover:underline" href={"/projects/"+task.projectId}>{task.projectName}</Link> : <p className="mt-2 text-sm">Project unavailable</p>}</div>
    </div>
   </header>
   <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
    <div className="grid min-w-0 gap-6">
     <section className={surfaceClass+" p-6"}><h2 className="text-lg font-semibold">The brief</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{task.description || "No brief added yet. Ask the task owner to clarify the expected result before submitting."}</p></section>
     <section className={surfaceClass+" min-w-0 p-5 sm:p-6"}><h2 className="text-lg font-semibold">Delivery & review</h2><p className="mb-6 mt-1 text-sm leading-6 text-muted-foreground">Keep submitted files, revision notes and review decisions together.</p><TaskWorkContent key={key} organizationId={organizationId} task={task}/></section>
    </div>
    <aside className={surfaceClass+" p-6"}><h2 className="font-semibold">Task workflow</h2><ol className="mt-5 grid gap-5">{["To do","In progress","In review","Done"].map((label,index)=>{const step=["todo","in_progress","in_review","done"].indexOf(task.status);return <li key={label} className="flex items-center gap-3 text-sm"><span className={"flex size-7 shrink-0 items-center justify-center rounded-full text-xs "+(index<=step?"bg-primary/15 text-primary":"bg-muted text-muted-foreground")}>{index<step?<Check className="size-3.5"/>:index+1}</span><span className={index===step?"font-semibold":"text-muted-foreground"}>{label}</span>{index===step?<span className="ml-auto text-xs text-primary">Current</span>:null}</li>})}</ol><p className="mt-5 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">Submit work to start a review. Requested changes return the task to In progress. Approval marks it Done.</p>{task.canUpdateStatus && !task.canWrite && !task.archivedAt ? <div className="mt-4"><AssignedTaskStatus task={task}/></div> : null}</aside>
   </div>
  </>}
 </div>
}
function Detail({icon,label,value}:{icon:React.ReactNode;label:string;value:string}) {return <div className="min-w-0"><p className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</p><p className="mt-2 break-words text-sm font-medium">{value}</p></div>}
