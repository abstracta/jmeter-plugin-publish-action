import { Octokit } from '@octokit/rest'
import { components } from '@octokit/openapi-types'
import { extractOwnerAndRepo } from './git.js'

type LatestRelease = components['schemas']['release']
export type Asset = components['schemas']['release-asset']

type CreatePullRequestResponse = components['schemas']['pull-request']
export class GithubService {
  octokit: Octokit
  latestRelease: LatestRelease | undefined

  constructor(githubToken: string) {
    this.octokit = new Octokit({ auth: githubToken })
  }

  static async getInstance(githubToken: string): Promise<GithubService> {
    const service: GithubService = new GithubService(githubToken)
    service.latestRelease = await service.getLatestRelease()
    return service
  }

  async getLatestRelease(): Promise<LatestRelease> {
    const pluginRepository: string = GithubService.getCurrentPluginRepository()
    const owner: string = pluginRepository.split('/')[0]
    const repository: string = pluginRepository.split('/')[1]

    const response = await this.octokit.request('GET /repos/{owner}/{repo}/releases/latest', {
      owner: owner,
      repo: repository,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    const latestRelease: LatestRelease = response.data
    return latestRelease
  }

  private static getCurrentPluginRepository(): string {
    const pluginRepository: string | undefined =
      process.env.TEST_GITHUB_REPOSITORY || process.env.GITHUB_REPOSITORY
    if (pluginRepository) {
      return pluginRepository
    }
    throw Error('GITHUB_REPOSITORY enviroment variable not found')
  }

  getReleaseVersion(): string {
    if (!this.latestRelease) {
      throw Error("Latest release wasn't fetched properly")
    }
    //tags usally come like v3.1, we need only a numeric value
    const prefixTagArray: string[] = this.latestRelease.tag_name.split('v')
    return prefixTagArray.length > 1 ? prefixTagArray[1] : prefixTagArray[0]
  }

  getAssets(): Asset[] {
    if (!this.latestRelease) {
      throw Error("Latest release wasn't fetched properly")
    }
    return this.latestRelease.assets
  }

  async openPullRequest(
    upstreamUrl: string,
    forkedUrl: string,
    releaseBranch: string
  ): Promise<string> {
    const upstream = GithubService.getOwnerRepoFromUrl(upstreamUrl)
    const forked = GithubService.getOwnerRepoFromUrl(forkedUrl)
    const title = `${GithubService.getCurrentPluginRepository()} release v${this.getReleaseVersion()}`
    const releaseNotes = `${this.latestRelease?.body}`
    const response = await this.octokit.request('POST /repos/{owner}/{repo}/pulls', {
      owner: `${upstream.owner}`,
      repo: `${upstream.repo}`,
      title: `${title}`,
      body: `${releaseNotes}`,
      head: `${forked.owner}:${releaseBranch}`,
      base: 'master',
      draft: true,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    const pr: CreatePullRequestResponse = response.data
    if (pr?.url) {
      return response.url
    }
    throw Error("Seems that the PR couldn't be created sucessfully")
  }

  private static getOwnerRepoFromUrl(url: string): {
    owner: string
    repo: string
  } {
    try {
      const [owner, repo] = extractOwnerAndRepo(url).split('/')
      return { owner, repo }
    } catch {
      throw new Error(`Url [${url}] does not match the format Eg: https://github/example/repo.git`)
    }
  }
}
