import * as THREE from 'three'
import {
  createClipBoundsCollector,
  expandClipFrameForDisplay,
  rotateOrientedClipFrame,
  orientedClipPlanes,
  selectOrientedClipBounds,
  type OrientedClipFrame,
  type OrientedClipPercentBounds,
  type ClipBoundsRoot,
} from './orientedClipVolume'
import { ClipBoxGizmo, type ClipAxis, type ClipHandle } from './clipBoxGizmo'
import {
  beginClipRotation,
  updateClipRotation,
  type ClipRotationDrag,
} from './clipBoxRotation'

export type { ClipAxis } from './clipBoxGizmo'
export type { OrientedClipPercentBounds } from './orientedClipVolume'

export interface ClipBoxControllerOptions {
  scene: THREE.Scene
  getCamera: () => THREE.PerspectiveCamera | THREE.OrthographicCamera | null
  getDomElement: () => HTMLElement | null
  /** 参与计算默认裁切框的内容根（点云/模型）。 */
  getRoots: () => ClipBoundsRoot[]
  /** 把裁切面应用到内容（各 viewer 自行实现：per-material 或 renderer 全局）。 */
  applyPlanes: (planes: THREE.Plane[]) => void
  /** 请求一帧重绘。 */
  requestRender: () => void
  /** 拖拽期间临时禁用相机控制。 */
  setControlsEnabled?: (enabled: boolean) => void
  initialBounds?: OrientedClipPercentBounds
  onChange?: (bounds: OrientedClipPercentBounds) => void
}

export const FULL_CLIP_BOUNDS: OrientedClipPercentBounds = {
  x: [0, 100],
  y: [0, 100],
  z: [0, 100],
}

interface ClipFaceDragState {
  kind: 'face'
  axis: ClipAxis
  side: 0 | 1
  pointerId: number
  axisDirection: THREE.Vector3
  axisLength: number
  plane: THREE.Plane
  startPoint: THREE.Vector3
  startRange: [number, number]
}
interface ClipRotateDragState {
  kind: 'rotate'
  pointerId: number
  startFrame: OrientedClipFrame
  startBounds: THREE.Box3
  gesture: ClipRotationDrag
}
type ClipDragState = ClipFaceDragState | ClipRotateDragState

/**
 * 视口内可拖拽的朝向裁切盒控制器（移植自 Tunnel Section Analyzer）。
 * 面手柄拖拽改尺寸，边/角手柄拖拽旋转；百分比区间由外部 UI 读写。
 */
export class ClipBoxController {
  private readonly scene: THREE.Scene
  private readonly opts: ClipBoxControllerOptions
  private readonly collector = createClipBoundsCollector()
  private readonly raycaster = new THREE.Raycaster()

  private gizmo?: ClipBoxGizmo
  private dom?: HTMLElement
  private enabled = false
  private bounds: OrientedClipPercentBounds
  private dragState?: ClipDragState
  private interactionFrame?: OrientedClipFrame
  private frameCache?: { key: string; frame: OrientedClipFrame }
  private revision = 0
  private attached = false
  private readonly lastPointer = new THREE.Vector2()

  constructor(options: ClipBoxControllerOptions) {
    this.opts = options
    this.scene = options.scene
    this.bounds = options.initialBounds
      ? {
          x: [...options.initialBounds.x] as [number, number],
          y: [...options.initialBounds.y] as [number, number],
          z: [...options.initialBounds.z] as [number, number],
        }
      : {
          x: [...FULL_CLIP_BOUNDS.x],
          y: [...FULL_CLIP_BOUNDS.y],
          z: [...FULL_CLIP_BOUNDS.z],
        }
  }

  attach() {
    if (this.attached) return
    const dom = this.opts.getDomElement()
    if (!dom) return
    this.dom = dom
    dom.addEventListener('pointerdown', this.onPointerDown, true)
    dom.addEventListener('pointermove', this.onPointerMove, true)
    dom.addEventListener('pointerup', this.onPointerUp, true)
    dom.addEventListener('pointercancel', this.onPointerUp, true)
    dom.addEventListener('pointerleave', this.onPointerLeave, true)
    window.addEventListener('blur', this.onWindowBlur)
    window.addEventListener('keydown', this.onKeyDown, true)
    this.attached = true
  }

  detach() {
    const dom = this.dom
    if (dom) {
      dom.removeEventListener('pointerdown', this.onPointerDown, true)
      dom.removeEventListener('pointermove', this.onPointerMove, true)
      dom.removeEventListener('pointerup', this.onPointerUp, true)
      dom.removeEventListener('pointercancel', this.onPointerUp, true)
      dom.removeEventListener('pointerleave', this.onPointerLeave, true)
    }
    window.removeEventListener('blur', this.onWindowBlur)
    window.removeEventListener('keydown', this.onKeyDown, true)
    this.attached = false
  }

