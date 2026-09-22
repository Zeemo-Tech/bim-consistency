import { getDxfFile, getScanPreview } from '@/api/calibration'
import { colorToHex } from './calibrationHelpers'

/**
 * CAD 校准页数据预取/缓存。
 *
 * CAD 校准页（drawing-calibration）进入时会请求 DXF 与点云预览（含轨迹），
 * 数据量较大。分析页进入「偏差对比」步骤时后台预取这些数据并缓存在内存里，
 * 切到「CAD与轨迹校准」步骤即可直接用缓存，避免白屏等待。
 *
 * 说明：缓存是模块级内存缓存（不落盘），刷新页面即失效；失败静默，不影响正常流程。
 */

/** CAD 校准页默认的点云预览参数（需与页面内保持一致）。 */
export const CAD_DEFAULT_PREVIEW_PARAMS = {
  size: 1024,
  heightMin: 1.35,
  heightMax: 2,
  contentColor: colorToHex('#F6FF7A'),
  splitLayers: true,
}

const dxfCache = new Map<string, unknown>()
const previewCache = new Map<string, unknown>()

function dxfKey(projectId: number, fileId: number) {
  return `${projectId}:${fileId}`
}

function previewKey(
  projectId: number,
  scanFileId: number,
  params: Record<string, unknown>,
) {
  return `${projectId}:${scanFileId}:${JSON.stringify(params ?? {})}`
}

export function getCachedDxf(projectId: number, fileId: number) {
  return dxfCache.get(dxfKey(projectId, fileId)) ?? null
}

export function setCachedDxf(projectId: number, fileId: number, data: unknown) {
  if (!projectId || !fileId || !data) return
  dxfCache.set(dxfKey(projectId, fileId), data)
}

export function getCachedPreview(
  projectId: number,
  scanFileId: number,
  params: Record<string, unknown>,
) {
  return previewCache.get(previewKey(projectId, scanFileId, params)) ?? null
}

export function setCachedPreview(
  projectId: number,
  scanFileId: number,
  params: Record<string, unknown>,
  data: unknown,
) {
  if (!projectId || !scanFileId || !data) return
  previewCache.set(previewKey(projectId, scanFileId, params), data)
}

/** 作用：后台预取 CAD 校准页数据（DXF + 点云预览），失败静默。 */
export async function prefetchCadCalibration(options: {
  projectId: number
  scanFileId: number
  cadFileId: number
  previewParams?: Record<string, unknown>
}) {
  const { projectId, scanFileId, cadFileId, previewParams } = options
  const tasks: Array<Promise<void>> = []

  if (projectId && cadFileId && !getCachedDxf(projectId, cadFileId)) {
    tasks.push(
      getDxfFile(projectId, cadFileId)
        .then((res) => {
          if (res?.code === 200 && res.data) {
            setCachedDxf(projectId, cadFileId, res.data)
          }
        })
        .catch(() => undefined),
    )
  }

  if (
    projectId &&
    scanFileId &&
    previewParams &&
    !getCachedPreview(projectId, scanFileId, previewParams)
  ) {
    tasks.push(
      getScanPreview(projectId, scanFileId, previewParams)
        .then((res) => {
          if (res?.code === 200 && res.data) {
            setCachedPreview(projectId, scanFileId, previewParams, res.data)
          }
        })
        .catch(() => undefined),
    )
  }

  await Promise.all(tasks)
}
