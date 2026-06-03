# Save file format changelog

### Version `7`

- Add `nbt` field in `BaseDisplayEntity`
  - Every display entity now has `nbt` field
- Add `mainNBT` field to save data root
  - This nbt field is used for root group entity nbt

### Version `6`

- Breaking change to `playerHeadProperties.texture` property if entity kind `item`
  - Add unbaked texture data as data url to `texture.paintTexture` (only exist when `texture.baked` === `false`)
  - Now `texture` must be null if neither baked or unbaked texture exist (previous versions set `texture.baked` to `false` on this case)

### Version `5`

- Add `name` in `DisplayEntityGroup` (group name)

### Version `4`

- Add `projectName` root field

### Version `3`

- Add `targetGameVersion` root field
  - Indicates which Minecraft version this project is targetting at (used for block/item list, feature flags etc)
  - older projects which does not have this field will use `1.21`

### Version `2`

- Add `playerHeadProperties` field in `ItemDisplay`
  - This field is only present if entity.type is `player_head`

```ts
interface PlayerHeadProperties {
  texture:
    | {
        baked: true
        url: string
      }
    | {
        baked: false
      }
    | null
}
```

### Version `1`

- Add text display data

### Version `0` (v1.0.0+)

- Initial version
- Add block display, item display and group data
