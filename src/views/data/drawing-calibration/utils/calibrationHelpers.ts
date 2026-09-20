import type * as THREE from 'three'

import type {
  AlignmentPair,
  AlignmentResult,
  PreviewInfo,
} from '@/api/calibration'

export const colorToHex = (color: string): string => {
  if (!color) return 'ffffff'

  if (color.startsWith('#')) {
    return color.replace('#', '').substring(0, 6)
  }

  if (color.startsWith('rgb')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (match) {
      const r = parseInt(match[1], 10).toString(16).padStart(2, '0')
      const g = parseInt(match[2], 10).toString(16).padStart(2, '0')
      const b = parseInt(match[3], 10).toString(16).padStart(2, '0')
      return `${r}${g}${b}`
    }
  }

  return 'ffffff'
}

export const applyAlignment = (
  alignmentData: AlignmentResult,
  x: number,
  y: number,
) => {
  const theta = ((alignmentData.thetaDegrees ?? 0) * Math.PI) / 180
  const scale = alignmentData.scale ?? 1
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)

  return {
    x: scale * (cosT * x - sinT * y) + (alignmentData.tx ?? 0),
    y: scale * (sinT * x + cosT * y) + (alignmentData.ty ?? 0),
  }
}

export const getPointCloudBaseTransform = (
  previewData: PreviewInfo | null,
  cadOrigin: { x: number; y: number } | null,
) => {
  if (!previewData || !cadOrigin) return null

  const { minX, minY, maxX, maxY } = previewData.bounds
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return {
    centerX,
    centerY,
    baseX: centerX - cadOrigin.x,
    baseY: centerY - cadOrigin.y,
  }
}

const formatSignatureNumber = (value: number) => Number(value.toFixed(4))

export const buildAlignmentPairsSignature = (
  pairsData: AlignmentPair[] | null | undefined,
) => {
  if (!pairsData?.length) return ''

  return JSON.stringify(
    pairsData.map((pair) => ({
      lasX: formatSignatureNumber(pair.lasX),
      lasY: formatSignatureNumber(pair.lasY),
      cadX: formatSignatureNumber(pair.cadX),
      cadY: formatSignatureNumber(pair.cadY),
    })),
  )
}

export const buildAlignmentSignature = (
  alignmentData: AlignmentResult | null | undefined,
  previewData: PreviewInfo | null,
) => {
  if (!alignmentData || !previewData) return ''

  const { minX, minY, maxX, maxY } = previewData.bounds
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const marginX = (maxX - minX) * 0.2
  const marginY = (maxY - minY) * 0.2

  const lasPoints = [
    { lasX: centerX, lasY: centerY },
    { lasX: minX + marginX, lasY: minY + marginY },
    { lasX: maxX - marginX, lasY: minY + marginY },
    { lasX: minX + marginX, lasY: maxY - marginY },
  ]

  return buildAlignmentPairsSignature(
    lasPoints.map(({ lasX, lasY }) => {
      const cadPoint = applyAlignment(alignmentData, lasX, lasY)
      return {
        lasX,
        lasY,
        cadX: cadPoint.x,
        cadY: cadPoint.y,
      }
    }),
  )
}

const formatSceneSyncNumber = (value: number) => Number(value.toFixed(3))

export const getSceneSyncSignature = ({
  camera,
  plane,
  backgroundColor,
  backgroundAlpha,
}: {
  camera:
    | (THREE.Camera & {
        zoom?: number
        left?: number
        right?: number
        top?: number
        bottom?: number
      })
    | null
    | undefined
  plane: THREE.Object3D & {
    position: THREE.Vector3
    rotation: THREE.Euler
    scale: THREE.Vector3
  }
  backgroundColor: string
  backgroundAlpha: number
}) => {
  if (!camera || !plane) return ''

  return JSON.stringify({
    cameraPosition: [
      formatSceneSyncNumber(camera.position?.x ?? 0),
      formatSceneSyncNumber(camera.position?.y ?? 0),
      formatSceneSyncNumber(camera.position?.z ?? 0),
    ],
    cameraZoom: formatSceneSyncNumber(camera.zoom ?? 1),
    cameraSpan: [
      formatSceneSyncNumber(camera.left ?? 0),
      formatSceneSyncNumber(camera.right ?? 0),
      formatSceneSyncNumber(camera.top ?? 0),
      formatSceneSyncNumber(camera.bottom ?? 0),
    ],
    planePosition: [
      formatSceneSyncNumber(plane.position.x),
      formatSceneSyncNumber(plane.position.y),
      formatSceneSyncNumber(plane.position.z),
    ],
    planeRotation: formatSceneSyncNumber(plane.rotation.z),
    planeScale: formatSceneSyncNumber(plane.scale.x),
    background: [backgroundColor, formatSceneSyncNumber(backgroundAlpha)],
  })
}
