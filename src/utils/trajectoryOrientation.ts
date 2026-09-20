import * as THREE from 'three'

type TrajectoryOrientationLike = {
  yaw?: number | null
  qx?: number | null
  qy?: number | null
  qz?: number | null
  qw?: number | null
}

export type TrajectoryForwardAxis = '+x' | '-x' | '+y' | '-y' | '+z' | '-z'

export const TRAJECTORY_FORWARD_AXIS_OPTIONS: Array<{
  label: string
  value: TrajectoryForwardAxis
}> = [
  { label: '+X', value: '+x' },
  { label: '-X', value: '-x' },
  { label: '+Y', value: '+y' },
  { label: '-Y', value: '-y' },
  { label: '+Z', value: '+z' },
  { label: '-Z', value: '-z' },
]

const normalizeDegrees = (degrees: number) => {
  let normalized = ((((degrees + 180) % 360) + 360) % 360) - 180
  if (Object.is(normalized, -0)) {
    normalized = 0
  }
  return normalized
}

export const normalizeYawDegrees = (value: unknown) => {
  const yaw = Number(value)
  if (!Number.isFinite(yaw)) return 0

  // Older interfaces may provide yaw in radians, while panorama rendering expects degrees.
  if (Math.abs(yaw) <= Math.PI * 2 + 1e-6) {
    return normalizeDegrees(THREE.MathUtils.radToDeg(yaw))
  }

  return normalizeDegrees(yaw)
}

const resolveForwardVector = (axis: TrajectoryForwardAxis = '+x') => {
  switch (axis) {
    case '-x':
      return new THREE.Vector3(-1, 0, 0)
    case '+y':
      return new THREE.Vector3(0, 1, 0)
    case '-y':
      return new THREE.Vector3(0, -1, 0)
    case '+z':
      return new THREE.Vector3(0, 0, 1)
    case '-z':
      return new THREE.Vector3(0, 0, -1)
    case '+x':
    default:
      return new THREE.Vector3(1, 0, 0)
  }
}

export const resolveTrajectoryDirection2D = (
  point: TrajectoryOrientationLike,
  forwardAxis: TrajectoryForwardAxis = '+x',
) => {
  const quaternionValues = [point.qx, point.qy, point.qz, point.qw].map(Number)
  const hasQuaternion = quaternionValues.every((value) =>
    Number.isFinite(value),
  )

  if (hasQuaternion) {
    const [qx, qy, qz, qw] = quaternionValues
    const quaternion = new THREE.Quaternion(qx, qy, qz, qw)
    const direction3D =
      resolveForwardVector(forwardAxis).applyQuaternion(quaternion)
    const direction2D = new THREE.Vector2(direction3D.x, direction3D.y)
    if (direction2D.lengthSq() >= 1e-8) {
      return direction2D.normalize()
    }
  }

  const yawDegrees = normalizeYawDegrees(point.yaw)
  const yawRadians = THREE.MathUtils.degToRad(yawDegrees)
  return new THREE.Vector2(Math.cos(yawRadians), Math.sin(yawRadians))
}

export const resolveTrajectoryHeadingDegrees = (
  point: TrajectoryOrientationLike,
  forwardAxis: TrajectoryForwardAxis = '+x',
) => {
  const direction2D = resolveTrajectoryDirection2D(point, forwardAxis)
  if (direction2D.lengthSq() < 1e-8) return 0
  return normalizeDegrees(
    THREE.MathUtils.radToDeg(Math.atan2(direction2D.y, direction2D.x)),
  )
}
