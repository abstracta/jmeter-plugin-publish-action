/* eslint-disable no-extra-semi */
import { Arguments } from '../src/args.js'
import * as core from '@actions/core'

jest.mock('@actions/core')

describe('Arguments', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv }
    jest.resetAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should initialize with valid inputs', () => {
    ;(core.getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'forked-repository':
          return 'fork/repo'
        case 'plugin-artifact-name':
          return 'artifact'
        case 'plugin-id':
          return 'plugin-123'
        case 'upstream-repository':
          return 'upstream/repo'
        case 'changes':
          return 'some changes'
        case 'ignore-dependencies':
          return 'dep1,dep2'
        case 'token':
          return 'github-token'
        default:
          return ''
      }
    })

    const args: Arguments = new Arguments()

    expect(args.forkedRepository).toBe('fork/repo')
    expect(args.pluginArtifactName).toBe('artifact')
    expect(args.pluginID).toBe('plugin-123')
    expect(args.upstreamRepository).toBe('upstream/repo')
    expect(args.changes).toBe('some changes')
    expect(args.ignoreDependencies).toEqual(['dep1', 'dep2'])
    expect(args.githubToken).toBe('github-token')
  })

  it('should use default upstream repository if not provided', () => {
    ;(core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'upstream-repository') return ''
      return 'dummy'
    })

    const args = new Arguments()

    expect(args.upstreamRepository).toBe('https://github.com/undera/jmeter-plugins.git')
  })

  it('should throw error for missing required inputs', () => {
    ;(core.getInput as jest.Mock).mockReturnValue('')

    expect(() => new Arguments()).toThrow(
      'forked-repository is not set in the environment or empty'
    )
  })

  it('should use GITHUB_TOKEN from environment if available', () => {
    process.env.GITHUB_TOKEN = 'env-github-token'
    ;(core.getInput as jest.Mock).mockReturnValue('dummy')

    const args = new Arguments()

    expect(args.githubToken).toBe('env-github-token')
  })

  it('should throw error if no GitHub token is available', () => {
    delete process.env.GITHUB_TOKEN
    ;(core.getInput as jest.Mock).mockImplementation((name: string) => {
      if (name === 'token') return ''
      return 'dummy'
    })

    expect(() => new Arguments()).toThrow('GITHUB_TOKEN is not available')
  })
})
