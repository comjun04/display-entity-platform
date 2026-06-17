import mojangson from 'mojangson'

export function validateSNBT(input: string) {
  // If nbt string does not wrapped with curly brackets, wrap it
  // This is necesseary to make it parsable with mojangson
  if (!input.startsWith('{')) input = '{' + input
  if (!input.endsWith('}')) input += '}'

  try {
    const data = mojangson.parse(input)
    if (data == null) {
      return null
    }

    return data
  } catch {
    return null
  }
}
