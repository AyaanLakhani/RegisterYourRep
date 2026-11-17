// lib/v1/profiles.js
import { ApiError } from '../apiHandler'
import { ProfileVersion } from '../models'

export function latestProfile(privyUserId) {
  return ProfileVersion.findOne({ privyUserId }).sort({ version: -1 }).lean()
}

export async function requireProfile(privyUserId) {
  const profile = await latestProfile(privyUserId)
  if (!profile) throw new ApiError(400, 'Finish onboarding first.')
  return profile
}
