import type { Metadata } from "next"

import { PeopleDirectory } from "@/components/people/people-directory"

export const metadata: Metadata = {
  title: "People & Onboarding",
}

export default function PeoplePage() {
  return <PeopleDirectory />
}
