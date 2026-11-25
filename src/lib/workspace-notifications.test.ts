import {expect,it} from "vitest"
import {notificationHref} from "./workspace-notifications"
const request="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",task="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
it("opens request decisions and final deliveries directly in their request",()=>{expect(notificationHref({department_request_id:request,task_id:null})).toBe("/requests?request="+request)})
it("opens an assigned task without requiring access to its request inbox",()=>{expect(notificationHref({department_request_id:request,task_id:task})).toBe("/tasks/"+task)})
it("preserves legacy notification destinations",()=>{expect(notificationHref({department_request_id:null,task_id:null})).toBe("/activity")})
it("does not turn malformed stored IDs into navigation URLs",()=>{expect(notificationHref({department_request_id:"https://example.com",task_id:"javascript:alert(1)"})).toBe("/activity")})
