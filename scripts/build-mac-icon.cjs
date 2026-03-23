const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const buildDir = path.resolve(__dirname, '..', 'build')
const iconSource = path.resolve(__dirname, '..', 'public', 'favicon.svg')
const iconsetDir = path.join(buildDir, 'icon.iconset')
const iconOutput = path.join(buildDir, 'icon.icns')
const iconPreviewName = `${path.basename(iconSource)}.png`

const iconSizes = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
]

async function main() {
  if (process.platform !== 'darwin') {
    console.log('Skipping macOS icon generation on non-macOS platform.')
    return
  }

  fs.mkdirSync(buildDir, { recursive: true })
  fs.rmSync(iconsetDir, { recursive: true, force: true })
  fs.mkdirSync(iconsetDir, { recursive: true })

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-ui-icon-'))
  const previewPath = path.join(tempDir, iconPreviewName)

  try {
    execFileSync('qlmanage', ['-t', '-s', '1024', '-o', tempDir, iconSource], {
      stdio: 'ignore',
    })

    if (!fs.existsSync(previewPath)) {
      throw new Error(`Quick Look did not generate a PNG for ${iconSource}`)
    }

    for (const [size, filename] of iconSizes) {
      execFileSync('sips', ['-z', String(size), String(size), previewPath, '--out', path.join(iconsetDir, filename)], {
        stdio: 'ignore',
      })
    }

    execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', iconOutput], { stdio: 'ignore' })
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }

  console.log(`Generated ${iconOutput}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
