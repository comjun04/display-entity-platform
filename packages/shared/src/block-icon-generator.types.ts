export type BlockIconGeneratorConfig = {
  targetGameVersion: string
  items: Record<
    string,
    {
      kind: 'block' | 'item'
      defaultBlockstates: Record<string, string>
    }
  >
}
