import { exec } from '@actions/exec'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

export function canonicalJson(content: string): string {
  return JSON.stringify(JSON.parse(content), null, 2) + '\n'
}

function toRepoRelativePath(repositoryName: string, releaseFile: string): string {
  const prefix = `${repositoryName}/`
  if (releaseFile.startsWith(prefix)) {
    return releaseFile.slice(prefix.length)
  }
  return releaseFile
}

function formatWithCanonicalFallback(releaseFile: string): void {
  const raw = readFileSync(releaseFile, 'utf-8')
  const formatted = canonicalJson(raw)
  if (raw !== formatted) {
    writeFileSync(releaseFile, formatted, 'utf-8')
  }
}

export async function formatRepoJsonFile(
  repositoryName: string,
  releaseFile: string
): Promise<void> {
  const formatRepoScript = path.join(repositoryName, 'format_repo.py')

  if (!existsSync(formatRepoScript)) {
    formatWithCanonicalFallback(releaseFile)
    return
  }

  const relativePath = toRepoRelativePath(repositoryName, releaseFile)

  try {
    await exec('python3', ['format_repo.py', relativePath], { cwd: repositoryName })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw Error(`Failed to format repo JSON with format_repo.py: ${message}`)
  }
}
