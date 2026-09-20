import * as THREE from 'three'
import type { TrajectoryPoint } from '@/api/calibration'

export const FUSION_Z_UP_ROTATION_X = -Math.PI / 2
export const FUSION_Z_UP_TO_Y_UP_QUAT = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  FUSION_Z_UP_ROTATION_X,
)
export const FUSION_Z_UP_TO_Y_UP_MATRIX = new THREE.Matrix4().makeRotationX(
  FUSION_Z_UP_ROTATION_X,
)
export const FUSION_GAUSSIAN_Y_UP_MATRIX = FUSION_Z_UP_TO_Y_UP_MATRIX.clone()

export const toRigidMatrix = (matrix: THREE.Matrix4) => {
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  matrix.decompose(pos, quat, new THREE.Vector3())
  return new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1))
}

export const buildFusionBimWorldMatrix = (
  _pointcloudWorldMatrix?: THREE.Matrix4 | null,
  modelMatrix?: number[] | null,
) => {
  if (!Array.isArray(modelMatrix) || modelMatrix.length !== 16) return null
  const transform = new THREE.Matrix4().fromArray(modelMatrix)

  return new THREE.Matrix4()
    .copy(FUSION_Z_UP_TO_Y_UP_MATRIX)
    .multiply(transform.clone().invert())
}

export const buildTrajectoryYUpPose = (
  point: TrajectoryPoint,
  lookDistance = 5,
) => {
  const yaw = point.yaw || 0
  const yawRad = THREE.MathUtils.degToRad(yaw)

  const localPoint = new THREE.Vector3(point.x, point.y, point.z)
  const direction = new THREE.Vector3(
    Math.cos(yawRad),
    Math.sin(yawRad),
    0,
  ).normalize()

  const target = localPoint
    .clone()
    .addScaledVector(direction, lookDistance)
    .applyQuaternion(FUSION_Z_UP_TO_Y_UP_QUAT)

  const camera = localPoint
    .clone()
    .addScaledVector(direction, -lookDistance * 1.5)
    .applyQuaternion(FUSION_Z_UP_TO_Y_UP_QUAT)

  return { camera, target }
}

export const buildGaussianTrajectoryYUpPose = (
  point: TrajectoryPoint,
  lookDistance = 5,
) => {
  const basePoint = new THREE.Vector3(point.x, point.y, point.z)
  const quaternionValues = [point.qx, point.qy, point.qz, point.qw].map(Number)
  const hasQuaternion = quaternionValues.every((value) =>
    Number.isFinite(value),
  )

  let forward = new THREE.Vector3(1, 0, 0)
  if (hasQuaternion) {
    const [qx, qy, qz, qw] = quaternionValues
    forward = new THREE.Vector3(1, 0, 0).applyQuaternion(
      new THREE.Quaternion(qx, qy, qz, qw).normalize(),
    )
  }

  // 高斯轨迹位姿严格使用预览接口返回的四元数，禁止再回退到旧的 heading/yaw 逻辑。
  // 若四元数缺失或退化，则保留默认前向，避免混入旧算法。
  if (forward.lengthSq() < 1e-8) forward.set(1, 0, 0)
  forward.normalize()

  const camera = basePoint
    .clone()
    .applyQuaternion(FUSION_Z_UP_TO_Y_UP_QUAT)

  const target = basePoint
    .clone()
    .addScaledVector(forward, lookDistance)
    .applyQuaternion(FUSION_Z_UP_TO_Y_UP_QUAT)

  return { camera, target }
}
