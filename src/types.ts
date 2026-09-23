export type Coordinates = {
  latitude: number
  longitude: number
  accuracy: number
}

export type ConsentVersion = {
  id: string
  version: string
  title: string
  body: string
  published_at: string
}

export type ConsentAcceptance = {
  id: string
  consent_version_id: string
  accepted_at: string
}

export type ProjectMembership = {
  project_id: string
  projects: { name: string } | null
}

export type OnomatopoeiaRecord = {
  id: string
  onomatopoeia: string
  description: string | null
  latitude: number
  longitude: number
  accuracy_m: number | null
  photo_path: string | null
  recorded_at: string
}
