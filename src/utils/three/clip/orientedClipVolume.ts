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

type PositionAttribute =
  | THREE.BufferAttribute
  | THREE.InterleavedBufferAttribute
export type ClipBoundsRoot =
  | THREE.Object3D
  | { root: THREE.Object3D; includeInvisible: true }

interface CachedObjectBounds {
  geometry: THREE.BufferGeometry
  position: PositionAttribute
  positionVersion: number
  positionCount: number
  index: THREE.BufferAttribute | null
  indexVersion?: number
  drawStart: number
  drawEnd: number
  instanceMatrix?: THREE.InstancedBufferAttribute
  instanceVersion?: number
  instanceCount?: number
  localToClip: readonly number[]
  bounds: THREE.Box3
}

function positionVersion(position: PositionAttribute): number {
  return position instanceof THREE.InterleavedBufferAttribute
    ? position.data.version
    : position.version
}

function sameMatrix(
  elements: readonly number[],
  matrix: THREE.Matrix4,
): boolean {
  return elements.every((value, index) =>
    Object.is(value, matrix.elements[index]),
  )
}

/**
 * 按实际绘制索引和 drawRange 收集裁切局部包围盒，已过滤噪点不能撑大剖切框。
 * 隐藏 LOD 仍收集过滤后的内容；缓存随几何、索引、绘制窗口或变换变化而刷新。
 */
export function createClipBoundsCollector() {
  const cache = new WeakMap<THREE.Object3D, CachedObjectBounds>()
  const localPoint = new THREE.Vector3()
  const instanceTransform = new THREE.Matrix4()
  const localToClipInstance = new THREE.Matrix4()

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
        const index = geometry.getIndex()
        const drawStart = Math.max(0, geometry.drawRange.start)
        const drawEnd = Math.min(
          index?.count ?? position.count,
          geometry.drawRange.start + geometry.drawRange.count,
        )

        const localToClip = worldToClip.clone().multiply(object.matrixWorld)
        const instanced =
          object instanceof THREE.InstancedMesh ? object : undefined
        const version = positionVersion(position)
        const previous = cache.get(object)
        if (
          previous?.geometry === geometry &&
          previous.position === position &&
          previous.positionVersion === version &&
          previous.positionCount === position.count &&
          previous.index === index &&
          previous.indexVersion === index?.version &&
          previous.drawStart === drawStart &&
          previous.drawEnd === drawEnd &&
          previous.instanceMatrix === instanced?.instanceMatrix &&
          previous.instanceVersion === instanced?.instanceMatrix.version &&
          previous.instanceCount === instanced?.count &&
          sameMatrix(previous.localToClip, localToClip)
        ) {
          if (!previous.bounds.isEmpty()) {
            frame.fullBounds.union(previous.bounds)
            hasPoints = true
          }
          return
        }

        const bounds = new THREE.Box3()
        const instances = instanced ? instanced.count : 1
        for (let instance = 0; instance < instances; instance += 1) {
          if (instanced) instanced.getMatrixAt(instance, instanceTransform)
          const transform = instanced
            ? localToClipInstance.copy(localToClip).multiply(instanceTransform)
            : localToClip
          if (!transform.elements.every(Number.isFinite)) continue
          for (let drawIndex = drawStart; drawIndex < drawEnd; drawIndex += 1) {
            const vertex = index ? index.getX(drawIndex) : drawIndex
            if (
              !Number.isInteger(vertex) ||
              vertex < 0 ||
              vertex >= position.count
            )
              continue
            localPoint.set(
              position.getX(vertex),
              position.getY(vertex),
              position.getZ(vertex),
            )
            if (
              !Number.isFinite(localPoint.x) ||
              !Number.isFinite(localPoint.y) ||
              !Number.isFinite(localPoint.z)
            )
              continue
            localPoint.applyMatrix4(transform)
            if (
              Number.isFinite(localPoint.x) &&
              Number.isFinite(localPoint.y) &&
              Number.isFinite(localPoint.z)
            ) {
              bounds.expandByPoint(localPoint)
            }
          }
        }
        cache.set(object, {
          geometry,
          position,
          positionVersion: version,
          positionCount: position.count,
          index,
          indexVersion: index?.version,
          drawStart,
          drawEnd,
          instanceMatrix: instanced?.instanceMatrix,
          instanceVersion: instanced?.instanceMatrix.version,
          instanceCount: instanced?.count,
          localToClip: [...localToClip.elements],
          bounds,
        })
        if (!bounds.isEmpty()) {
          frame.fullBounds.union(bounds)
          hasPoints = true
        }
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
