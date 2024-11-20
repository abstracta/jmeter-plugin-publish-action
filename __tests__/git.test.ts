/* eslint-disable no-extra-semi */
import { GitService, extractOwnerAndRepo } from '../src/git.js'
import { Arguments } from '../src/args.js'
import { exec } from '@actions/exec'

jest.mock('@actions/exec')
jest.mock('../src/args.js')

describe('GitService', () => {
  let gitService: GitService
  let mockArgs: Arguments

  beforeEach(() => {
    mockArgs = {
      forkedRepository: 'https://github.com/fork/repo.git',
      upstreamRepository: 'https://github.com/upstream/repo.git',
      githubToken: 'mock-token',
      pluginArtifactName: 'test-plugin',
    } as Arguments

    gitService = new GitService(mockArgs)
    ;(exec as jest.Mock).mockResolvedValue(0)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('init', () => {
    it('should initialize the repository', async () => {
      await gitService.init('test-repo')

      expect(exec).toHaveBeenCalledWith('rm', ['-rf', 'test-repo'])
      expect(exec).toHaveBeenCalledWith('git', ['clone', expect.any(String), 'test-repo'])
      expect(exec).toHaveBeenCalledWith('git', [
        '-C',
        './test-repo',
        'config',
        '--local',
        'user.name',
        expect.any(String),
      ])
      expect(exec).toHaveBeenCalledWith('git', [
        '-C',
        'test-repo',
        'config',
        '--local',
        'user.email',
        expect.any(String),
      ])
      expect(exec).toHaveBeenCalledWith('git', [
        '-C',
        './test-repo',
        'remote',
        'set-url',
        'origin',
        expect.any(String),
      ])
      expect(exec).toHaveBeenCalledWith('git', [
        '-C',
        './test-repo',
        'remote',
        'add',
        'upstream',
        expect.any(String),
      ])
    })

    it('should throw error when error checking out', async () => {
      const execMock = exec as jest.Mock
      execMock.mockImplementation((command: string, args: string[]) => {
        if (command === 'git' && args.length == 3 && args[0] == 'clone') {
          throw Error('Error while checkout')
        }
      })
      await expect(gitService.init('test-repo')).rejects.toThrow('Error while checkout')
    })
  })

  describe('checkoutReleaseBranch', () => {
    it('should checkout a new release branch', async () => {
      const branchName = await gitService.checkoutReleaseBranch('1.0.0', 'test-repo')

      expect(branchName).toBe('TEST-PLUGIN-1.0.0')
      expect(exec).toHaveBeenCalledWith('git', [
        '-C',
        './test-repo',
        'checkout',
        '-b',
        'TEST-PLUGIN-1.0.0',
      ])
      expect(exec).toHaveBeenCalledWith('git', ['-C', './test-repo', 'fetch', 'upstream'])
      expect(exec).toHaveBeenCalledWith('git', [
        '-C',
        './test-repo',
        'merge',
        'upstream/master',
        '--allow-unrelated-histories',
      ])
    })

    it('should throw an error if checkout fails', async () => {
      ;(exec as jest.Mock).mockRejectedValueOnce(new Error('Git checkout failed'))

      await expect(gitService.checkoutReleaseBranch('1.0.0', 'test-repo')).rejects.toThrow(
        'There was an issue while checking out new branch'
      )
    })
    it('should throw error and abort merge when error update from upstream', async () => {
      const execMock = exec as jest.Mock
      execMock.mockImplementation((command: string, args: string[]) => {
        if (command === 'git' && args.length == 4 && args.some(arg => arg === 'fetch')) {
          throw Error('')
        }
      })
      await expect(gitService.checkoutReleaseBranch('1.0.0', 'test-repo')).rejects.toThrow(
        'Problem while updating release branch with latest upstream changes'
      )
      expect(exec).toHaveBeenCalledWith('git', ['merge', '--abort'])
    })
  })

  describe('commitChanges', () => {
    it('should commit changes', async () => {
      await gitService.commitChanges('1.0.0', 'test-repo')

      expect(exec).toHaveBeenCalledWith('git', ['-C', './test-repo', 'add', '.'])
      expect(exec).toHaveBeenCalledWith('git', [
        '-C',
        './test-repo',
        'commit',
        '-m',
        expect.stringContaining('v1.0.0 release'),
      ])
    })

    it('should throw an error if commit fails', async () => {
      ;(exec as jest.Mock).mockRejectedValueOnce(new Error('Git commit failed'))

      await expect(gitService.commitChanges('1.0.0', 'test-repo')).rejects.toThrow(
        'There was an issue while stagging and commiting changes'
      )
    })
  })

  describe('pushChanges', () => {
    it('should push changes', async () => {
      await gitService.pushChanges('test-branch', 'test-repo')

      expect(exec).toHaveBeenCalledWith('git', [
        '-C',
        'test-repo',
        'push',
        'origin',
        '-u',
        'test-branch',
      ])
    })

    it('should throw an error if push fails', async () => {
      ;(exec as jest.Mock).mockRejectedValueOnce(new Error('Git push failed'))

      await expect(gitService.pushChanges('test-branch', 'test-repo')).rejects.toThrow(
        'There was a problem while pushing changes'
      )
    })
  })
})

describe('extractOwnerAndRepo', () => {
  it('should extract owner and repo from a valid GitHub URL', () => {
    const result = extractOwnerAndRepo('https://github.com/owner/repo.git')
    expect(result).toBe('owner/repo')
  })

  it('should throw an error for an invalid GitHub URL', () => {
    expect(() => extractOwnerAndRepo('https://invalid-url.com')).toThrow(
      'Not possible to extract owner and repostory name'
    )
  })
})
