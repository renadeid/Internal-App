import type { TeamMember } from "@/lib/types"

export const currentUserId = "maya"

export const marketingManagerId = currentUserId

export function workspaceRole(memberId: string) {
  return memberId === marketingManagerId ? "Marketing Manager" : "Contributor"
}

export const team: TeamMember[] = [
  {
    id: "maya",
    name: "Maya Chen",
    role: "Marketing lead",
    department: "Marketing",
    initials: "MC",
    email: "maya.chen@northline.example",
    color: "#2563EB",
  },
  {
    id: "jonah",
    name: "Jonah Ellis",
    role: "Brand designer",
    department: "Design",
    initials: "JE",
    email: "jonah.ellis@northline.example",
    color: "#7C3AED",
  },
  {
    id: "priya",
    name: "Priya Shah",
    role: "Content strategist",
    department: "Marketing",
    initials: "PS",
    email: "priya.shah@northline.example",
    color: "#0F766E",
  },
  {
    id: "leo",
    name: "Leo Park",
    role: "Campaign manager",
    department: "Marketing",
    initials: "LP",
    email: "leo.park@northline.example",
    color: "#C2410C",
  },
  {
    id: "amira",
    name: "Amira Hassan",
    role: "Product marketing",
    department: "Product",
    initials: "AH",
    email: "amira.hassan@northline.example",
    color: "#1D4ED8",
  },
  {
    id: "sam",
    name: "Sam Ortega",
    role: "People partner",
    department: "People",
    initials: "SO",
    email: "sam.ortega@northline.example",
    color: "#475569",
  },
  {
    id: "nolan",
    name: "Nolan Brooks",
    role: "Product engineer",
    department: "Engineering",
    initials: "NB",
    email: "nolan.brooks@northline.example",
    color: "#B45309",
  },
]

export const currentUser =
  team.find((member) => member.id === currentUserId) ?? team[0]

export function getMember(id: string) {
  return (
    team.find((member) => member.id === id) ?? {
      id,
      name: "Former teammate",
      role: "Alumni",
      department: "People" as const,
      initials: "??",
      email: "",
      color: "#64748B",
    }
  )
}
