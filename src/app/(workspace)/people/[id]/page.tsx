import type { Metadata } from "next"
import { EmployeeProfileView } from "@/components/people/employee-profile-view"

export const metadata: Metadata = { title: "Employee profile" }

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EmployeeProfileView profileId={id} />
}
