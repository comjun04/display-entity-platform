import { createWriteStream, existsSync } from 'fs'
import { cp, lstat, mkdir, readdir, readFile, writeFile } from 'fs/promises'
import {
  join as pathJoin,
  resolve as pathResolve,
  dirname,
  basename,
} from 'path'
import { Open } from 'unzipper'
import { rimraf } from 'rimraf'
import { sync as spawnSync } from 'cross-spawn'
import {
  BlockStatesFile,
  ModelFile,
  ServerJarGeneratedRegistryData,
} from './types'
import { VersionMetadata } from '@depl/shared'
import {
  blockstatesDefaultValues,
  renderableBlockEntityModelTextures,
} from './constants'
import { downloadAssets, downloadSharedAssets } from './cdn'

// =====

const args = process.argv
const mcVersion = args[2]

const workdirFolderRootPath = pathJoin(pathResolve(), 'workdir')
const workdirFolderPath = pathJoin(workdirFolderRootPath, mcVersion)
const workdirFolderSharedAssetsPath = pathJoin(workdirFolderRootPath, 'shared')
const outputFolderRootPath = pathJoin(pathResolve(), 'output')
const outputFolderPath = pathJoin(outputFolderRootPath, mcVersion)
const outputFolderSharedAssetsPath = pathJoin(outputFolderRootPath, 'shared')
const assetsMinecraftFolderPath = pathJoin(
  outputFolderPath,
  'assets',
  'minecraft',
)

// workdir 폴더 미리 생성
if (!existsSync(workdirFolderRootPath)) {
  await mkdir(workdirFolderRootPath)
}

// 버전 이름 폴더가 이미 있는지 확인
if (
  !existsSync(workdirFolderPath) ||
  !(await lstat(workdirFolderPath)).isDirectory()
) {
  console.log(`workdir/${mcVersion} folder does not exist. Creating a new one.`)
  await mkdir(workdirFolderPath, { recursive: true })
}
if (
  !existsSync(workdirFolderSharedAssetsPath) ||
  !(await lstat(workdirFolderSharedAssetsPath)).isDirectory()
) {
  console.log('workdir/shared folder does not exist. Creating a new one.')
  await mkdir(workdirFolderSharedAssetsPath, { recursive: true })
}

if (
  !existsSync(outputFolderPath) ||
  !(await lstat(outputFolderPath)).isDirectory()
) {
  console.log(`output/${mcVersion} folder does not exist. Creating a new one.`)
  await mkdir(outputFolderPath, { recursive: true })
} else if ((await readdir(outputFolderPath)).length > 0) {
  console.error(
    `The folder output/${mcVersion} folder is not empty. Specify a different version name or empty the folder and rerun the command.`,
  )
  process.exit(1)
}
if (
  !existsSync(outputFolderSharedAssetsPath) ||
  !(await lstat(outputFolderSharedAssetsPath)).isDirectory()
) {
  console.log('output/shared folder does not exist. Creating a new one.')
  await mkdir(outputFolderSharedAssetsPath, { recursive: true })
}

console.log('Cleaning up previous server jar reports files')
await cleanupWorkdir(mcVersion)

const versionData = await downloadAssets(mcVersion, workdirFolderPath)

const jarfileAbsolutePath = pathJoin(workdirFolderPath, 'client.jar')
const zip = await Open.file(jarfileAbsolutePath)

console.log('Extracting version asset files...')

const filesToExtract = zip.files.filter(
  (f) =>
    /^assets\/minecraft\/(blockstates|models|font|textures\/(block|colormap|entity\/player|font|item))\//.test(
      f.path,
    ) || renderableBlockEntityModelTextures.includes(f.path),
)
for await (const file of filesToExtract) {
  const dirPath = file.path.split('/').slice(0, -1).join('/')
  await mkdir(pathJoin(outputFolderPath, dirPath), { recursive: true })

  await new Promise((resolve, reject) => {
    file
      .stream()
      .pipe(createWriteStream(pathJoin(outputFolderPath, file.path)))
      .on('finish', resolve)
      .on('error', reject)
  })
}

// chest, shulker_box 등 엔티티 모델로 렌더링되는 블록들은 원래는 model .json파일에 element가 없어 렌더링 가능한 블록으로 인식되지 않는데,
// 이를 렌더링 가능한 블록으로 인식시키기 위해 따로 만든 파일들을 복사해서 지정된 폴더에 붙여넣기
console.log('Copying data in hardcoded folder to destination folder...')
await cp(pathJoin(pathResolve(), 'hardcoded'), assetsMinecraftFolderPath, {
  recursive: true,
})

// generate server resource reports file to get blocks.json and items.json
console.log('Generating server.jar resource reports...')
const serverJarfilePath = pathJoin(workdirFolderPath, 'server.jar')
const spawnResult = spawnSync(
  'java',
  [
    '-DbundlerMainClass=net.minecraft.data.Main',
    '-jar',
    serverJarfilePath,
    '--reports',
  ],
  {
    cwd: workdirFolderPath,
  },
)
if (spawnResult.status !== 0) {
  throw new Error(
    `server.jar resource report generation failed with error: ${spawnResult.stderr}`,
  )
}

const reportsPath = pathJoin(workdirFolderPath, 'generated', 'reports')

// blocks.json
console.log('Generating blocks list')

const generatedBlocksJson = JSON.parse(
  await readFile(pathJoin(reportsPath, 'blocks.json'), 'utf8'),
)

