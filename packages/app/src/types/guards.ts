import type {
  DisplayEntity,
  ItemDisplayEntity,
  PlayerHeadProperties,
} from './base'

// player head type guard
export function isItemDisplayPlayerHead(
  entity: DisplayEntity,
): entity is ItemDisplayEntity & {
  type: 'player_head'
  playerHeadProperties: PlayerHeadProperties
} {
  if (entity.kind !== 'item') return false
  else if (entity.type !== 'player_head') return false
  return true
}
