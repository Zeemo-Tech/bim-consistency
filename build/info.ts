import type { Plugin } from 'vite'
import gradient from 'gradient-string'
import { getPackageSize } from './utils'
import dayjs, { type Dayjs } from 'dayjs'
import duration from 'dayjs/plugin/duration'
import boxen, { type Options as BoxenOptions } from 'boxen'
dayjs.extend(duration)

const welcomeMessage = gradient(['cyan', 'magenta']).multiline(
  `您好! 欢迎使用 中建八局项目\n祝您使用愉快\n有bug请及时反馈`,
)

const boxenOptions: BoxenOptions = {
  padding: 0.5,
  borderColor: 'cyan',
  borderStyle: 'round',
}

export function viteBuildInfo(): Plugin {
  let config: { command: string }
  let startTime: Dayjs
  let endTime: Dayjs
  let outDir: string
  return {
    name: 'vite:buildInfo',
    configResolved(resolvedConfig) {
      config = resolvedConfig
      outDir = resolvedConfig.build?.outDir ?? 'dist'
    },
    buildStart() {
      if (config.command === 'build') {
        startTime = dayjs(new Date())
      }
    },
    closeBundle() {
      if (config.command === 'build') {
        endTime = dayjs(new Date())
        getPackageSize({
          folder: outDir,
          callback: (size: string) => {
          },
        })
      }
    },
  }
}
