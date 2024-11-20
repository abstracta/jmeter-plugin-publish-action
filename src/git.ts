import { exec } from '@actions/exec'
import { Arguments } from './args.js'

export class GitService {
  private args: Arguments

  constructor(args: Arguments) {
    this.args = args
  }

  async init(repositoryName: string): Promise<void> {
    await this.checkoutRepository(repositoryName)
    await this.configureGitUser(repositoryName)
    await this.configureGitAuth(repositoryName)
  }

  private async checkoutRepository(directory: string): Promise<void> {
    await this.cleanDirectory(directory)
    const authenticatedRepoUrl: string = GitService.buildTokenAuthenticatedRepoURL(
      this.args.forkedRepository,
      this.args.githubToken
    )

    try {
      await exec('git', ['clone', authenticatedRepoUrl, directory])
    } catch (error) {
      if (error instanceof Error) {
        throw Error(`Failed to checkout repository: ${error}`)
      }
    }
  }

  private async cleanDirectory(directory: string): Promise<void> {
    await exec('rm', ['-rf', directory])
  }

  private async configureGitUser(directory: string): Promise<void> {
    const actor: string = process.env['GITHUB_ACTOR'] || 'jmeter_plugin_deployer'
    await exec('git', ['-C', `./${directory}`, 'config', '--local', 'user.name', actor])
    await exec('git', [
      '-C',
      directory,
      'config',
      '--local',
      'user.email',
      `${actor}@users.noreply.github.com`,
    ])
  }

  private async configureGitAuth(repositoryName: string): Promise<void> {
    const upstreamAuthRepoUrl: string = GitService.buildTokenAuthenticatedRepoURL(
      this.args.upstreamRepository,
      this.args.githubToken
    )
    const forkedAuthRepoUrl: string = GitService.buildTokenAuthenticatedRepoURL(
      this.args.forkedRepository,
      this.args.githubToken
    )

    await exec('git', [
      '-C',
      `./${repositoryName}`,
      'remote',
      'set-url',
      'origin',
      `${forkedAuthRepoUrl}`,
    ])

    await exec('git', [
      '-C',
      `./${repositoryName}`,
      'remote',
      'add',
      'upstream',
      `${upstreamAuthRepoUrl}`,
    ])
  }

  private static buildTokenAuthenticatedRepoURL(url: string, token: string): string {
    const ownerRepo: string = extractOwnerAndRepo(url)
    return `https://${token}@github.com/${ownerRepo}.git`
  }

  async checkoutReleaseBranch(version: string, repositoryName: string): Promise<string> {
    const branchName = this.args.pluginArtifactName.toUpperCase().concat('-', version)
    try {
      await exec('git', ['-C', `./${repositoryName}`, 'checkout', '-b', `${branchName}`])
    } catch (error) {
      if (error instanceof Error) {
        throw Error(
          `There was an issue while checking out new branch ${branchName} in directory ${repositoryName}`,
          error
        )
      }
    }
    await this.updateBranchFromUpstream(repositoryName)
    return branchName
  }

  private async updateBranchFromUpstream(repositoryName: string): Promise<void> {
    try {
      await exec('git', ['-C', `./${repositoryName}`, 'fetch', 'upstream'])
      await exec('git', [
        '-C',
        `./${repositoryName}`,
        'merge',
        'upstream/master',
        '--allow-unrelated-histories',
      ])
    } catch (error) {
      await exec('git', ['merge', '--abort'])
      if (error instanceof Error) {
        throw Error('Problem while updating release branch with latest upstream changes', error)
      }
    }
  }

  async commitChanges(version: string, repositoryName: string): Promise<void> {
    try {
      const pluginName =
        process.env.GITHUB_REPOSITORY?.split('/')[1] || this.args.pluginArtifactName
      const commitMessage = `${pluginName} v${version} release`
      await exec('git', ['-C', `./${repositoryName}`, 'add', '.'])
      await exec('git', ['-C', `./${repositoryName}`, 'commit', '-m', `${commitMessage}`])
    } catch (error) {
      if (error instanceof Error) {
        throw Error(`There was an issue while stagging and commiting changes`, error)
      }
    }
  }

  async pushChanges(branchName: string, REPOSITORY_NAME: string): Promise<void> {
    try {
      await exec('git', ['-C', `${REPOSITORY_NAME}`, 'push', 'origin', '-u', `${branchName}`])
    } catch {
      throw Error(`There was a problem while pushing changes to new branch ${branchName} in origin`)
    }
  }
}

export function extractOwnerAndRepo(repository: string): string {
  const regex = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\.git$/
  const match: RegExpMatchArray | null = repository.match(regex)

  if (match) {
    const owner: string = match[1]
    const repo: string = match[2]
    return `${owner}/${repo}`
  }
  throw new Error(
    `Not possible to extract owner and repostory name from [${repository}]
    Try complying with the format: https://github/owner/repo.git`
  )
}
