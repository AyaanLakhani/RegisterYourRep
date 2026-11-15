// scripts/node-loader.mjs
// Lets plain `node` run scripts that import the app's lib/ code, which is
// written for Next.js: `@/` paths and imports without a file extension.
// Usage: node --import ./scripts/register-loader.mjs scripts/<script>.mjs
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXTENSIONS = ['.js', '.mjs', '.jsx', '/index.js']

function withExtension(filePath) {
  if (existsSync(filePath) && statSync(filePath).isFile()) return filePath
  for (const ext of EXTENSIONS) {
    if (existsSync(filePath + ext)) return filePath + ext
  }
  return null
}

export async function resolve(specifier, context, nextResolve) {
  let target = null
  if (specifier.startsWith('@/')) {
    target = withExtension(path.join(ROOT, specifier.slice(2)))
  } else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL))
    if (!path.extname(specifier)) target = withExtension(path.resolve(parentDir, specifier))
  }
  if (target) return nextResolve(pathToFileURL(target).href, context)
  return nextResolve(specifier, context)
}
