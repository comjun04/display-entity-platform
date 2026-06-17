declare module 'mojangson' {
  type ListifyValue<T extends Exclude<MojangsonNode, MojangsonList>> = {
    [key in keyof T]: key extends 'value' ? T[key][] : T[key]
  }

  type ListValue = boolean | number | string | MojangsonCompound | ListItem[]
  type ListItem = {
    type: 'boolean' | 'int' | 'double' | 'string' | 'list' | 'compound'
    value: ListValue[]
  }

  interface MojangsonCompound {
    type: 'compound'
    value: Record<string, MojangsonNode>
  }
  interface MojangsonString {
    type: 'string'
    value: string
  }
  interface MojangsonNumber {
    type: 'byte' | 'short' | 'int' | 'double'
    value: number
  }
  interface MojangsonList {
    type: 'list'
    value: ListItem
  }

  type MojangsonNode =
    | MojangsonCompound
    | MojangsonString
    | MojangsonNumber
    | MojangsonList

  export function parse(text: string): MojangsonNode | undefined
  export function stringify(data: MojangsonNode): string
  export function simplify(data: MojangsonNode): MojangsonNode
  export function normalize(str: string): string
}
