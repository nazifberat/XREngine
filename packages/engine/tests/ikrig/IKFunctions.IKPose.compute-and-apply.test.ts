import { World } from '@xrengine/engine/src/ecs/classes/World'
import { Quaternion, Vector3 } from 'three'
import { createEntity } from '../../src/ecs/functions/EntityFunctions'
import { getComponent } from '../../src/ecs/functions/ComponentFunctions'
import { Entity } from '../../src/ecs/classes/Entity'
import {
  applyHip,
  applyIKPoseToIKRig,
  applyLimb,
  applyLookTwist,
  applyPoseToRig,
  applySpine,
  computeHip,
  computeIKPose,
  computeLimb,
  computeLookTwist,
  computeSpine,
  worldToModel
} from '../../src/ikrig/functions/IKFunctions'
import {
  IKPoseComponent,
  IKPoseComponentType,
  IKPoseLimbData,
  IKPoseLookTwist,
  IKPoseSpineData
} from '../../src/ikrig/components/IKPoseComponent'
import { IKRigComponent, IKRigComponentType, IKRigTargetComponent } from '../../src/ikrig/components/IKRigComponent'
import {
  adoptBones,
  adoptIKPose,
  applyTestPoseState,
  setupTestSourceEntity,
  setupTestTargetEntity,
  targetMeshTransform,
  vector3FromSerialized
} from './test-data/functions'
import { bones } from './test-data/pose1/ikrig.pose.bones'
import { bones as tbones } from './test-data/ikrig.tpose.bones'
import { bones as poseBonesForLegs } from './test-data/rig2.pose.bones'
import { bones as poseBonesWithAppliedHipLegsSpine } from './test-data/rig2.pose.bones-after-hip-legs-spine'
import { ikpose as ikposeData } from './test-data/pose1/ikpose.computed'
import { rigData as rigDataApplied } from './test-data/rig2.data.applied'
import { FORWARD, UP } from '@xrengine/engine/src/ikrig/constants/Vector3Constants'
import { PoseBoneLocalState } from '../../src/ikrig/classes/Pose'
import { createWorld } from '../../src/ecs/functions/EngineFunctions'
import { Engine } from '../../src/ecs/classes/Engine'
import assert from 'assert'
import {assertNumberEquals, assertQuaternionEquals, assertVec3Equals} from '../custom-matchers'

before(() => {
  Engine.currentWorld = createWorld()
})

