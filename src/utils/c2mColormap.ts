import * as THREE from 'three'

/**
 * 双参数质量色图：绿色（合格）→黄色（接近异常）→红色（异常）。
 *
 * 两个参数共同决定颜色映射：
 *   toleranceLimit：合格界限（±X），范围内保持绿色
 *   colormapLimit ：显示上限（±Y），超过上限后显示灰色
 *
 * 颜色控制点锚定：
 *   |d| <= toleranceLimit → 绿色 #3fd36b（合格）
 *   toleranceLimit < |d| < colormapLimit → 黄色到红色渐变
 *   |d| >= colormapLimit → 灰色 #d7dbe2（超显示上限）
 */

const C2M_COLORS = [
  new THREE.Color(0x3fd36b), // 合格绿
  new THREE.Color(0xf6d365), // 提醒黄
  new THREE.Color(0xf05a4f), // 异常红
]
const C2M_STOPS = [0, 0.55, 1]

/** 超出显示上限的浅灰（与各端视觉保持一致） */
const OUT_OF_RANGE_GRAY = { r: 0.843, g: 0.859, b: 0.886 } // #d7dbe2

/**
 * t ∈ [0,1] → RGB（绿色→黄色→红色）
 */
export function c2mDivergingRgb(t: number): { r: number; g: number; b: number } {
  const x = Math.min(1, Math.max(0, t))
  let i = 0
  while (i < C2M_STOPS.length - 1 && x > C2M_STOPS[i + 1]) i++
  const t0 = C2M_STOPS[i]
  const t1 = C2M_STOPS[i + 1]
  const u = t1 > t0 ? (x - t0) / (t1 - t0) : 0
  const out = new THREE.Color().copy(C2M_COLORS[i]).lerp(C2M_COLORS[i + 1], u)
  return { r: out.r, g: out.g, b: out.b }
}

/**
 * 距离值 → t（-1 表示超出显示上限）
 *
 * 分段规则：
 *   |d| >= colormapLimit          → -1（浅灰）
 *   |d| <= toleranceLimit         → 0（绿色合格区）
 *   colormapLimit > |d| > toleranceLimit → [0,1]（黄→红异常区）
 */
export function distToT(d: number, toleranceLimit: number, colormapLimit: number): number {
  const tol = Math.max(toleranceLimit, 1e-6)
  const cap = Math.max(colormapLimit, tol + 1e-6)
  const abs = Math.abs(d)
  if (abs >= cap) return -1
  if (abs <= tol) return 0
  return (abs - tol) / (cap - tol)
}

/**
 * 将有符号距离写入 geometry 的 color 属性（per-vertex RGB, Float32）。
 *
 * toleranceLimit：合格界限（米），范围内显示绿色
 * colormapLimit ：显示上限（米），超出后为浅灰 #d7dbe2
 */
export function applyC2mVertexColors(
  geometry: THREE.BufferGeometry,
  distances: Float32Array,
  colormapLimit: number,
  toleranceLimit: number = 0.05,
): void {
  const n = distances.length
  const pos = geometry.getAttribute('position')
  if (!pos || pos.count !== n) return
  let colors = geometry.getAttribute('color') as THREE.BufferAttribute | undefined
  if (!colors || colors.count !== n) {
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    colors = geometry.getAttribute('color') as THREE.BufferAttribute
  }
  const arr = colors.array as Float32Array
  for (let i = 0; i < n; i++) {
    const t = distToT(distances[i], toleranceLimit, colormapLimit)
    let r: number, g: number, b: number
    if (t < 0) {
      ;({ r, g, b } = OUT_OF_RANGE_GRAY)
    } else {
      ;({ r, g, b } = c2mDivergingRgb(t))
    }
    arr[i * 3] = r
    arr[i * 3 + 1] = g
    arr[i * 3 + 2] = b
  }
  colors.needsUpdate = true
}

/**
 * 客户端直方图：仅统计 [-colormapLimit, +colormapLimit] 范围内的值，分 bins 桶。
 * 超出范围的值直接跳过（灰色区），不堆积到边缘桶，避免直方图形态失真。
 */
export function histogramFromDistances(
  distances: Float32Array,
  colormapLimit: number,
  bins: number,
): { binEdges: number[]; counts: number[] } {
  const b = Math.max(10, Math.min(200, Math.floor(bins)))
  const hi = Math.max(colormapLimit, 1e-6)
  const counts = new Array(b).fill(0) as number[]
  const binEdges: number[] = []
  for (let i = 0; i <= b; i++) {
    binEdges.push(-hi + (i / b) * 2 * hi)
  }
  const scale = b / (2 * hi)
  const offset = hi
  for (let i = 0; i < distances.length; i++) {
    const d = distances[i]
    // 超出显示范围的值跳过，不计入直方图
    if (d < -hi || d > hi) continue
    const idx = Math.floor((d + offset) * scale)
    // 边界保护（浮点精度）
    if (idx >= 0 && idx < b) counts[idx]++
  }
  return { binEdges, counts }
}
