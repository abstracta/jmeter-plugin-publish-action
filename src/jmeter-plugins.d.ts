export declare type Plugin = {
  id: string
  name: string
  description: string
  screenshotUrl: string
  helpUrl: string
  vendor: string
  markerClass: string
  canUninstall: boolean
  installerClass?: string
  componentClasses?: string[]
  versions: Record<string, PluginVersion>
}

export declare type PluginVersion = {
  changes: string
  downloadUrl: string
  libs: Record<string, string>
  depends?: string[]
}
