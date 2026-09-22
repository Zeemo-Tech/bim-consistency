import { Vector2 } from 'three'
import type * as THREE from 'three'
import { PostProcessing } from 'three/webgpu'
import {
  Fn,
  exp,
  float,
  log2,
  max,
  pass,
  select,
  uniform,
  vec2,
  uv,
} from 'three/tsl'

/**
 * 作用：点云 EDL（Eye-Dome Lighting）后处理，对齐 cloudBIM-viewer 的
 * `PointCloudEdlPipeline`，使用 TSL 实现以适配 WebGPURenderer。
 *
 * 原理：屏幕空间邻域深度差 → 边缘遮挡变暗；背景像素不做 EDL。
 */
export class PointCloudEdlPipeline {
  enabled = true
  strength = 1
  radius = 1

  private readonly postProcessing: PostProcessing
  private readonly nearUniform = uniform(0.1)
  private readonly farUniform = uniform(1000)
  private readonly strengthUniform = uniform(1)
  private readonly radiusUniform = uniform(1)
  private readonly resolutionUniform = uniform(new Vector2(1, 1))
  private readonly depthNode: any

  constructor(renderer: any, scene: THREE.Scene, camera: THREE.Camera) {
    this.postProcessing = new PostProcessing(renderer)
    const scenePass: any = pass(scene, camera)
    const colorNode: any = scenePass.getTextureNode('output')
    this.depthNode = scenePass.getTextureNode('depth')

    this.postProcessing.outputNode = this.buildNode(colorNode)
  }

  private linearDepth(fragZ: any) {
    const near = this.nearUniform
    const far = this.farUniform
    const viewZ = near.mul(far).div(far.sub(near).mul(fragZ).sub(far))
    return max(viewZ.mul(-1), float(1e-6))
  }

  private buildNode(colorNode: any) {
    const depthNode = this.depthNode
    const resolution = this.resolutionUniform
    const strength = this.strengthUniform
    const radius = this.radiusUniform

    const neighborResponse = Fn(([depth, offset]: [any, any]) => {
      const nz = depthNode.sample(uv().add(offset)).x
      const neighborDepth = this.linearDepth(nz)
      const isBackground = nz.greaterThanEqual(float(0.999999))
      const response = max(float(0), log2(neighborDepth).sub(log2(depth)))
      return select(isBackground, float(0), response)
    })

    return Fn(() => {
      const coord = uv()
      const color = colorNode.sample(coord)
      const fragZ = depthNode.sample(coord).x
      const depth = this.linearDepth(fragZ)

      const texel = vec2(radius).div(resolution)
      let response = neighborResponse(depth, vec2(texel.x.mul(-1), float(0)))
      response = response.add(neighborResponse(depth, vec2(texel.x, float(0))))
      response = response.add(
        neighborResponse(depth, vec2(float(0), texel.y.mul(-1))),
      )
      response = response.add(neighborResponse(depth, vec2(float(0), texel.y)))
      response = response.add(
        neighborResponse(depth, vec2(texel.x.mul(-1), texel.y.mul(-1))),
      )
      response = response.add(
        neighborResponse(depth, vec2(texel.x.mul(-1), texel.y)),
      )
      response = response.add(
        neighborResponse(depth, vec2(texel.x, texel.y.mul(-1))),
      )
      response = response.add(neighborResponse(depth, vec2(texel.x, texel.y)))
      response = response.mul(0.125)

      const shade = max(exp(response.mul(-220).mul(strength)), float(0.22))
      const isBackground = fragZ.greaterThanEqual(float(0.999999))
      return select(isBackground, color, color.mul(shade))
    })()
  }

  setStrength(strength: number) {
    this.strength = Math.max(0, strength)
    this.strengthUniform.value = this.strength
  }

  setRadius(radius: number) {
    this.radius = Math.max(0.25, radius)
    this.radiusUniform.value = this.radius
  }

  render(camera: THREE.Camera, width: number, height: number) {
    this.nearUniform.value = (camera as THREE.PerspectiveCamera).near ?? 0.1
    this.farUniform.value = (camera as THREE.PerspectiveCamera).far ?? 1000
    this.resolutionUniform.value.set(Math.max(1, width), Math.max(1, height))
    this.postProcessing.render()
  }

  dispose() {
    this.postProcessing.dispose?.()
  }
}
