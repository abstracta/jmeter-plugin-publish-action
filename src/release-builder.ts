import { Arguments } from './args.js'
import path from 'path'
import { readdir, readFile } from 'fs/promises'
import type { Plugin, PluginVersion } from './jmeter-plugins.d.js'
import type { Asset } from './github.js'

declare type ArtifactInfo = {
  artifactName: string
  version: string
}

export class ReleaseBuilder {
  PLUGINS_REPOSITORY_FILE_PATH = 'jmeter-plugins/site/dat/repo/'
  args: Arguments
  assets: Asset[]

  constructor(args: Arguments, assets: Asset[]) {
    this.args = args
    this.assets = assets
  }

  async build(): Promise<PluginVersion> {
    return {
      changes: `${this.args.changes}`,
      downloadUrl: this.getPluginDownloadUrl(),
      libs: this.buildLibs(),
      depends: await this.buildDependsOn(),
    }
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
    this.assets
      .filter(asset => !asset.name.startsWith(this.args.pluginArtifactName))
      .filter(
        asset =>
          !this.args.ignoreDependencies.some(ignore => ignore && asset.name.startsWith(ignore))
      )
      .forEach(asset => {
        const { libKey, url } = this.buildLibKeyAndUrl(asset)
        libs[libKey] = url
      })
    return libs
  }

  private buildLibKeyAndUrl(asset: Asset): { libKey: string; url: string } {
    const artifactInfo: ArtifactInfo = ReleaseBuilder.extractArtifactAndVersion(
      asset.name,
      this.args.versionPatterns
    )
    const libKey = `${artifactInfo.artifactName}>=${artifactInfo.version}`
    const url: string = asset.browser_download_url
    return { libKey, url }
  }

  private static extractArtifactAndVersion(name: string, regexes: string[]): ArtifactInfo {
    const baseName = this.stripJarExtension(name)

    for (const pattern of regexes) {
      const version = this.extractVersion(baseName, pattern)
      if (version && baseName.includes(version)) {
        const artifactName = this.inferArtifactName(baseName, version)
        return { artifactName, version }
      }
    }

    return this.fallbackExtraction(baseName)
  }

  private static stripJarExtension(name: string): string {
    return name.endsWith('.jar') ? name.slice(0, -4) : name
  }

  private static extractVersion(baseName: string, pattern: string): string | undefined {
    const regex = new RegExp(pattern)
    const match = regex.exec(baseName)
    return match?.[1]
  }

  private static inferArtifactName(baseName: string, version: string): string {
    const versionIndex = baseName.indexOf(version)

    const before = baseName.slice(0, versionIndex)
    const after = baseName.slice(versionIndex + version.length)

    return (before + after).replace(/[-_.]+$/, '').replace(/^[-_.]+/, '')
  }

  private static fallbackExtraction(baseName: string): ArtifactInfo {
    const parts = baseName.split('-')
    const version = parts.pop() ?? ''
    const artifactName = parts.join('-')
    return { artifactName, version }
  }

  async findFilePluginRepository(): Promise<string> {
    const files = await readdir(this.PLUGINS_REPOSITORY_FILE_PATH)

    for (const file of files) {
      const fullPath = path.join(this.PLUGINS_REPOSITORY_FILE_PATH, file)
      if (fullPath.endsWith('.json')) {
        const jsonData: Plugin[] = await ReleaseBuilder.readPluginsFromFile(fullPath)
        const found = jsonData.some(plugin => plugin.id === this.args.pluginID)
        if (found) {
          return fullPath
        }
      }
    }
    throw Error(`Plugin ID=${this.args.pluginID} not found in any of [${files.join(',')}]`)
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
    const jsonData: Plugin[] = await ReleaseBuilder.readPluginsFromFile(jsonRepoFile)
    const plugin: Plugin | undefined = jsonData.find(plugin => plugin.id === this.args.pluginID)
    if (!plugin) {
      throw Error(`Plugin ID=${this.args.pluginID} not found in ${jsonRepoFile}`)
    }
    const versions: [string, PluginVersion][] = Object.entries(plugin.versions)
    const latestVersion: PluginVersion = versions[versions.length - 1][1]
    return latestVersion.depends ? latestVersion.depends : []
  }
}