describe('Check compute', () => {
  let sourceEntity: Entity, expectedIKPose

  beforeEach(async () => {
    sourceEntity = createEntity()
    setupTestSourceEntity(sourceEntity)
    const rig = getComponent(sourceEntity, IKRigComponent)
    // apply animation pose
    const animBonesStates = adoptBones(bones)
    applyTestPoseState(rig.pose, animBonesStates)

    // setup expected animation pose data
    expectedIKPose = adoptIKPose(ikposeData)
  })

  it('Has correct test pose', async () => {
    const animBonesStates = adoptBones(bones)
    const tbonesStates = adoptBones(tbones)
    const rig = getComponent(sourceEntity, IKRigComponent)
  
    assertVec3Equals(rig.tpose.bones[0].world.position, tbonesStates[0].world.position)
    assertVec3Equals(rig.tpose.bones[0].world.scale, tbonesStates[0].world.scale)
    assertQuaternionEquals(rig.tpose.bones[0].world.quaternion, tbonesStates[0].world.quaternion, 2)
 
    rig.tpose.bones.forEach((boneState) => {
      const expectedState = tbonesStates.find((bs) => bs.name === boneState.name)
      // console.log('-- Tpose bone -- name:', boneState.name)
      assertNumberEquals(boneState.length, expectedState.length, 4)
      assertVec3Equals(boneState.bone.position, expectedState.local.position)

      assertVec3Equals(boneState.world.position, expectedState.world.position, 4)
      assertQuaternionEquals(boneState.world.quaternion, expectedState.world.quaternion, 2)
      assertVec3Equals(boneState.world.scale, expectedState.world.scale, 4)
    })

    rig.pose.bones.forEach((boneState) => {
      const expectedState = animBonesStates.find((bs) => bs.name === boneState.name)
      // console.log('-- pose bone -- name:', boneState.name)
      assertNumberEquals(boneState.length, expectedState.length, 4)
      assertVec3Equals(boneState.bone.position, expectedState.local.position)
      assertQuaternionEquals(boneState.bone.quaternion, expectedState.local.quaternion, 2)
      assertVec3Equals(boneState.bone.scale, expectedState.local.scale)

      assertVec3Equals(boneState.world.position, expectedState.world.position)
      assertQuaternionEquals(boneState.world.quaternion, expectedState.world.quaternion, 2)
      assertVec3Equals(boneState.world.scale, expectedState.world.scale)
    })
  })

  it('Has correct chains', async () => {
    const rig = getComponent(sourceEntity, IKRigComponent)

    for (let chainsKey in rigDataApplied.chains) {
      const chain = rig.chains[chainsKey]
      const expectedChain = rigDataApplied.chains[chainsKey]
      assert.strictEqual(chain.cnt, expectedChain.cnt)
      assert.strictEqual(chain.end_idx, expectedChain.end_idx)
      assertNumberEquals(chain.length, expectedChain.len)
      assert.strictEqual(chain.chainBones.length, expectedChain.bones.length)
      assertVec3Equals(chain.altForward, vector3FromSerialized(expectedChain.alt_fwd))
      assertVec3Equals(chain.altUp, vector3FromSerialized(expectedChain.alt_up))
      for (let i = 0; i < chain.chainBones.length; i++) {
        assert.strictEqual(chain.chainBones[i].index, expectedChain.bones[i].idx)
        assertNumberEquals(chain.chainBones[i].length, expectedChain.bones[i].len)
      }
    }
  })

  it('Can computeHip', () => {
    const expectedHip = expectedIKPose.hip
    const ikPose = getComponent(sourceEntity, IKPoseComponent)
    const rig = getComponent(sourceEntity, IKRigComponent)

    computeHip(rig, ikPose)

    assertNumberEquals(ikPose.hip.bind_height, expectedHip.bind_height)
    assertNumberEquals(ikPose.hip.twist, expectedHip.twist)
    assertVec3Equals(ikPose.hip.dir, expectedHip.dir)
    assertVec3Equals(ikPose.hip.movement, expectedHip.movement)
  })

  const limbs = ['leg_l', 'leg_r', 'arm_l', 'arm_r']
  limbs.forEach((limb)=>{
    it(`Can compute limb ${limb}`, () => {
      const expected: IKPoseLimbData = expectedIKPose[limb]

      const ikPose = getComponent(sourceEntity, IKPoseComponent) as IKPoseComponentType
      const rig = getComponent(sourceEntity, IKRigComponent)
  
      computeLimb(rig.pose, rig.chains[limb], ikPose[limb])
  
      const computed: IKPoseLimbData = ikPose[limb]
  
      assertVec3Equals(computed.dir, expected.dir, 4)
      assertVec3Equals(computed.jointDirection, expected.jointDirection, 4)
      assertNumberEquals(computed.lengthScale, expected.lengthScale)
    })
  })

  const footsAndHead = ['foot_l', 'foot_r', 'head']
  footsAndHead.forEach((chainName)=>{
    it(`Can compute look/twist for ${chainName}`, () => {
      const expected: IKPoseLookTwist = expectedIKPose[chainName]

      const ikPose = getComponent(sourceEntity, IKPoseComponent) as IKPoseComponentType
      const rig = getComponent(sourceEntity, IKRigComponent)
  
      computeLookTwist(rig, rig.points[chainName], ikPose[chainName], FORWARD, UP)
  
      const computed: IKPoseLookTwist = ikPose[chainName]
  
      assertVec3Equals(computed.lookDirection, expected.lookDirection, 4)
      assertVec3Equals(computed.twistDirection, expected.twistDirection, 4)
    })
  })

  it('Can compute spine', () => {
    const expected: IKPoseSpineData = expectedIKPose.spine

    const ikPose = getComponent(sourceEntity, IKPoseComponent) as IKPoseComponentType
    const rig = getComponent(sourceEntity, IKRigComponent)

    computeSpine(rig, rig.chains.spine, ikPose, UP, FORWARD)

    const computed: IKPoseSpineData = ikPose.spine

    assertVec3Equals(computed[0].lookDirection, expected[0].lookDirection, 4)
    assertVec3Equals(computed[0].twistDirection, expected[0].twistDirection, 4)

    assertVec3Equals(computed[1].lookDirection, expected[1].lookDirection, 4)
    assertVec3Equals(computed[1].twistDirection, expected[1].twistDirection, 4)
  })
})