// TODO: chest, shulker_box 등 엔티티 모델로 렌더링되는 블록들은 모델 .json에 `elements`가 있는지 여부로 알 수 없음.
// 이 모델들은 하드코딩되어있기 때문에 별도로 처리해줘야 함
// https://minecraft.fandom.com/wiki/Model#Objects_which_cannot_be_remodelled
const renderableBlocks: string[] = []
for await (const blockNameWithPrefix of [...Object.keys(generatedBlocksJson)]) {
  const blockName = stripMinecraftPrefix(blockNameWithPrefix)
  const blockstateFile = JSON.parse(
    await readFile(
      pathJoin(assetsMinecraftFolderPath, 'blockstates', `${blockName}.json`),
      'utf8',
    ),
  ) as BlockStatesFile

  let canRender: boolean = false
  if ('variants' in blockstateFile) {
    for (const key in blockstateFile.variants) {
      const variantData = blockstateFile.variants[key]
      if (Array.isArray(variantData)) {
        for (const variantDataItem of variantData) {
          canRender = await canRenderToBlockDisplay(variantDataItem.model)
          if (canRender) break
        }
      } else {
        canRender = await canRenderToBlockDisplay(variantData.model)
      }

      if (canRender) break
    }
  } else if ('multipart' in blockstateFile) {
    for (const multipartItem of blockstateFile.multipart) {
      if (Array.isArray(multipartItem.apply)) {
        for (const multipartApplyItem of multipartItem.apply) {
          canRender = await canRenderToBlockDisplay(multipartApplyItem.model)
          if (canRender) break
        }
      } else {
        canRender = await canRenderToBlockDisplay(multipartItem.apply.model)
      }

      if (canRender) break
    }
  }

  if (canRender) {
    const defaultBlockstateValues = [
      ...Object.entries(blockstatesDefaultValues[blockName] ?? {}),
    ]
    const stringifiedDefaultBlockstateValues =
      defaultBlockstateValues.length > 0
        ? '[' +
          defaultBlockstateValues
            .map(([key, value]) => `${key}=${value}`)
            .join(',') +
          ']'
        : ''

    renderableBlocks.push(blockName + stringifiedDefaultBlockstateValues)
  } else {
    console.log(`[BlockListGen] excluding block ${blockName}`)
  }
}

await writeFile(
  pathJoin(assetsMinecraftFolderPath, 'blocks.json'),
  JSON.stringify({ blocks: renderableBlocks }),
)

// items.json
console.log('Generating items list')

const generatedRegistryJson = JSON.parse(
  await readFile(pathJoin(reportsPath, 'registries.json'), 'utf8'), // items.json does not exist on 1.19.4 ao use registries.json instead
) as ServerJarGeneratedRegistryData
const items = Object.keys(generatedRegistryJson['minecraft:item'].entries)
  .map((k) => k.match(/^minecraft:(.+)$/)![1])
  .filter((i) => i !== 'air')
await writeFile(
  pathJoin(assetsMinecraftFolderPath, 'items.json'),
  JSON.stringify({ items }),
)

// shared assets
const workdirFolderSharedAssetsSubPath = pathJoin(
  workdirFolderSharedAssetsPath,
  versionData.assetIndex.id,
)
const outputFolderSharedAssetsSubPath = pathJoin(
  outputFolderSharedAssetsPath,
  versionData.assetIndex.id,
)

let unifontHexFilePath = ''

const sharedAssets = await downloadSharedAssets(
  versionData.assetIndex,
  workdirFolderRootPath,
)
for (const assetFilePath of sharedAssets) {
  console.log('Copying shared asset file', assetFilePath)
  const assetFileWorkdirAbsolutePath = pathJoin(
    workdirFolderSharedAssetsSubPath,
    assetFilePath,
  )
  const assetFileOutputAbsolutePath = pathJoin(
    outputFolderSharedAssetsSubPath,
    assetFilePath,
  )
  await mkdir(dirname(assetFileOutputAbsolutePath), { recursive: true })
  await cp(assetFileWorkdirAbsolutePath, assetFileOutputAbsolutePath)

  // unifont_all_no_pua_<version>.hex
  if (basename(assetFilePath).startsWith('unifont_all_')) {
    unifontHexFilePath = assetFilePath
  }
}

// write version metadata.json
console.log('Writing metadata.json')
const versionMetadata: VersionMetadata = {
  version: 1,
  incremental: false,
  gameVersion: mcVersion,
  sharedAssets: {
    assetIndex: parseInt(versionData.assetIndex.id),
    unifontHexFilePath,
  },
}
await writeFile(
  pathJoin(outputFolderPath, 'metadata.json'),
  JSON.stringify(versionMetadata),
)

console.log('Done')

// ==========

async function cleanupWorkdir(versionId: string) {
  await rimraf(`./workdir/${versionId}/{generated,libraries,logs,versions}`, {
    glob: true,
  })
}

function stripMinecraftPrefix(input: string) {
  return input.startsWith('minecraft:') ? input.slice(10) : input
}

async function canRenderToBlockDisplay(modelResourceLocation: string) {
  if (modelResourceLocation.startsWith('minecraft:')) {
    modelResourceLocation = modelResourceLocation.slice(10)
  }

  const modelData = JSON.parse(
    await readFile(
      pathJoin(
        assetsMinecraftFolderPath,
        'models',
        `${modelResourceLocation}.json`,
      ),
      'utf8',
    ),
  ) as ModelFile

  // elements object가 존재할 경우 블록 디스플레이로 렌더링할 수 있음. 추가 검색을 중단하고 true 리턴
  if (modelData.elements?.length ?? 0 > 0) {
    return true
  }

  // parent 값이 있을 경우 parent에서도 체크
  if (modelData.parent != null) {
    return await canRenderToBlockDisplay(modelData.parent)
  }

  // console.log(modelResourceLocation, modelData)

  // elements object가 발견되지 않음. 블록 디스플레이로 렌더링할 수 없음
  return false
}
