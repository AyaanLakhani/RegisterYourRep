// scripts/register-loader.mjs — see node-loader.mjs
import { register } from 'node:module'

register('./node-loader.mjs', import.meta.url)
