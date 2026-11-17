import path from 'path'
import fs from 'fs'

// Vercel serverless functions have a read-only filesystem except /tmp.
// Locally, keep writing to the project working directory.
export const writableRoot = process.env.VERCEL ? '/tmp' : process.cwd()

// Create a directory if missing, without throwing on read-only filesystems.
export function ensureDir(dir: string): void {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  } catch {
    // ignore - filesystem may be read-only
  }
}
