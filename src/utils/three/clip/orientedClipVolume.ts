import * as THREE from 'three'

export interface OrientedClipPercentBounds {
  x: readonly [number, number]
  y: readonly [number, number]
  z: readonly [number, number]
}

export interface OrientedClipFrame {
  /** 裁切局部坐标到世界坐标的旋转；初始 X=隧道水平走向、Y=铅垂、Z=横向。 */
  worldFromLocal: THREE.Quaternion
  localFromWorld: THREE.Quaternion
  /** 百分比范围参照盒；初始为内容包围盒，手动旋转后随盒体变换。 */
  fullBounds: THREE.Box3
}

const CLIP_BOUNDS_TOLERANCE_METERS = 0.02

export type ClipBoundsRoot =
  | THREE.Object3D
  | { root: THREE.Object3D; includeInvisible: true }

export function createClipBoundsCollector() {
  const localToClip = new THREE.Matrix4()

  /**
   * 按每个几何体的缓存包围盒（three 会在首次计算后缓存）计算裁切局部包围盒，
   * 避免逐顶点扫描——大点云/多瓦片时逐顶点会非常慢。
   */
  function createFrame(
    roots: readonly ClipBoundsRoot[],
    along?: THREE.Vector3 | null,
  ): OrientedClipFrame {
    const frame = createOrientedClipFrame([], along)
    const worldToClip = new THREE.Matrix4().makeRotationFromQuaternion(
      frame.localFromWorld,
    )
    let hasPoints = false

    for (const source of roots) {
      const root = source instanceof THREE.Object3D ? source : source.root
      const includeInvisible = !(source instanceof THREE.Object3D)
      root.updateWorldMatrix(true, true)
      const visit = (object: THREE.Object3D) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points))
          return
        const geometry = object.geometry
        if (!(geometry instanceof THREE.BufferGeometry)) return
        const position = geometry.getAttribute('position')
        if (!position || !position.count) return
        if (!geometry.boundingBox) geometry.computeBoundingBox()
        const local = geometry.boundingBox
        if (!local || local.isEmpty()) return
        localToClip.copy(worldToClip).multiply(object.matrixWorld)
        const box = local.clone().applyMatrix4(localToClip)
        if (box.isEmpty()) return
        frame.fullBounds.union(box)
        hasPoints = true
      }
      if (includeInvisible) root.traverse(visit)
      else root.traverseVisible(visit)
    }
    if (hasPoints) frame.fullBounds.expandByScalar(CLIP_BOUNDS_TOLERANCE_METERS)
    return frame
  }

  return { createFrame }
}

/** 默认显示留出可抓取的空间，边距只按横断面计算，不随隧道长度放大。 */
export function expandClipFrameForDisplay(
  frame: OrientedClipFrame,
): OrientedClipFrame {
  const fullBounds = frame.fullBounds.clone()
  if (!fullBounds.isEmpty()) {
    const size = fullBounds.getSize(new THREE.Vector3())
    const crossSection =
      Math.max(size.y, size.z) - 2 * CLIP_BOUNDS_TOLERANCE_METERS
    const margin = THREE.MathUtils.clamp(crossSection * 0.03, 0.15, 0.5)
    fullBounds.expandByScalar(margin - CLIP_BOUNDS_TOLERANCE_METERS)
  }
  return {
    worldFromLocal: frame.worldFromLocal.clone(),
    localFromWorld: frame.localFromWorld.clone(),
    fullBounds,
  }
}

/**
 * 由「水平走向」构造裁切坐标系：local X=走向水平投影、Y=铅垂、Z=横向。
 * 无走向时返回单位四元数（即轴对齐）。
 */
function frameFromAlong(along: THREE.Vector3): THREE.Quaternion {
  const x = new THREE.Vector3(along.x, 0, along.z)
  if (x.lengthSq() < 1e-10) return new THREE.Quaternion()
  x.normalize()
  const yUp = new THREE.Vector3(0, 1, 0)
  const z = new THREE.Vector3().crossVectors(x, yUp).normalize()
  if (z.lengthSq() < 1e-10) return new THREE.Quaternion()
  const y = new THREE.Vector3().crossVectors(z, x).normalize()
  const matrix = new THREE.Matrix4().makeBasis(x, y, z)
  return new THREE.Quaternion().setFromRotationMatrix(matrix)
}

