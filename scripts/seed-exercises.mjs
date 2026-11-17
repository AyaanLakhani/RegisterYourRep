// scripts/seed-exercises.mjs
// Copies the exercise catalog (lib/catalog/exercises.js) into MongoDB (RYR-13).
// Safe to run any number of times: each exercise is upserted by its slug.
//
//   npm run seed:exercises -- --dry-run   check the catalog, don't touch the DB
//   npm run seed:exercises                upsert every exercise
//   npm run seed:exercises -- --prune     also delete exercises no longer in the file
//
// Reads MONGODB_URI from .env.local the same way Next.js does.
import nextEnv from '@next/env'
import mongoose from 'mongoose'
import { EXERCISES, validateCatalog } from '@/lib/catalog'
import { Exercise } from '@/lib/models'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const prune = args.has('--prune')

const problems = validateCatalog()
if (problems.length) {
  console.error(`The catalog has ${problems.length} problem(s):`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`Catalog OK: ${EXERCISES.length} exercises.`)
if (dryRun) process.exit(0)

nextEnv.loadEnvConfig(process.cwd())
if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set (expected in .env.local).')
  process.exit(1)
}

await mongoose.connect(process.env.MONGODB_URI)
try {
  await Exercise.syncIndexes()
  const ops = EXERCISES.map(({ id, ...fields }) => ({
    updateOne: { filter: { slug: id }, update: { $set: { slug: id, ...fields } }, upsert: true },
  }))
  const result = await Exercise.bulkWrite(ops, { ordered: false })
  console.log(`Upserted: ${result.upsertedCount} new, ${result.modifiedCount} updated, ${EXERCISES.length - result.upsertedCount - result.modifiedCount} unchanged.`)

  const slugs = EXERCISES.map(ex => ex.id)
  const stale = await Exercise.countDocuments({ slug: { $nin: slugs } })
  if (stale && prune) {
    const { deletedCount } = await Exercise.deleteMany({ slug: { $nin: slugs } })
    console.log(`Pruned ${deletedCount} exercise(s) no longer in the catalog.`)
  } else if (stale) {
    console.log(`${stale} exercise(s) in the DB are no longer in the catalog. Run with --prune to delete them.`)
  }
} finally {
  await mongoose.disconnect()
}
