import type { Metadata } from "next"
import { DepartmentRequestsWorkspace } from "@/components/requests/department-requests-workspace"
export const metadata:Metadata={title:"Department requests"}
export default function RequestsPage(){return <DepartmentRequestsWorkspace/>}
