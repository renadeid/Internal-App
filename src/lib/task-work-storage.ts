import "server-only"
import {createHmac,timingSafeEqual} from "node:crypto"
export const taskWorkBucket="task-submissions"
export type WorkTicket={id:string;taskId:string;organizationId:string;actorId:string;note:string;link:string;fileName:string;size:number;mime:string;expires:number}
const signature=(body:string)=>{const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw Error("File storage is not configured.");return createHmac("sha256",key).update("task-work-upload:"+body).digest("base64url")}
export function signWorkTicket(ticket:WorkTicket){const body=Buffer.from(JSON.stringify(ticket)).toString("base64url");return body+"."+signature(body)}
export function readWorkTicket(token:string):WorkTicket{
 if(typeof token!=="string"||token.length>24000)throw Error("Invalid upload.")
 const [body,sig,...rest]=token.split(".");if(!body||!sig||rest.length)throw Error("Invalid upload.")
 const expected=Buffer.from(signature(body)),actual=Buffer.from(sig);if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw Error("Invalid upload.")
 const ticket=JSON.parse(Buffer.from(body,"base64url").toString()) as WorkTicket
 if(!Number.isFinite(ticket.expires)||ticket.expires<Date.now())throw Error("Upload expired. Select the file again.")
 return ticket
}
export function taskWorkPath(organizationId:string,taskId:string,id:string){if(![organizationId,taskId,id].every(v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)))throw Error("Invalid file address.");return `${organizationId}/${taskId}/${id}`}
