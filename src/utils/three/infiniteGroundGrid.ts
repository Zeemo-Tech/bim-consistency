import * as THREE from 'three'
import {
  Fn,
  vec2,
  float,
  uniform,
  positionView,
  positionWorld,
  fract,
  abs,
  max,
  min,
  smoothstep,
  mix,
  pow,
  floor,
  fwidth,
} from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'

/**
 * 作用：参考 cloudBIM-viewer 的 InfiniteGroundGrid，
 * 用 TSL 实现世界坐标下的无限地面网格（适配 WebGPU 渲染器）。
 *
 * 网格尺寸随模型自适应，位置跟随相机视锥，视觉上永远延伸至视野之外。
 */
export class InfiniteGroundGrid extends THREE.Mesh {
  declare material: MeshBasicNodeMaterial

  private readonly gridColor = uniform(new THREE.Color('#2a6f82'))
  private readonly cellSize = uniform(1)
  private readonly gridLevel = uniform(0)
  private readonly gridOrigin = uniform(new THREE.Vector2())
  private readonly fadeDistance = uniform(5000)

  private readonly corner = new THREE.Vector3()
  private readonly viewBounds = new THREE.Box3()
  private readonly assetSize = new THREE.Vector3()

  constructor(color: THREE.ColorRepresentation = '#2a6f82') {
    super(
      new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2),
      new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    this.name = 'infinite-ground-grid'
    this.frustumCulled = false
    this.gridColor.value.set(color)

    const gridLine = Fn(([coordinates]: [any]) => {
      const pixelWidth = max(fwidth(coordinates), vec2(0.000001))
      const distanceToLine = abs(fract(coordinates.sub(0.5)).sub(0.5)).div(
        pixelWidth,
      )
      const lines = float(1).sub(min(distanceToLine, vec2(1)))
      const fade = float(1).sub(smoothstep(vec2(0.25), vec2(1), pixelWidth))
      const scaled = lines.mul(fade)
      return max(scaled.x, scaled.y)
    })

    const coordinates = positionWorld.xz
      .sub(this.gridOrigin)
      .div(this.cellSize)
      .div(pow(10, floor(this.gridLevel)))
    const fine = gridLine(coordinates)
    const coarse = gridLine(coordinates.div(10))
    const broad = gridLine(coordinates.div(100))

    const depthFade = float(1).sub(
      smoothstep(
        this.fadeDistance.mul(0.75),
        this.fadeDistance,
        positionView.z.mul(-1),
      ),
    )
    const alpha = mix(
      max(fine.mul(0.3), coarse.mul(0.45)),
      max(coarse.mul(0.3), broad.mul(0.45)),
      fract(this.gridLevel),
    ).mul(depthFade)

    this.material.colorNode = this.gridColor
    this.material.opacityNode = alpha
  }

  setBounds(box: THREE.Box3) {
    if (box.isEmpty()) return
    const size = box.getSize(this.assetSize)
    const span = Math.max(size.x, size.y, size.z, 0.001)
    this.position.y = box.min.y - span * 0.002
    this.cellSize.value = span / 20
    this.gridOrigin.value.set(
      (box.min.x + box.max.x) / 2,
      (box.min.z + box.max.z) / 2,
    )
  }

  setColor(color: THREE.ColorRepresentation) {
    this.gridColor.value.set(color)
  }

  updateForCamera(camera: THREE.Camera) {
    camera.updateWorldMatrix(true, false)
    this.viewBounds.makeEmpty()
    // 视野内的地面交点都落在这个世界空间包围盒内
    for (const x of [-1, 1]) {
      for (const y of [-1, 1]) {
        for (const z of [-1, 1]) {
          this.viewBounds.expandByPoint(
            this.corner.set(x, y, z).unproject(camera),
          )
        }
      }
    }
    const { min, max } = this.viewBounds
    this.position.x = (min.x + max.x) / 2
    this.position.z = (min.z + max.z) / 2
    this.scale.set(
      Math.max(max.x - min.x, 1) * 0.55,
      1,
      Math.max(max.z - min.z, 1) * 0.55,
    )
    this.fadeDistance.value = (camera as THREE.PerspectiveCamera).far
    const height = Math.abs(
      camera.getWorldPosition(this.corner).y - this.position.y,
    )
    const viewHeight =
      (2 * height) / Math.abs(camera.projectionMatrix.elements[5]!)
    this.gridLevel.value = Math.max(
      0,
      Math.log10(Math.max(1, viewHeight / (this.cellSize.value * 80))),
    )
    this.updateMatrixWorld(true)
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }
}
