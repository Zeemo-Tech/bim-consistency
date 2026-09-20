import * as THREE from 'three'

/**
 * C2M 点选插值（供批注/调试复用）：
 * 用 Raycaster 命中三角面后，取三顶点 `distance` BufferAttribute 做重心插值。
 *
 * 前提：`geometry` 上存在与 PLY 顶点顺序一致的 `distance` 属性（float32 每顶点一个标量），
 * 与后端 `distances.bin` 对齐；不可用 RGB 反推距离。
 */
export function sampleC2MDeviationAtPick(
  intersection: THREE.Intersection,
  mesh: THREE.Mesh,
): number | null {
  const geom = mesh.geometry as THREE.BufferGeometry
  const distAttr = geom.getAttribute('distance') as THREE.BufferAttribute | undefined
  if (!distAttr) return null
  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute
  if (!posAttr) return null
  const faceIndex = intersection.faceIndex
  if (faceIndex == null || faceIndex < 0) return null

  let i0: number
  let i1: number
  let i2: number
  const index = geom.index
  if (index) {
    const base = faceIndex * 3
    i0 = index.getX(base)
    i1 = index.getX(base + 1)
    i2 = index.getX(base + 2)
  } else {
    const base = faceIndex * 3
    i0 = base
    i1 = base + 1
    i2 = base + 2
  }

  const va = new THREE.Vector3().fromBufferAttribute(posAttr, i0)
  const vb = new THREE.Vector3().fromBufferAttribute(posAttr, i1)
  const vc = new THREE.Vector3().fromBufferAttribute(posAttr, i2)

  const localPoint = intersection.point.clone()
  mesh.worldToLocal(localPoint)

  const bary = new THREE.Vector3()
  if (THREE.Triangle.getBarycoord(localPoint, va, vb, vc, bary) === null) return null

  const d0 = distAttr.getX(i0)
  const d1 = distAttr.getX(i1)
  const d2 = distAttr.getX(i2)
  return bary.x * d0 + bary.y * d1 + bary.z * d2
}
