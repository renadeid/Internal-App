import type { Metadata } from "next"
import { PageIntro } from "@/components/shared/page-intro"
import { KnowledgeLibrary } from "@/components/knowledge/knowledge-library"

export const metadata: Metadata = { title: "Knowledge Base" }
export default function KnowledgePage() {
  return <div className="flex flex-col gap-6"><PageIntro title="Knowledge Base" description="Your guide to roles, project access, tasks and sharing." /><KnowledgeLibrary /></div>
}
