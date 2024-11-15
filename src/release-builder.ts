import { Arguments } from './args.ts'
import path from 'path'
import { readdir, readFile } from 'fs/promises'
import type { Plugin, PluginVersion } from './jmeter-plugins.d.ts'
import type { Asset } from './github.ts'

export class ReleaseBuilder {
  PLUGINS_REPOSITORY_FILE_PATH = 'jmeter-plugins/site/dat/repo/'
  args: Arguments
  assets: Asset[]
  constructor(args: Arguments, assets: Asset[]) {
    this.args = args
    this.assets = assets
  }

  async build(): Promise<PluginVersion> {
    const newPluginVersion: PluginVersion = {
      changes: `${this.args.changes}`,
      downloadUrl: this.getPluginDownloadUrl(),
      libs: this.buildLibs(),
      depends: await this.buildDependsOn()
    }
    return newPluginVersion
  }

  private getPluginDownloadUrl(): string {
    const pluginAsset: Asset | undefined = this.assets.find(asset =>
      asset.name.startsWith(this.args.pluginArtifactName)
    )
    if (!pluginAsset) {
      throw Error(
        `No plugin artifact found in latest github release assets by prefix [${this.args.pluginArtifactName}]`
      )
    }

    return pluginAsset.browser_download_url
  }

  private buildLibs(): Record<string, string> {
    const libs: Record<string, string> = {}
    this.assets.forEach(asset => {
      if (
        !asset.name.startsWith(this.args.pluginArtifactName) &&
        !this.args.ingoreDependencies.some(ignore =>
          asset.name.startsWith(ignore)
        )
      ) {
        const { libKey, url } = this.buildLibKeyAndUrl(asset)
        libs[libKey] = url
      }
    })
    return libs
  }

  private buildLibKeyAndUrl(asset: Asset): { libKey: string; url: string } {
    const { artifactName, version } = ReleaseBuilder.dissectArtifactName(
      asset.name
    )
    const libKey = `${artifactName}>=${version}`
    const url: string = asset.browser_download_url
    return { libKey, url }
  }

  private static dissectArtifactName(name: string): {
    artifactName: string
    version: string
  } {
    const baseName = name.endsWith('.jar') ? name.slice(0, -4) : name
    const parts = baseName.split('-')
    const version = parts.pop()
    const artifactName = parts.join('-')

    if (artifactName && version) {
      return { artifactName, version }
    } else {
      throw Error(`Not possible to extract version and name from ${name}`)
    }
  }

  async findFilePluginRepository(): Promise<string> {
    const files = await readdir(this.PLUGINS_REPOSITORY_FILE_PATH)

    for (const file of files) {
      const fullPath = path.join(this.PLUGINS_REPOSITORY_FILE_PATH, file)
      if (fullPath.endsWith('.json')) {
        const jsonData: Plugin[] =
          await ReleaseBuilder.readPluginsFromFile(fullPath)
        const found = jsonData.some(plugin => plugin.id === this.args.pluginID)
        if (found) {
          return fullPath
        }
      }
    }
    throw Error(
      `Plugin ID=${this.args.pluginID} not found in any of [${files.join(',')}]`
    )
  }

  static async readPluginsFromFile(fileName: string): Promise<Plugin[]> {
    try {
      const fileContents = await readFile(fileName, 'utf-8')
      const jsonData: Plugin[] = JSON.parse(fileContents) as Plugin[]
      return jsonData
    } catch {
      throw Error(`IO Error, not possible to read content of [${fileName}]`)
    }
  }

  async buildDependsOn(): Promise<string[]> {
    const jsonRepoFile: string = await this.findFilePluginRepository()
    const jsonData: Plugin[] =
      await ReleaseBuilder.readPluginsFromFile(jsonRepoFile)
    const plugin: Plugin | undefined = jsonData.find(
      plugin => plugin.id === this.args.pluginID
    )
    if (!plugin) {
      throw Error(
        `Plugin ID=${this.args.pluginID} not found in ${jsonRepoFile}`
      )
    }
    const versions: [string, PluginVersion][] = Object.entries(plugin.versions)
    const latestVersion: PluginVersion = versions[versions.length - 1][1]
    return latestVersion.depends ? latestVersion.depends : []
  }
}
