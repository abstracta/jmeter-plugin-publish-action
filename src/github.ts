import { Octokit } from '@octokit/rest'
import { components } from '@octokit/openapi-types'

type LatestRelease = components['schemas']['release']
export type Asset = components['schemas']['release-asset']

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

    const response = await this.octokit.request(
      'GET /repos/{owner}/{repo}/releases/latest',
      {
        owner: owner,
        repo: repository,
        headers: {
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )
    const latestRelease: LatestRelease = response.data
    return latestRelease
  }

  private static getCurrentPluginRepository(): string {
    const pluginRepository: string | undefined = process.env.GITHUB_REPOSITORY
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
}
