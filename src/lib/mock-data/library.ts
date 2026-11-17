import type { Artifact, Article } from "@/lib/types"

export { initialAssets as assets } from "@/lib/mock-data/assets"

export const artifacts: Artifact[] = [
  {
    id: "artifact-narrative",
    name: "Launch narrative",
    kind: "Deck",
    projectId: "spring",
    ownerId: "maya",
    updatedLabel: "Updated yesterday",
  },
  {
    id: "artifact-principles",
    name: "Brand principles",
    kind: "Guidelines",
    projectId: "brand",
    ownerId: "jonah",
    updatedLabel: "Updated today",
  },
  {
    id: "artifact-story",
    name: "Harbor story draft",
    kind: "Document",
    projectId: "harbor",
    ownerId: "priya",
    updatedLabel: "Updated today",
  },
  {
    id: "artifact-checklist",
    name: "Week-one checklist",
    kind: "Checklist",
    projectId: "onboarding",
    ownerId: "sam",
    updatedLabel: "Updated yesterday",
  },
  {
    id: "artifact-channels",
    name: "Q2 channel outline",
    kind: "Brief",
    projectId: "demand",
    ownerId: "leo",
    updatedLabel: "Updated yesterday",
  },
]

export const articles: Article[] = [
  {
    id: "article-requests",
    title: "How marketing asks design for help",
    summary: "What to include so a request can start without a meeting.",
    body: "Name the project, the date the work needs to be in market, and the decision you need from design. Attach the brief from Artifact Hub and the latest shared files from the Assets Library. Jonah reviews new marketing requests each morning.",
  },
  {
    id: "article-voice",
    title: "Voice for Field Notes",
    summary: "How Northline sounds in launch copy.",
    body: "Write like a colleague who has been on site. Prefer concrete nouns over campaign language. Say who the product is for, what they do differently with it, and what changes in their day. Avoid slogans in body copy.",
  },
  {
    id: "article-launch",
    title: "Launch checklist",
    summary: "The sequence marketing follows before a product is public.",
    body: "Lock the narrative, then the homepage, then sales materials. Legal reviews customer quotes before they are published. Design signs the photography set. Product confirms the screenshots match the build that will ship.",
  },
  {
    id: "article-assets",
    title: "Where shared files live",
    summary: "Which library to use for logos, cuts, and finished deliverables.",
    body: "Working files and brand source files belong in the Assets Library. Finished decks, briefs, and checklists belong in Artifact Hub, attached to a project. If a file is the answer to a repeated question, add a note to the Knowledge Base as well.",
  },
]