  /** 内容/变换变化后让默认框重算。 */
  invalidate() {
    this.revision += 1
    this.frameCache = undefined
    this.interactionFrame = undefined
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) this.finishDrag(true)
    this.applyClipping()
    this.updateGizmo()
  }

  isEnabled() {
    return this.enabled
  }

  getBounds(): OrientedClipPercentBounds {
    return {
      x: [...this.bounds.x] as [number, number],
      y: [...this.bounds.y] as [number, number],
      z: [...this.bounds.z] as [number, number],
    }
  }

  setBounds(bounds: OrientedClipPercentBounds) {
    this.bounds = {
      x: [...bounds.x] as [number, number],
      y: [...bounds.y] as [number, number],
      z: [...bounds.z] as [number, number],
    }
    this.applyClipping()
    this.updateGizmo()
  }

  reset() {
    this.finishDrag(true)
    this.interactionFrame = undefined
    this.frameCache = undefined
    this.bounds = {
      x: [0, 100],
      y: [0, 100],
      z: [0, 100],
    }
    this.opts.onChange?.(this.getBounds())
    this.applyClipping()
    this.updateGizmo()
  }

  /** 每帧调用，跟随相机更新手柄朝向/尺寸。 */
  update() {
    if (!this.gizmo || !this.gizmo.group.visible) return
    const camera = this.opts.getCamera()
    const dom = this.dom
    if (camera && dom) this.gizmo.updateCamera(camera, dom.clientHeight)
  }

  dispose() {
    this.detach()
    this.gizmo?.dispose()
    this.gizmo = undefined
  }

  // ---- internals ----

  private currentClipPlanes(): THREE.Plane[] {
    if (!this.enabled) return []
    const frame = this.getClipFrame()
    const bounds = selectOrientedClipBounds(frame, this.bounds)
    return bounds ? orientedClipPlanes(frame, bounds) : []
  }

  private applyClipping() {
    this.opts.applyPlanes(this.currentClipPlanes())
    this.opts.requestRender()
  }

  private updateGizmo() {
    if (!this.enabled) {
      this.gizmo?.setActive()
      if (this.gizmo) this.gizmo.group.visible = false
      return
    }
    const frame = this.getClipFrame()
    const bounds = selectOrientedClipBounds(frame, this.bounds)
    if (!bounds) {
      if (this.gizmo) this.gizmo.group.visible = false
      return
    }
    if (!this.gizmo) {
      this.gizmo = new ClipBoxGizmo()
      this.scene.add(this.gizmo.group)
    }
    this.gizmo.group.visible = true
    this.gizmo.updateBounds(bounds, frame.worldFromLocal)
    const camera = this.opts.getCamera()
    const dom = this.dom ?? this.opts.getDomElement()
    if (camera && dom) this.gizmo.updateCamera(camera, dom.clientHeight)
  }

  private getClipFrame(): OrientedClipFrame {
    if (this.interactionFrame) return this.interactionFrame
    const key = String(this.revision)
    if (this.frameCache?.key === key) return this.frameCache.frame
    const frame = expandClipFrameForDisplay(
      this.collector.createFrame(this.opts.getRoots()),
    )
    this.frameCache = { key, frame }
    return frame
  }

  private getVolume() {
    const frame = this.getClipFrame()
    const bounds = selectOrientedClipBounds(frame, this.bounds)
    return bounds ? { frame, bounds } : undefined
  }

  private pointerNdc(event: PointerEvent) {
    const dom = this.dom
    if (!dom) return undefined
    const rect = dom.getBoundingClientRect()
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
  }

  private pickHandle(event: PointerEvent) {
    if (!this.gizmo || !this.enabled) return undefined
    const camera = this.opts.getCamera()
    const pointer = this.pointerNdc(event)
    if (!camera || !pointer) return undefined
    this.raycaster.setFromCamera(pointer, camera)
    return this.gizmo.pick(this.raycaster, camera)
  }

  private axisDirection(axis: ClipAxis) {
    const direction = new THREE.Vector3()
    direction[axis] = 1
    return direction
  }

  private setActive(handle?: ClipHandle) {
    this.gizmo?.setActive(handle)
    this.opts.requestRender()
  }

  private onPointerDown = (event: PointerEvent) => {
    if (!this.enabled || event.button !== 0 || this.dragState) return
    const hit = this.pickHandle(event)
    const camera = this.opts.getCamera()
    const volume = this.getVolume()
    if (!hit || !camera || !volume) return
    const { frame, bounds } = volume
    const axisDirection = this.axisDirection(hit.axis)
      .applyQuaternion(frame.worldFromLocal)
      .normalize()
    if (hit.kind !== 'face') {
      const pointer = this.pointerNdc(event)
      const dom = this.dom
      if (!pointer || !dom) return
      const rect = dom.getBoundingClientRect()
      this.dragState = {
        kind: 'rotate',
        pointerId: event.pointerId,
        startFrame: frame,
        startBounds: bounds.clone(),
        gesture: beginClipRotation(
          this.raycaster.ray,
          camera,
          bounds
            .getCenter(new THREE.Vector3())
            .applyQuaternion(frame.worldFromLocal),
          axisDirection,
          hit.point,
          pointer,
          new THREE.Vector2(rect.width, rect.height),
        ),
      }
    } else {
      const cameraDirection = camera.getWorldDirection(new THREE.Vector3())
      const planeNormal = cameraDirection
        .clone()
        .addScaledVector(axisDirection, -cameraDirection.dot(axisDirection))
      if (planeNormal.lengthSq() < 1e-6) return
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        planeNormal.normalize(),
        hit.point,
      )
      const startPoint = new THREE.Vector3()
      if (!this.raycaster.ray.intersectPlane(plane, startPoint)) return
      this.dragState = {
        kind: 'face',
        axis: hit.axis,
        side: hit.side,
        pointerId: event.pointerId,
        axisDirection,
        axisLength: Math.max(
          frame.fullBounds.getSize(new THREE.Vector3())[hit.axis],
          1e-6,
        ),
        plane,
        startPoint,
        startRange: [...this.bounds[hit.axis]] as [number, number],
      }
    }
    this.interactionFrame = frame
    this.setActive(hit)
    this.opts.setControlsEnabled?.(false)
    this.dom?.setPointerCapture(event.pointerId)
    if (this.dom) this.dom.style.cursor = 'grabbing'
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  private onPointerMove = (event: PointerEvent) => {
    if (!this.dragState) {
      if (this.enabled) {
        const hit = this.pickHandle(event)
        if (this.dom) this.dom.style.cursor = hit ? 'grab' : ''
        this.setActive(hit)
      }
      return
    }
    if (event.pointerId !== this.dragState.pointerId) return
    const camera = this.opts.getCamera()
    const pointer = this.pointerNdc(event)
    if (!camera || !pointer) return
    this.raycaster.setFromCamera(pointer, camera)
    if (this.dragState.kind === 'rotate') {
      const angle = updateClipRotation(
        this.dragState.gesture,
        this.raycaster.ray,
        pointer,
      )
      this.interactionFrame = rotateOrientedClipFrame(
        this.dragState.startFrame,
        this.dragState.startBounds,
        this.dragState.gesture.axis,
        angle,
      )
      this.applyClipping()
      this.updateGizmo()
      return
    }
    const currentPoint = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.dragState.plane, currentPoint))
      return
    const worldDelta = currentPoint
      .sub(this.dragState.startPoint)
      .dot(this.dragState.axisDirection)
    const percentDelta = (worldDelta / this.dragState.axisLength) * 100
    const nextRange: [number, number] = [...this.dragState.startRange]
    const nextValue =
      this.dragState.startRange[this.dragState.side] + percentDelta
    const minimumSpan = Math.min(1, (0.05 / this.dragState.axisLength) * 100)
    nextRange[this.dragState.side] =
      this.dragState.side === 0
        ? THREE.MathUtils.clamp(nextValue, 0, nextRange[1] - minimumSpan)
        : THREE.MathUtils.clamp(nextValue, nextRange[0] + minimumSpan, 100)
    this.bounds = {
      ...this.bounds,
      [this.dragState.axis]: nextRange,
    }
    this.opts.onChange?.(this.getBounds())
    this.applyClipping()
    this.updateGizmo()
  }

  private onPointerUp = (event: PointerEvent) => {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) return
    this.finishDrag(event.type !== 'pointerup')
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  private onPointerLeave = () => {
    if (!this.dragState && this.enabled) {
      this.setActive()
      if (this.dom) this.dom.style.cursor = ''
    }
  }

  private onWindowBlur = () => {
    if (this.dragState) this.finishDrag(true)
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !this.dragState) return
    this.finishDrag(true)
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  private finishDrag(cancel = false) {
    const drag = this.dragState
    this.dragState = undefined
    if (this.dom?.hasPointerCapture(drag?.pointerId ?? -1)) {
      this.dom.releasePointerCapture(drag!.pointerId)
    }
    if (cancel && drag) {
      if (drag.kind === 'face') {
        this.bounds = {
          ...this.bounds,
          [drag.axis]: [...drag.startRange] as [number, number],
        }
        this.opts.onChange?.(this.getBounds())
      } else {
        this.interactionFrame = drag.startFrame
      }
      this.applyClipping()
    }
    this.setActive()
    this.opts.setControlsEnabled?.(true)
    if (this.dom) this.dom.style.cursor = ''
    this.updateGizmo()
    this.opts.requestRender()
  }
}

export { ClipBoxGizmo }
