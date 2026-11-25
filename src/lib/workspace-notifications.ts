export type WorkspaceNotification={id:string;title:string;read_at:string|null;created_at:string;department_request_id:string|null;task_id:string|null}
const uuid=(value:string|null)=>value!==null&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function notificationHref(notification:Pick<WorkspaceNotification,"department_request_id"|"task_id">){
 if(uuid(notification.task_id))return "/tasks/"+notification.task_id
 if(uuid(notification.department_request_id))return "/requests?request="+notification.department_request_id
 return "/activity"
}
