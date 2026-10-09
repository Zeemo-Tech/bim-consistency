import * as THREE from 'three'

const CLIP_ANCHOR = 'clipMarkerAnchor'
const markerVisibility = new WeakMap<THREE.Object3D, boolean>()
const lineAlphaToCoverage = new WeakMap<THREE.Material, boolean>()

/** 标记以实物中心为准整体显隐，避免框外标靶留下半截文字。 */
export function markClipMarkerAnchor(object: THREE.Object3D) {
  object.userData[CLIP_ANCHOR] = true
}

/** 射线不自动遵循材质裁切；拾取时同时排除被裁掉或父级隐藏的对象。 */
export function isClipHitVisible(
  object: THREE.Object3D,
  point: THREE.Vector3,
  planes: readonly THREE.Plane[],
) {
  for (
    let current: THREE.Object3D | null = object;
    current;
    current = current.parent
  ) {
    if (!current.visible) return false
  }
  return planes.every((plane) => plane.distanceToPoint(point) >= -1e-6)
}

/** 点云、轨迹、线段、标靶及标签共用世界坐标裁切平面。 */
export function setObjectClipping(
  root: THREE.Object3D | undefined,
  planes: THREE.Plane[],
) {
  if (!root) return
  root.updateWorldMatrix(true, true)
  root.traverse((child) => {
    if (child.userData[CLIP_ANCHOR]) {
      if (planes.length) {
        if (!markerVisibility.has(child))
          markerVisibility.set(child, child.visible)
        const anchor = child.getWorldPosition(new THREE.Vector3())
        child.visible =
          markerVisibility.get(child)! &&
          planes.every((plane) => plane.distanceToPoint(anchor) >= -1e-6)
      } else if (markerVisibility.has(child)) {
        child.visible = markerVisibility.get(child)!
        markerVisibility.delete(child)
      }
    }
    if (
      !(
        child instanceof THREE.Mesh ||
        child instanceof THREE.Points ||
        child instanceof THREE.Line ||
        child instanceof THREE.Sprite
      )
    )
      return
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material]
    materials.filter(Boolean).forEach((material) => {
      // Three r173 宽线的抗锯齿裁切分支引用了尚未声明的 diffuseColor，会整条不显示。
      // 仅剖切时切换到硬裁切分支；关闭后恢复原有抗锯齿设置。
      if ('isLineMaterial' in material && material.isLineMaterial) {
        if (planes.length) {
          if (!lineAlphaToCoverage.has(material))
            lineAlphaToCoverage.set(material, material.alphaToCoverage)
          material.alphaToCoverage = false
        } else if (lineAlphaToCoverage.has(material)) {
          material.alphaToCoverage = lineAlphaToCoverage.get(material)!
          lineAlphaToCoverage.delete(material)
        }
      }
      const countChanged =
        (material.clippingPlanes?.length ?? 0) !== planes.length
      material.clippingPlanes = planes
      material.clipIntersection = false
      if (countChanged) material.needsUpdate = true
    })
  })
}
