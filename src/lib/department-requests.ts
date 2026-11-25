import type { TaskPriorityValue, TaskStatusValue } from "@/lib/auth/organization-tasks"

export type DepartmentRequestDraft = { title:string; brief:string; departmentId:string; referenceUrl:string; priority:TaskPriorityValue; dueOn:string }
export type DepartmentRequest = {
 id:string; archivedAt:string|null; title:string; brief:string; referenceUrl:string|null; departmentId:string; departmentName:string;
 isMine:boolean; requesterName:string; priority:TaskPriorityValue; dueOn:string|null;
 status:"submitted"|"accepted"|"declined"|"cancelled"; decisionNote:string; reviewerName:string|null; reviewedAt:string|null; createdAt:string;
 canManage:boolean; taskId:string|null; taskStatus:TaskStatusValue|null; taskArchived:boolean; assigneeName:string|null;
 result:{id:string;revision:number;note:string;link:string|null;fileName:string|null;reviewedAt:string}|null;
}
export type RequestLibrary = {canCreate:boolean;departments:{id:string;name:string;canManage:boolean}[];requests:DepartmentRequest[]}
export function validateDepartmentRequest(input:DepartmentRequestDraft) {
 if (!input || typeof input.title!=="string" || typeof input.brief!=="string" || typeof input.referenceUrl!=="string" || typeof input.dueOn!=="string") throw Error("Complete the request details.")
 const title=input.title.trim(),brief=input.brief.trim(),referenceUrl=input.referenceUrl.trim()
 if (!title || title.length>160) throw Error("Enter a title up to 160 characters.")
 if (!brief || brief.length>6000) throw Error("Describe the expected result in up to 6,000 characters.")
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.departmentId)) throw Error("Choose a department.")
 if (!["low","medium","high","urgent"].includes(input.priority)) throw Error("Choose a priority.")
 if (input.dueOn && (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn) || !Number.isFinite(Date.parse(input.dueOn)) || new Date(input.dueOn).toISOString().slice(0,10)!==input.dueOn)) throw Error("Choose a valid due date.")
 if(referenceUrl) {let url:URL;try {url=new URL(referenceUrl)}catch {throw Error("Use a valid HTTPS reference link.")}
  if(referenceUrl.length>2000 || url.protocol!=="https:" || url.username || url.password) throw Error("Use a valid HTTPS reference link without login details.")
 }
 return {title,brief,departmentId:input.departmentId,referenceUrl,priority:input.priority,dueOn:input.dueOn}
}
export function requestStatusLabel(request:Pick<DepartmentRequest,"status"|"taskStatus"|"taskArchived">) {
 if (request.status==="submitted") return "Awaiting triage"
 if (request.status==="declined") return "Declined"
 if (request.status==="cancelled") return "Cancelled"
 return "Accepted"
}
export function requestTaskProgressLabel(request:Pick<DepartmentRequest,"status"|"taskStatus"|"taskArchived">) {
 if (request.status!=="accepted") return null
 if (request.taskArchived) return "Task archived"
 if (request.taskStatus==="done") return "Completed"
 if (request.taskStatus==="in_review") return "In review"
 if (request.taskStatus==="in_progress") return "In progress"
 return request.taskStatus ? "To do" : "Task unavailable"
}
