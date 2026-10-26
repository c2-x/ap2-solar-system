import * as THREE from 'three'

const DEG = Math.PI / 180

/**
 * AP2 核心：只使用 Matrix4 的平移、旋转、缩放与 multiply。
 * 列向量约定下，最右侧变换先作用于顶点。
 */
export function createEarthMoonRig(earthMesh, moonMesh) {
  earthMesh.matrixAutoUpdate = false
  moonMesh.matrixAutoUpdate = false

  const orbitMatrix = new THREE.Matrix4()
  const earthDistance = new THREE.Matrix4().makeTranslation(21, 0, 0)
  const tiltMatrix = new THREE.Matrix4()
  const spinMatrix = new THREE.Matrix4()
  const scaleMatrix = new THREE.Matrix4().makeScale(1, 1, 1)
  const moonTilt = new THREE.Matrix4().makeRotationX(5.14 * DEG)
  const moonOrbit = new THREE.Matrix4()
  const moonDistance = new THREE.Matrix4().makeTranslation(2.4, 0, 0)
  const moonScale = new THREE.Matrix4().makeScale(.27, .27, .27)
  const earthFrame = new THREE.Matrix4()

  return function update({ earthAngle, earthSpin, moonAngle, axialTilt }) {
    // 地球：先转自身轴倾角和自转，再挂到公转轨道坐标系。
    orbitMatrix.makeRotationY(earthAngle)
    tiltMatrix.makeRotationZ(axialTilt * DEG)
    spinMatrix.makeRotationY(earthSpin)
    earthMesh.matrix.copy(orbitMatrix)
      .multiply(earthDistance)
      .multiply(tiltMatrix)
      .multiply(spinMatrix)
      .multiply(scaleMatrix)
    earthMesh.matrixWorldNeedsUpdate = true

    // 地月参考系不含地球自转和轴倾角，避免月球被地球自转“甩动”。
    earthFrame.copy(orbitMatrix).multiply(earthDistance)

    // 手工矩阵：M_moon = M_earthFrame · Rx(5.14°) · Ry(moonAngle) · T(2.4) · S(.27)
    moonOrbit.makeRotationY(moonAngle)
    moonMesh.matrix.copy(earthFrame)
      .multiply(moonTilt)
      .multiply(moonOrbit)
      .multiply(moonDistance)
      .multiply(moonScale)
    moonMesh.matrixWorldNeedsUpdate = true
  }
}

export function sampleTour(keyframes, seconds, outPosition, outTarget) {
  const duration = keyframes.at(-1).t
  const t = ((seconds % duration) + duration) % duration
  let i = 0
  while (i < keyframes.length - 2 && t > keyframes[i + 1].t) i++
  const a = keyframes[i]
  const b = keyframes[i + 1]
  const linear = (t - a.t) / (b.t - a.t)
  const u = linear * linear * (3 - 2 * linear)
  outPosition.set(
    a.p[0] + (b.p[0] - a.p[0]) * u,
    a.p[1] + (b.p[1] - a.p[1]) * u,
    a.p[2] + (b.p[2] - a.p[2]) * u,
  )
  outTarget.set(
    a.q[0] + (b.q[0] - a.q[0]) * u,
    a.q[1] + (b.q[1] - a.q[1]) * u,
    a.q[2] + (b.q[2] - a.q[2]) * u,
  )
}
