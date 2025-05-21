import { getInput } from '@actions/core'

export class Arguments {
  forkedRepository: string
  pluginArtifactName: string
  pluginID: string
  upstreamRepository: string
  githubToken: string
  changes: string
  ignoreDependencies: string[]
  versionPatterns: string[]

  constructor() {
    this.forkedRepository = this.getValidatedInput('forked-repository')
    this.pluginArtifactName = this.getValidatedInput('plugin-artifact-name')
    this.pluginID = this.getValidatedInput('plugin-id')
    this.upstreamRepository = this.getInputOrDefault(
      'upstream-repository',
      //Added default value since locally seems to not take the default value
      //defined in action.yaml
      'https://github.com/undera/jmeter-plugins.git'
    )
    this.changes = this.getValidatedInput('changes')
    this.ignoreDependencies = getInput('ignore-dependencies').split(',')
    this.githubToken = this.getGithubToken()
    this.versionPatterns = getInput('artifact-version-extraction-patterns').split('\n')
  }

  private getValidatedInput(input: string): string {
    const value: string = getInput(input)
    if (value == '') {
      throw Error(`${input} is not set in the environment or empty`)
    }
    return value
  }

  private getInputOrDefault(input: string, defaultValue: string): string {
    const value: string = getInput(input)
    return value == '' ? defaultValue : value
  }

  private getGithubToken(): string {
    const githubToken = process.env.GITHUB_TOKEN || getInput('token')

    if (!githubToken) {
      throw new Error(
        'GITHUB_TOKEN is not available. Please set it as an environment variable or provide it via the input "token".'
      )
    }

    return githubToken
  }
}
