import { Suspense } from "react"
import type { Metadata } from "next"
import { DepartmentRequestsWorkspace } from "@/components/requests/department-requests-workspace"
export const metadata:Metadata={title:"Department requests"}
export default function RequestsPage(){return <Suspense fallback={<p role="status">Loading department requests…</p>}><DepartmentRequestsWorkspace/></Suspense>}
