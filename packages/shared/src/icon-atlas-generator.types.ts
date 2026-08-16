export type IconAtlasGeneratorConfig = {
  targetGameVersion: string
  items: Record<
    string,
    {
      kind: 'block' | 'item'
      defaultBlockstates: Record<string, string>
    }
  >
}

export interface IconAtlasMetadata {
  items: string[]
  iconSize: number
}
