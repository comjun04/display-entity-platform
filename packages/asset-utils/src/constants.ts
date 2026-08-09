export const colors = [
  'black',
  'blue',
  'brown',
  'cyan',
  'gray',
  'green',
  'light_blue',
  'light_gray',
  'lime',
  'magenta',
  'orange',
  'pink',
  'purple',
  'red',
  'white',
  'yellow',
]

export const blockstatesDefaultValues: Record<
  string,
  Record<string, string>
> = {
  bamboo: { age: '0' },

  glass_pane: {
    north: 'false',
    east: 'false',
    south: 'false',
    west: 'false',
  },

  // stained_glass_pane
  ...colors.reduce(
    (acc, cur) => ({
      ...acc,
      [`${cur}_stained_glass_pane`]: {
        north: 'false',
        east: 'false',
        south: 'false',
        west: 'false',
      },
    }),
    {},
  ),

  // wall blocks
  ...[
    'andesite',
    'blackstone',
    'brick',
    'cobbled_deepslate',
    'cobblestone',
    'deepslate_brick',
    'deepslate_tile',
    'diorite',
    'end_stone_brick',
    'granite',
    'mossy_cobblestone',
    'mossy_stone_brick',
    'mud_brick',
    'nether_brick',
    'polished_blackstone_brick',
    'polished_blackstone',
    'polished_deepslate',
    'polished_tuff',
    'prismarine',
    'red_nether_brick',
    'red_sandstone',
    'sandstone',
    'stone_brick',
    'tuff_brick',
    'tuff',
  ].reduce(
    (acc, cur) => ({
      ...acc,
      [`${cur}_wall`]: { up: 'true' },
    }),
    {},
  ),

  redstone_wire: {
    north: 'none',
    east: 'none',
    south: 'none',
    west: 'none',
  },

  iron_bars: {
    north: 'false',
    east: 'false',
    south: 'false',
    west: 'false',
  },

  fire: {
    up: 'false',
    north: 'true',
    east: 'true',
    south: 'true',
    west: 'true',
  },

  // mushroom block and stem
  brown_mushroom_block: {
    north: 'true',
    east: 'true',
    south: 'true',
    west: 'true',
    up: 'true',
    down: 'true',
  },
  red_mushroom_block: {
    north: 'true',
    east: 'true',
    south: 'true',
    west: 'true',
    up: 'true',
    down: 'true',
  },
  mushroom_stem: {
    north: 'true',
    east: 'true',
    south: 'true',
    west: 'true',
    up: 'true',
    down: 'true',
  },

  chiseled_bookshelf: {
    facing: 'east',
    slot_1_occupied: 'true',
    slot_2_occupied: 'true',
    slot_3_occupied: 'true',
    slot_4_occupied: 'true',
    slot_5_occupied: 'true',
    slot_6_occupied: 'true',
  },
}

export const renderableBlockEntityModelTextures = [
  'chest/normal', // chest
  'chest/trapped', // trapped_chest
  'chest/ender', // ender_chest
  'chest/copper', // copper_chest
  'chest/copper_exposed', // exposed_copper_chest
  'chest/copper_oxidized', // oxidized_copper_chest
  'chest/copper_weathered', // weathered_copper_chest

  'conduit/base', // conduit

  // shulker boxes
  'shulker/shulker',
  'shulker/shulker_black',
  'shulker/shulker_blue',
  'shulker/shulker_brown',
  'shulker/shulker_cyan',
  'shulker/shulker_gray',
  'shulker/shulker_green',
  'shulker/shulker_light_blue',
  'shulker/shulker_light_gray',
  'shulker/shulker_lime',
  'shulker/shulker_magenta',
  'shulker/shulker_orange',
  'shulker/shulker_pink',
  'shulker/shulker_purple',
  'shulker/shulker_red',
  'shulker/shulker_white',
  'shulker/shulker_yellow',

  // beds
  'bed/black',
  'bed/blue',
  'bed/brown',
  'bed/cyan',
  'bed/gray',
  'bed/green',
  'bed/light_blue',
  'bed/light_gray',
  'bed/lime',
  'bed/magenta',
  'bed/orange',
  'bed/pink',
  'bed/purple',
  'bed/red',
  'bed/white',
  'bed/yellow',

  // copper_golem (statue)
  'copper_golem/copper_golem',
  'copper_golem/exposed_copper_golem',
  'copper_golem/weathered_copper_golem',
  'copper_golem/oxidized_copper_golem',
].map(
  (resourceLocation) =>
    `assets/minecraft/textures/entity/${resourceLocation}.png`,
)