describe('Check Apply', () => {
  let sourceEntity: Entity, expectedIKPose

  let ikPose: IKPoseComponentType,
    targetEntity: Entity,
    targetRig: IKRigComponentType,
    expectedState: PoseBoneLocalState[]
  const boneWorldPosition = new Vector3()
  const boneWorldScale = new Vector3()
  const boneWorldRotation = new Quaternion()

  before(() => {
    expectedState = adoptBones(rigDataApplied.pose.bones)
  })

  beforeEach(() => {
    sourceEntity = createEntity()
    setupTestSourceEntity(sourceEntity)
    const rig = getComponent(sourceEntity, IKRigComponent)
    ikPose = getComponent(sourceEntity, IKPoseComponent)
    // apply animation pose
    const animBonesStates = adoptBones(bones)
    applyTestPoseState(rig.pose, animBonesStates)

    computeIKPose(rig, ikPose)

    // init target entity and rig
    targetEntity = createEntity()
    setupTestTargetEntity(targetEntity)
    targetRig = getComponent(targetEntity, IKRigTargetComponent)

    // apply animation pose
    const targetAnimBonesStates = adoptBones(poseBonesForLegs)
    applyTestPoseState(targetRig.pose, targetAnimBonesStates)
  })

  it('Can apply Hip', () => {
    applyHip(ikPose, targetRig)

    const appliedHip = targetRig.pose.bones[targetRig.points.hip.index]
    const expectedHip = expectedState[targetRig.points.hip.index]

    assertVec3Equals(appliedHip.local.position, expectedHip.local.position, 4)
    assertQuaternionEquals(appliedHip.local.quaternion, expectedHip.local.quaternion, 2)

    assertVec3Equals(appliedHip.bone.position, expectedHip.local.position, 4)
    assertQuaternionEquals(appliedHip.bone.quaternion, expectedHip.local.quaternion, 2)

    // expect(appliedHip.model.position).toBeCloseToVector(expectedHip.world.position, 4)
    // expect(appliedHip.model.quaternion).toBeCloseToQuaternion(expectedHip.world.quaternion, 2)

    appliedHip.bone.getWorldPosition(boneWorldPosition)
    appliedHip.bone.getWorldQuaternion(boneWorldRotation)
    appliedHip.bone.getWorldScale(boneWorldScale)
    worldToModel(boneWorldPosition, boneWorldRotation, boneWorldScale, targetMeshTransform)

    assertVec3Equals(boneWorldPosition, expectedHip.world.position, 4)
    assertQuaternionEquals(boneWorldRotation, expectedHip.world.quaternion, 2)
  })

  it('Can apply spine', () => {
    applyHip(ikPose, targetRig)

    const appliedHip = targetRig.pose.bones[targetRig.points.hip.index]
    const expectedHip = expectedState[targetRig.points.hip.index]

    assertVec3Equals(appliedHip.local.position, expectedHip.local.position, 4)
    assertQuaternionEquals(appliedHip.local.quaternion, expectedHip.local.quaternion, 2)

    assertVec3Equals(appliedHip.bone.position, expectedHip.local.position, 4)
    assertQuaternionEquals(appliedHip.bone.quaternion, expectedHip.local.quaternion, 2)

    assertVec3Equals(appliedHip.world.position, expectedHip.world.position, 4)
    assertQuaternionEquals(appliedHip.world.quaternion, expectedHip.world.quaternion, 2)

    applySpine(ikPose, targetRig, targetRig.chains.spine, ikPose.spine, UP, FORWARD)

    const chain = targetRig.chains.spine
    const firstBone = targetRig.pose.bones[chain.first()]
    const expectedFirstBone = expectedState[chain.first()]
    assertVec3Equals(firstBone.local.position, expectedFirstBone.local.position, 4)
    assertQuaternionEquals(firstBone.local.quaternion, expectedFirstBone.local.quaternion, 2)

    const lastBone = targetRig.pose.bones[chain.last()]
    const expectedLastBone = expectedState[chain.last()]
    assertVec3Equals(lastBone.local.position, expectedLastBone.local.position, 4)
    assertQuaternionEquals(lastBone.local.quaternion, expectedLastBone.local.quaternion, 2)

    // now test all bones of chain
    targetRig.chains.spine.chainBones.forEach((boneData) => {
      const subBoneName = boneData.ref.name
      console.log('bone ' + subBoneName)
      const applied = targetRig.pose.bones[boneData.index]
      const expected = expectedState[boneData.index]

      assertVec3Equals(applied.local.position, expected.local.position, 4)
      assertQuaternionEquals(applied.local.quaternion, expected.local.quaternion, 2)
      // applied.bone.getWorldPosition(boneWorldPosition)
      // applied.bone.getWorldQuaternion(boneWorldRotation)
      // applied.bone.getWorldScale(boneWorldScale)
      // worldToModel(boneWorldPosition, boneWorldRotation, boneWorldScale, targetRig.pose.rootOffset)
      //
      // expect(boneWorldPosition).toBeCloseToVector(expected.world.position, 4)
      // expect(boneWorldScale).toBeCloseToVector(expected.world.scale, 4)
      // expect(boneWorldRotation).toBeCloseToQuaternion(expected.world.quaternion, 2)
    })
  })

  const expectedMidVarsLimbs = {
    leg_l: {
      chainLength: 0.826984795406015,
      limb: {
        dir: new Vector3(-0.09208551049232483, -0.6795139312744141, -0.7278606295585632),
        joint_dir: new Vector3(0.18084418773651123, -0.7302229404449463, 0.658839762210846),
        len_scale: 0.5933292853279439
      },
      preTargetVars: {
        len: 0.49067429763532683,
        p_tran: {
          pos: new Vector3(0, 0, 0.005501061677932739),
          rot: new Quaternion(0.0012618519831448793, -0.017835982143878937, -0.011710396967828274, 0.9997715353965759),
          scl: new Vector3(1, 1, 1)
        },
        c_tran: {
          pos: new Vector3(0.08992571383714676, -0.06811448186635971, -0.000022773630917072296),
          rot: new Quaternion(-0.997866153717041, 0.010610141791403294, -0.01851150207221508, 0.061707753688097),
          scl: new Vector3(1, 1, 0.9999760985374451)
        }
      },
      target: {
        axis: {
          x: new Vector3(0.9791913032531738, 0.07095976918935776, -0.1901291012763977),
          y: new Vector3(0.18084420263767242, -0.7302229404449463, 0.658839762210846),
          z: new Vector3(-0.09208551049232483, -0.6795139312744141, -0.7278606295585632)
        },
        end_pos: new Vector3(0.04474171996116638, -0.4015344977378845, -0.35716527700424194),
        len: 0.4906742993087348,
        len_sqr: 0.24076126800211786,
        start_pos: new Vector3(0.08992571383714676, -0.06811448186635971, -0.000022773630917072296)
      },
      solveLimbVars: {
        rotAfterAim: new Quaternion(-0.9107131958007812, 0.005796780344098806, 0.10183638334274292, 0.4002465009689331),
        acbLen: {
          aLen: 0.4059943074565367,
          bLen: 0.4209904879494783,
          cLen: 0.4906742993087348
        },
        firstRad: 0.9604389659008623
      }
    },
    arm_l: {
      chainLength: 0.5501921921968485,
      limb: {
        dir: new Vector3(-0.23155513405799866, -0.8478862047195435, 0.47693946957588196),
        joint_dir: new Vector3(0.7634854912757874, -0.46222051978111267, -0.45104557275772095),
        len_scale: 0.522264668173491
      },

      preTargetVars: {
        len: 0.28734594268933267,
        p_tran: {
          pos: new Vector3(0.03283514827489853, 0.4228754937648773, 0.1231885626912117),
          rot: new Quaternion(0.6655179858207703, 0.6771541237831116, 0.3124212920665741, 0.030681125819683075),
          scl: new Vector3(1, 1, 1)
        },
        c_tran: {
          pos: new Vector3(0.1566656529903412, 0.420114666223526, 0.1600237786769867),
          rot: new Quaternion(0.6655179262161255, 0.6771541833877563, 0.3124212920665741, 0.030681084841489792),
          scl: new Vector3(1, 1, 1)
        }
      },
      target: {
        axis: {
          x: new Vector3(-0.6028864979743958, -0.2596944272518158, -0.7543783187866211),
          y: new Vector3(0.7634854912757874, -0.46222054958343506, -0.45104557275772095),
          z: new Vector3(-0.23155513405799866, -0.8478862047195435, 0.47693946957588196)
        },
        end_pos: new Vector3(0.09012922644615173, 0.17647799849510193, 0.29707038402557373),
        len: 0.2873459482168701,
        len_sqr: 0.0825676939566522,
        start_pos: new Vector3(0.1566656529903412, 0.420114666223526, 0.1600237786769867)
      },
      solveLimbVars: {
        rotAfterAim: new Quaternion(0.8517362475395203, 0.00825949851423502, 0.4455207884311676, 0.2756604552268982),
        acbLen: {
          aLen: 0.27404703199863434,
          bLen: 0.27614516019821417,
          cLen: 0.2873459482168701
        },
        firstRad: 1.027530667791543
      }
    }
  }

  const legArmL = ['leg_l', 'arm_l']
  legArmL.forEach((boneName)=>{
    it(`x apply limb ${boneName}`, ()=>{
      const chain = targetRig.chains[boneName]
      const limb = ikPose[boneName]
      const expectedMidVars = expectedMidVarsLimbs[boneName]
      const expectedLimb = expectedMidVars.limb
      assertNumberEquals(chain.length, expectedMidVars.chainLength)
      assertNumberEquals(limb.lengthScale, expectedLimb.len_scale)
      assertVec3Equals(limb.dir, expectedLimb.dir, 4)
      assertVec3Equals(limb.jointDirection, expectedLimb.joint_dir, 4)
    
      // TODO: Update refrences here
      // const { preTargetVars, preGroundingVars, solveLimbVars } = applyLimb(ikPose, targetRig, chain, limb, 0)

      const expectedPreTargetVars = expectedMidVars.preTargetVars
    
      const expectedTarget = expectedMidVars.target
    
      // assertVec3Equals(preTargetVars.c_tran.position, expectedPreTargetVars.c_tran.pos, 4)
      // assertQuaternionEquals(preTargetVars.c_tran.quaternion, expectedPreTargetVars.c_tran.rot, 2)
      // assertVec3Equals(preTargetVars.c_tran.scale, expectedPreTargetVars.c_tran.scl, 4)
      // assertVec3Equals(preTargetVars.p_tran.position, expectedPreTargetVars.p_tran.pos, 4)
      // assertQuaternionEquals(preTargetVars.p_tran.quaternion, expectedPreTargetVars.p_tran.rot, 2)
      // assertVec3Equals(preTargetVars.p_tran.scale, expectedPreTargetVars.p_tran.scl, 4)
    
      // assertNumberEquals(preTargetVars.len, expectedPreTargetVars.len, 4)
    
      // assertVec3Equals(preGroundingVars.target.start_pos, expectedTarget.start_pos, 4)
      // assertVec3Equals(preGroundingVars.target.end_pos, expectedTarget.end_pos, 4)
      // assertNumberEquals(preGroundingVars.target.len, expectedTarget.len, 4)
      // assertNumberEquals(preGroundingVars.target.len, expectedTarget.len, 4)
    
      // const expectedSolveLimbVars = expectedMidVars.solveLimbVars
      // assertNumberEquals(solveLimbVars.acbLen.aLen, expectedSolveLimbVars.acbLen.aLen)
      // assertNumberEquals(solveLimbVars.acbLen.bLen, expectedSolveLimbVars.acbLen.bLen)
      // assertNumberEquals(solveLimbVars.acbLen.cLen, expectedSolveLimbVars.acbLen.cLen)
      // assertNumberEquals(solveLimbVars.firstRad, expectedSolveLimbVars.firstRad)
      // assertQuaternionEquals(solveLimbVars.rotAfterAim, expectedSolveLimbVars.rotAfterAim, 3)
    
      const bone0 = targetRig.pose.bones[targetRig.chains[boneName].chainBones[0].index]
      const expectedBone0 = expectedState[targetRig.chains[boneName].chainBones[0].index]
      const bone1 = targetRig.pose.bones[targetRig.chains[boneName].chainBones[1].index]
      const expectedBone1 = expectedState[targetRig.chains[boneName].chainBones[1].index]
      assertVec3Equals(bone0.world.position, expectedBone0.world.position, 3)
      assertQuaternionEquals(bone0.world.quaternion, expectedBone0.world.quaternion, 3)
      assertVec3Equals(bone1.world.position, expectedBone1.world.position, 3)
      assertQuaternionEquals(bone1.world.quaternion, expectedBone1.world.quaternion, 3)
    
      targetRig.chains[boneName].chainBones.forEach((boneData) => {
        const subBoneName = boneData.ref.name
        console.log('bone ' + subBoneName)
        const applied = targetRig.pose.bones[boneData.index]
        const expected = expectedState[boneData.index]
    
        assertVec3Equals(applied.local.position, expected.local.position, 4)
        assertQuaternionEquals(applied.local.quaternion, expected.local.quaternion, 2)
        assertVec3Equals(applied.world.position, expected.world.position, 4)
        assertQuaternionEquals(applied.world.quaternion, expected.world.quaternion, 2)
      })
    })
  })


  const armLR = ['arm_l', 'arm_r']
  armLR.forEach(boneName=>{
    it(`x apply arms ${boneName}`, ()=>{
    // apply animation pose
    // TODO: Update refrences here
    // const targetAnimBonesStates = adoptBones(poseBonesForArms)
    // applyTestPoseState(targetRig.pose, targetAnimBonesStates)
  
    const chain = targetRig.chains[boneName]
    const limb = ikPose[boneName]
    const expectedMidVars = expectedMidVarsLimbs[boneName]
    const expectedLimb = expectedMidVars.limb
    assertNumberEquals(chain.length, expectedMidVars.chainLength)
    assertNumberEquals(limb.lengthScale, expectedLimb.len_scale)
    assertVec3Equals(limb.dir, expectedLimb.dir, 4)
    assertVec3Equals(limb.jointDirection, expectedLimb.joint_dir, 4)
  
    // const { preTargetVars, preGroundingVars, solveLimbVars } = applyLimb(ikPose, targetRig, chain, limb, 0)
  
    const expectedPreTargetVars = expectedMidVars.preTargetVars
  
    const expectedTarget = expectedMidVars.target
  
    // assertVec3Equals(preTargetVars.c_tran.position, expectedPreTargetVars.c_tran.pos, 4)
    // assertQuaternionEquals(preTargetVars.c_tran.quaternion, expectedPreTargetVars.c_tran.rot, 2)
    // assertVec3Equals(preTargetVars.c_tran.scale, expectedPreTargetVars.c_tran.scl, 4)
    // assertVec3Equals(preTargetVars.p_tran.position, expectedPreTargetVars.p_tran.pos, 4)
    // assertQuaternionEquals(preTargetVars.p_tran.quaternion, expectedPreTargetVars.p_tran.rot, 2)
    // assertVec3Equals(preTargetVars.p_tran.scale, expectedPreTargetVars.p_tran.scl, 4)
  
    // assertNumberEquals(preTargetVars.len, expectedPreTargetVars.len, 4)
  
    // assertVec3Equals(preGroundingVars.target.start_pos, expectedTarget.start_pos, 4)
    // assertVec3Equals(preGroundingVars.target.end_pos, expectedTarget.end_pos, 4)
    // assertNumberEquals(preGroundingVars.target.len, expectedTarget.len, 4)
    // assertNumberEquals(preGroundingVars.target.len, expectedTarget.len, 4)
  
    // const expectedSolveLimbVars = expectedMidVars.solveLimbVars
    // assertNumberEquals(solveLimbVars.acbLen.aLen, expectedSolveLimbVars.acbLen.aLen)
    // assertNumberEquals(solveLimbVars.acbLen.bLen, expectedSolveLimbVars.acbLen.bLen)
    // assertNumberEquals(solveLimbVars.acbLen.cLen, expectedSolveLimbVars.acbLen.cLen)
    // assertNumberEquals(solveLimbVars.firstRad, expectedSolveLimbVars.firstRad)
    // assertQuaternionEquals(solveLimbVars.rotAfterAim, expectedSolveLimbVars.rotAfterAim, 3)
  
    const bone0 = targetRig.pose.bones[targetRig.chains[boneName].chainBones[0].index]
    const expectedBone0 = expectedState[targetRig.chains[boneName].chainBones[0].index]
    const bone1 = targetRig.pose.bones[targetRig.chains[boneName].chainBones[1].index]
    const expectedBone1 = expectedState[targetRig.chains[boneName].chainBones[1].index]
    assertVec3Equals(bone0.world.position, expectedBone0.world.position, 3)
    assertQuaternionEquals(bone0.world.quaternion, expectedBone0.world.quaternion, 3)
    assertVec3Equals(bone1.world.position, expectedBone1.world.position, 3)
    assertQuaternionEquals(bone1.world.quaternion, expectedBone1.world.quaternion, 3)
  
    targetRig.chains[boneName].chainBones.forEach((boneData) => {
      const subBoneName = boneData.ref.name
      console.log('bone ' + subBoneName)
      const applied = targetRig.pose.bones[boneData.index]
      const expected = expectedState[boneData.index]
  
      assertVec3Equals(applied.local.position, expected.local.position, 4)
      assertQuaternionEquals(applied.local.quaternion, expected.local.quaternion, 2)
      assertVec3Equals(applied.world.position, expected.world.position, 4)
      assertQuaternionEquals(applied.world.quaternion, expected.world.quaternion, 2)
    })
    })
  })

  const legsAndArms = ['leg_l', 'leg_r', 'arm_l', 'arm_r']
  legsAndArms.forEach((boneName)=>{
    it(`Can apply limb ${boneName}`, ()=>{
      const targetAnimBonesStates = adoptBones(
        boneName.startsWith('arm') ? poseBonesWithAppliedHipLegsSpine : poseBonesForLegs
      )
      applyTestPoseState(targetRig.pose, targetAnimBonesStates)
  
      const chain = targetRig.chains[boneName]
      const limb = ikPose[boneName]
  
      applyLimb(ikPose, targetRig, chain, limb, 0)
      targetRig.chains[boneName].chainBones.forEach((boneData) => {
        // const subBoneName = boneData.ref.name
        // console.log('bone ' + subBoneName)
        const applied = targetRig.pose.bones[boneData.index]
        const expected = expectedState[boneData.index]
  
        assertVec3Equals(applied.bone.position, expected.local.position, 4)
        assertQuaternionEquals(applied.bone.quaternion, expected.local.quaternion, 2)
  
        applied.bone.getWorldPosition(boneWorldPosition)
        applied.bone.getWorldQuaternion(boneWorldRotation)
        applied.bone.getWorldScale(boneWorldScale)
        worldToModel(boneWorldPosition, boneWorldRotation, boneWorldScale, targetMeshTransform)
  
        assertVec3Equals(boneWorldPosition, expected.world.position, 4)
        assertQuaternionEquals(boneWorldRotation, expected.world.quaternion, 2)
      })
    })
  })

  // const expLTVars = {
  //   foot_l: {
  //     rootQuaternion: new Quaternion(-0.6234073042869568, 0.052118729799985886, 0.0876801386475563, 0.7752156853675842),
  //     childRotation: new Quaternion(-0.9037027359008789, 0.007546038832515478, 0.1017211377620697, 0.4158337116241455),
  //     rotation0: new Quaternion(-0.8728105425834656, -0.08188201487064362, 0.1260855495929718, 0.46432748436927795),
  //     rotation1: new Quaternion(-0.8694409132003784, -0.07160184532403946, 0.17486561834812164, 0.45647361874580383),
  //     rotationFinal: new Quaternion(
  //       -0.4048269987106323,
  //       -0.11207748204469681,
  //       0.005583629477769136,
  //       0.9074816107749939
  //     ),
  //     boneParentQuaternion: new Quaternion(
  //       -0.6234073042869568,
  //       0.052118729799985886,
  //       0.0876801386475563,
  //       0.7752156853675842
  //     )
  //   },
  //   // will fail, not correct data
  //   foot_r: {
  //     rootQuaternion: new Quaternion(
  //       -0.9960752129554749,
  //       -0.0717119351029396,
  //       -0.051414649933576584,
  //       -0.006963543593883514
  //     ),
  //     childRotation: new Quaternion(
  //       -0.8884380459785461,
  //       -0.0412578247487545,
  //       -0.07799931615591049,
  //       -0.45043548941612244
  //     ),
  //     rotation0: new Quaternion(-0.8742867708206177, -0.06174449622631073, -0.026070542633533478, -0.480760782957077),
  //     rotation1: new Quaternion(-0.8761219382286072, -0.017853258177638054, -0.008835924789309502, -0.4816782474517822),
  //     rotationFinal: new Quaternion(-0.47340238094329834, -0.0706619843840599, 0.0203414149582386, 0.87777179479599),
  //     boneParentQuaternion: new Quaternion(
  //       -0.9960752129554749,
  //       -0.0717119351029396,
  //       -0.051414649933576584,
  //       -0.006963543593883514
  //     )
  //   },
  //   head: {
  //     rootQuaternion: new Quaternion(
  //       0.21981044113636017,
  //       -0.24237382411956787,
  //       0.013499671593308449,
  //       0.9448577761650085
  //     ),
  //     childRotation: new Quaternion(0.34075674414634705, -0.23856309056282043, 0.04488848149776459, 0.9082719087600708),
  //     rotation0: new Quaternion(0.23243141174316406, -0.02831265516579151, 0.02757553569972515, 0.9718096256256104),
  //     rotation1: new Quaternion(0.2326979637145996, -0.028849102556705475, 0.019845880568027496, 0.9719186425209045),
  //     rotationFinal: new Quaternion(0.010649281553924084, 0.2095302939414978, -0.04442760348320007, 0.9767343401908875)
  //   }
  // }

  const feetAndHead = ['foot_l', 'foot_r', 'head']
  feetAndHead.forEach((boneName)=>{
    it(`Can apply look/twist ${boneName}`, ()=>{
    // --- check that IKPose is correct
    {
      expectedIKPose = adoptIKPose(ikposeData)
      const expected: IKPoseLookTwist = expectedIKPose[boneName]
      const computed: IKPoseLookTwist = ikPose[boneName]
      assertVec3Equals(computed.lookDirection, expected.lookDirection, 4)
      assertVec3Equals(computed.twistDirection, expected.twistDirection, 4)
    }

    const targetAnimBonesStates = adoptBones(poseBonesWithAppliedHipLegsSpine)
    applyTestPoseState(targetRig.pose, targetAnimBonesStates)

    applyLookTwist(ikPose, targetRig, boneName, FORWARD, UP)

    // --- apply pose to skeleton bones
    applyPoseToRig(targetRig)

    const applied = targetRig.pose.bones[targetRig.points[boneName].index]
    const expected = expectedState[targetRig.points[boneName].index]

    assertVec3Equals(applied.local.position, expected.local.position, 4)
    assertQuaternionEquals(applied.local.quaternion, expected.local.quaternion, 2)

    applied.bone.getWorldPosition(boneWorldPosition)
    applied.bone.getWorldQuaternion(boneWorldRotation)
    applied.bone.getWorldScale(boneWorldScale)
    worldToModel(boneWorldPosition, boneWorldRotation, boneWorldScale, targetMeshTransform)

    assertVec3Equals(boneWorldPosition, expected.world.position, 4)
    assertQuaternionEquals(boneWorldRotation, expected.world.quaternion, 2)
    })
  })

  it('Can applyIKRig', () => {
    applyIKPoseToIKRig(targetRig, ikPose)

    targetRig.pose.bones.forEach((boneState) => {
      const expected = expectedState[boneState.idx]
      // console.log('-- pose bone -- name:', boneState.name)
      assertNumberEquals(boneState.length, expected.length, 4)
      assertVec3Equals(boneState.bone.position, expected.local.position)

      boneState.bone.getWorldPosition(boneWorldPosition)
      boneState.bone.getWorldQuaternion(boneWorldRotation)
      boneState.bone.getWorldScale(boneWorldScale)
      worldToModel(boneWorldPosition, boneWorldRotation, boneWorldScale, targetMeshTransform)

      assertVec3Equals(boneWorldPosition, expected.world.position, 4)
      assertQuaternionEquals(boneWorldRotation, expected.world.quaternion, 2)
    })
  })
})
