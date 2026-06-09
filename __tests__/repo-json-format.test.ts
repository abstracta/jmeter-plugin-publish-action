import { exec } from '@actions/exec'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { canonicalJson, formatRepoJsonFile } from '../src/repo-json-format.js'

jest.mock('@actions/exec')

const fixtureJson = `[
  {
    "id": "test-plugin",
    "name": "Test Plugin",
    "versions": {
      "1.0": {
        "downloadUrl": "https://example.com/test-1.0.jar"
      }
    }
  }
]`

describe('repo-json-format', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('canonicalJson', () => {
    it('should append a trailing newline', () => {
      const formatted = canonicalJson(fixtureJson)
      expect(formatted.endsWith('\n')).toBe(true)
    })

    it('should produce valid JSON', () => {
      const formatted = canonicalJson(fixtureJson)
      expect(() => JSON.parse(formatted)).not.toThrow()
    })

    it('should be idempotent', () => {
      const once = canonicalJson(fixtureJson)
      const twice = canonicalJson(once)
      expect(twice).toBe(once)
    })
  })

  describe('formatRepoJsonFile', () => {
    let tempDir: string
    let repositoryName: string
    let releaseFile: string

    beforeEach(() => {
      tempDir = mkdtempSync(path.join(tmpdir(), 'repo-json-format-'))
      repositoryName = path.join(tempDir, 'jmeter-plugins')
      releaseFile = path.join(repositoryName, 'site/dat/repo/test.json')
      mkdirSync(path.dirname(releaseFile), { recursive: true })
      writeFileSync(releaseFile, JSON.stringify(JSON.parse(fixtureJson), null, 2), 'utf-8')
      ;(exec as jest.Mock).mockResolvedValue(0)
    })

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true })
    })

    it('should run format_repo.py when the script exists', async () => {
      writeFileSync(path.join(repositoryName, 'format_repo.py'), '#!/usr/bin/env python3\n')

      await formatRepoJsonFile(repositoryName, releaseFile)

      expect(exec).toHaveBeenCalledWith(
        'python3',
        ['format_repo.py', 'site/dat/repo/test.json'],
        { cwd: repositoryName }
      )
    })

    it('should use canonical fallback when format_repo.py is missing', async () => {
      await formatRepoJsonFile(repositoryName, releaseFile)

      expect(exec).not.toHaveBeenCalled()
      const content = readFileSync(releaseFile, 'utf-8')
      expect(content).toBe(canonicalJson(fixtureJson))
    })

    it('should throw when format_repo.py fails', async () => {
      writeFileSync(path.join(repositoryName, 'format_repo.py'), '#!/usr/bin/env python3\n')
      ;(exec as jest.Mock).mockRejectedValue(new Error('python not found'))

      await expect(formatRepoJsonFile(repositoryName, releaseFile)).rejects.toThrow(
        'Failed to format repo JSON with format_repo.py: python not found'
      )
    })
  })

  describe('formatRepoJsonFile integration', () => {
    const formatRepoPy = `#!/usr/bin/env python3
import json
import sys

def canonical(text):
    return json.dumps(json.loads(text), indent=2, ensure_ascii=False) + "\\n"

def format_file(path):
    with open(path) as f:
        raw = f.read()
    formatted = canonical(raw)
    if raw != formatted:
        with open(path, "w") as f:
            f.write(formatted)

if __name__ == "__main__":
    for path in sys.argv[1:]:
        format_file(path)
`

    const pythonAvailable = (() => {
      try {
        const { execSync } = require('child_process')
        execSync('python3 --version', { stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    })()

    const itIfPython = pythonAvailable ? it : it.skip

    itIfPython('should match python3 format_repo.py output', async () => {
      const tempDir = mkdtempSync(path.join(tmpdir(), 'repo-json-format-integration-'))
      const repositoryName = path.join(tempDir, 'jmeter-plugins')
      const releaseFile = path.join(repositoryName, 'site/dat/repo/test.json')

      try {
        mkdirSync(path.dirname(releaseFile), { recursive: true })
        writeFileSync(releaseFile, JSON.stringify(JSON.parse(fixtureJson), null, 2), 'utf-8')
        writeFileSync(path.join(repositoryName, 'format_repo.py'), formatRepoPy)

        await formatRepoJsonFile(repositoryName, releaseFile)

        const formattedByAction = readFileSync(releaseFile, 'utf-8')
        writeFileSync(releaseFile, JSON.stringify(JSON.parse(fixtureJson), null, 2), 'utf-8')
        await exec('python3', ['format_repo.py', 'site/dat/repo/test.json'], {
          cwd: repositoryName,
        })
        const formattedByPython = readFileSync(releaseFile, 'utf-8')

        expect(formattedByAction).toBe(formattedByPython)
      } finally {
        rmSync(tempDir, { recursive: true, force: true })
      }
    })
  })
})
