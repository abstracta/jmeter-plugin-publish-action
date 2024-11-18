import { getInput } from '@actions/core'

export class Arguments {
  forkedRepository: string
  pluginArtifactName: string
  pluginID: string
  filePath: string
  jmeterPluginsRepository: string
  githubToken: string
  changes: string
  ingoreDependencies: string[]
  constructor() {
    this.forkedRepository = this.getValidatedInput('FORKED-REPOSITORY')
    this.pluginArtifactName = this.getValidatedInput('PLUGIN-ARTIFACT-NAME')
    this.pluginID = this.getValidatedInput('PLUGIN-ID')
    this.filePath = this.getValidatedInput('REPO-FILE-PATH')
    this.jmeterPluginsRepository = this.getInputOrDefault(
      'JMETER-PLUGINS-REPOSITORY',
      //Added default value since locally seems to not take the defaul value
      //defined in action.yaml
      'https://github.com/undera/jmeter-plugins.git'
    )
    this.changes = this.getValidatedInput('CHANGES')
    this.ingoreDependencies = getInput('IGNORE-DEPENDENCIES').split(',')
    this.githubToken = this.getGithubToken()
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
    const githubToken: string | undefined = process.env.GITHUB_TOKEN
    if (githubToken) {
      return githubToken
    }
    throw Error('GITHUB_TOKEN is not available in the environment')
  }
}