/**
 * 默认框与 ViewCube 共用直立标架；只取水平走向，实际坡度仍由内容包围盒保留。
 * 这里只改变裁切坐标系，不变换内容本身；手动旋转仍可改变完整姿态。
 */
export function createOrientedClipFrame(
  worldPoints: readonly THREE.Vector3[],
  along?: THREE.Vector3 | null,
): OrientedClipFrame {
  const worldFromLocal =
    along && [along.x, along.y, along.z].every(Number.isFinite)
      ? frameFromAlong(along)
      : new THREE.Quaternion()

  const localFromWorld = worldFromLocal.clone().invert()
  const fullBounds = new THREE.Box3()
  worldPoints.forEach((point) => {
    if ([point.x, point.y, point.z].every(Number.isFinite)) {
      fullBounds.expandByPoint(point.clone().applyQuaternion(localFromWorld))
    }
  })
  return { worldFromLocal, localFromWorld, fullBounds }
}

export function selectOrientedClipBounds(
  frame: OrientedClipFrame,
  percentages: OrientedClipPercentBounds,
): THREE.Box3 | undefined {
  if (frame.fullBounds.isEmpty()) return undefined
  const size = frame.fullBounds.getSize(new THREE.Vector3())
  const value = (axis: 'x' | 'y' | 'z', percent: number) =>
    frame.fullBounds.min[axis] + size[axis] * (percent / 100)
  return new THREE.Box3(
    new THREE.Vector3(
      value('x', percentages.x[0]),
      value('y', percentages.y[0]),
      value('z', percentages.z[0]),
    ),
    new THREE.Vector3(
      value('x', percentages.x[1]),
      value('y', percentages.y[1]),
      value('z', percentages.z[1]),
    ),
  )
}

/** 围绕当前选中盒中心旋转裁切坐标系；原 frame 与模型坐标均保持不变。 */
export function rotateOrientedClipFrame(
  frame: OrientedClipFrame,
  selectedBounds: THREE.Box3,
  worldAxis: THREE.Vector3,
  angleRad: number,
): OrientedClipFrame {
  const axis = worldAxis.clone()
  if (
    ![axis.x, axis.y, axis.z, angleRad].every(Number.isFinite) ||
    axis.lengthSq() < 1e-20 ||
    selectedBounds.isEmpty()
  ) {
    return {
      worldFromLocal: frame.worldFromLocal.clone(),
      localFromWorld: frame.localFromWorld.clone(),
      fullBounds: frame.fullBounds.clone(),
    }
  }
  const worldFromLocal = new THREE.Quaternion()
    .setFromAxisAngle(axis.normalize(), angleRad)
    .multiply(frame.worldFromLocal)
  const localFromWorld = worldFromLocal.clone().invert()
  const selectedCenter = selectedBounds.getCenter(new THREE.Vector3())
  const originalWorldCenter = selectedCenter
    .clone()
    .applyQuaternion(frame.worldFromLocal)
  const offset = originalWorldCenter
    .applyQuaternion(localFromWorld)
    .sub(selectedCenter)
  return {
    worldFromLocal,
    localFromWorld,
    fullBounds: frame.fullBounds.clone().translate(offset),
  }
}

/** Three.js 保留 distanceToPoint >= 0 的一侧，因此六个法向均朝向盒体内部。 */
export function orientedClipPlanes(
  frame: OrientedClipFrame,
  bounds: THREE.Box3,
): THREE.Plane[] {
  const worldAxis = (axis: 'x' | 'y' | 'z') => {
    const local =
      axis === 'x'
        ? new THREE.Vector3(1, 0, 0)
        : axis === 'y'
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1)
    return local.applyQuaternion(frame.worldFromLocal).normalize()
  }
  const x = worldAxis('x')
  const y = worldAxis('y')
  const z = worldAxis('z')
  return [
    new THREE.Plane(x, -bounds.min.x),
    new THREE.Plane(x.clone().negate(), bounds.max.x),
    new THREE.Plane(y, -bounds.min.y),
    new THREE.Plane(y.clone().negate(), bounds.max.y),
    new THREE.Plane(z, -bounds.min.z),
    new THREE.Plane(z.clone().negate(), bounds.max.z),
  ]
}
