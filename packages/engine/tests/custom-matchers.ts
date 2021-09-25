import { Quaternion, Vector3 } from 'three'
import assert from 'assert'

export const assertNumberEquals = (received: number, expected: number, tolerance = 2) => {
  const limit = 1.0 / Math.pow(10, tolerance)
  const diff = Math.abs(received - expected)
  const pass = diff < limit

  const message = `Not close enough.
Expected  ${expected}
Received  ${received}
Diff      ${diff}
tolerance ${tolerance}
Limit     ${limit}`

  assert.ok(pass, message)
}

export const assertVec3Equals = (received: Vector3, expected: Vector3, tolerance = 5) => {
  const limit = 0.5 / Math.pow(10, tolerance)
  const diffX = Math.abs(received.x - expected.x)
  const diffY = Math.abs(received.y - expected.y)
  const diffZ = Math.abs(received.z - expected.z)
  const passX = diffX < limit
  const passY = diffY < limit
  const passZ = diffZ < limit

  const pass = passX && passY && passZ

  const message = `Not close enough.
Expected [ ${expected.x}, ${expected.y}, ${expected.z} ]
Received [ ${received.x}, ${received.y}, ${received.z} ]
Diff     [ ${diffX}, ${diffY}, ${diffZ} ]
Tolerance ${tolerance}
Limit     ${limit}`

  assert.ok(pass, message)
}

export const assertQuaternionEquals = (received: Quaternion, expected: Quaternion, tolerance = 5) => {
  const limit = 0.5 / Math.pow(10, tolerance)
  const angle = received.angleTo(expected)
  const pass = angle < limit

  const message = `Quaternion angle is not close enough.
Expected [ ${expected.x}, ${expected.y}, ${expected.z}, ${expected.w} ]
Received [ ${received.x}, ${received.y}, ${received.z}, ${received.w} ]
Angle     ${angle}
Tolerance ${tolerance}
Limit     ${limit}`

  assert.ok(pass, message)
}
