import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Humanoid } from './Humanoid.js'
import { groundAt } from './Npcs.js'
import { smallestAngle } from '../utilities/maths.js'

/**
 * The player's body when not in the vehicle.
 * Kinematic capsule driven by Rapier's character controller.
 */
export class Foot
{
    constructor()
    {
        this.game = Game.getInstance()

        this.active = false
        this.height = 1.25
        this.radius = 0.26
        this.walkSpeed = 3.1
        this.sprintSpeed = 5.6
        this.jumpVelocity = 6.2
        this.gravity = - 19

        this.position = new THREE.Vector3()
        this.velocity = new THREE.Vector3()
        this.verticalVelocity = 0
        this.grounded = true
        this.airTime = 0
        this.angle = 0
        this.targetAngle = 0
        this.speed = 0
        this.locked = false
        this.emote = null
        this.punchUntil = 0
        this.punchStart = 0
        this.punchHit = null

        // Screen-relative axes (the camera never rotates around Y)
        const theta = this.game.view.spherical.theta
        this.screenUp = new THREE.Vector3(- Math.sin(theta), 0, - Math.cos(theta))
        this.screenRight = new THREE.Vector3(Math.cos(theta), 0, - Math.sin(theta))

        this.setVisual()
        this.setPhysical()

        this.desired = new THREE.Vector3()
    }

    setVisual()
    {
        this.humanoid = new Humanoid({
            shirt: '#ff5a36',
            pants: '#262b45',
            shoes: '#ffffff',
            hair: '#17110e',
        })
        this.humanoid.root.visible = false
        this.game.scene.add(this.humanoid.root)
    }

    setPhysical()
    {
        const RAPIER = this.game.RAPIER
        const world = this.game.physics.world

        const halfHeight = this.height * 0.5 - this.radius
        this.centerOffset = this.height * 0.5

        this.body = world.createRigidBody(
            RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 50, 0)
        )
        this.collider = world.createCollider(
            RAPIER.ColliderDesc.capsule(halfHeight, this.radius)
                .setCollisionGroups(this.game.physics.categories.object)
                .setFriction(0),
            this.body
        )
        this.body.setEnabled(false)

        this.controller = world.createCharacterController(0.03)
        this.controller.setUp({ x: 0, y: 1, z: 0 })
        this.controller.enableAutostep(0.35, 0.12, true)
        this.controller.enableSnapToGround(0.3)
        this.controller.setMaxSlopeClimbAngle(55 * Math.PI / 180)
        this.controller.setMinSlopeSlideAngle(65 * Math.PI / 180)
        this.controller.setApplyImpulsesToDynamicBodies(true)
        this.controller.setCharacterMass(0.12)

        this.shape = new RAPIER.Capsule(halfHeight, this.radius)
    }

    /**
     * Is there room for the capsule with its feet at this position?
     */
    isFree(position)
    {
        const center = { x: position.x, y: position.y + this.centerOffset + 0.15, z: position.z }
        let blocked = false

        this.game.physics.world.intersectionsWithShape(
            center,
            { x: 0, y: 0, z: 0, w: 1 },
            this.shape,
            () =>
            {
                blocked = true
                return false
            },
            undefined,
            this.game.physics.categories.object,
            this.collider
        )

        return !blocked
    }

    activate(position, angle = 0)
    {
        this.active = true
        this.position.copy(position)
        this.velocity.set(0, 0, 0)
        this.verticalVelocity = 0
        this.angle = angle
        this.targetAngle = angle
        this.emote = null

        this.body.setEnabled(true)
        this.body.setTranslation({ x: position.x, y: position.y + this.centerOffset, z: position.z }, true)

        this.humanoid.root.visible = true
        this.humanoid.root.position.copy(position)
        this.humanoid.root.rotation.y = angle
        this.humanoid.play('Idle_Loop', 0)
    }

    deactivate()
    {
        this.active = false
        this.body.setEnabled(false)
        this.humanoid.root.visible = false
    }

    teleport(position, angle = null)
    {
        this.position.copy(position)
        this.verticalVelocity = 0
        this.velocity.set(0, 0, 0)
        this.body.setTranslation({ x: position.x, y: position.y + this.centerOffset, z: position.z }, true)
        this.humanoid.root.position.copy(position)

        if(angle !== null)
        {
            this.angle = angle
            this.targetAngle = angle
            this.humanoid.root.rotation.y = angle
        }
    }

    /**
     * One-shot punch: returns true when it starts, the hit lands a moment later
     */
    punch(onHit)
    {
        const now = this.game.ticker.elapsed

        if(!this.active || this.locked || !this.grounded || now < this.punchUntil)
            return false

        this.punchCount = (this.punchCount ?? 0) + 1
        this.punchName = this.punchCount % 2 ? 'Punch_Jab' : 'Punch_Cross'
        this.punchStart = now
        this.punchUntil = now + 0.5
        this.punchHit = onHit
        this.emote = null
        this.humanoid.currentName = null

        return true
    }

    faceTowards(x, z)
    {
        this.targetAngle = Math.atan2(- (z - this.position.z), x - this.position.x)
    }

    /**
     * moveX / moveY are screen-relative (-1..1), run before the physics step
     */
    updatePrePhysics(moveX, moveY, sprint, jump)
    {
        if(!this.active)
            return

        const delta = this.game.ticker.delta

        if(this.locked || this.game.ticker.elapsed < this.punchUntil)
        {
            moveX = 0
            moveY = 0
            jump = false
        }

        // Direction
        this.desired.set(0, 0, 0)
        this.desired.addScaledVector(this.screenRight, moveX)
        this.desired.addScaledVector(this.screenUp, moveY)

        const strength = Math.min(1, this.desired.length())
        const moving = strength > 0.1

        if(moving)
        {
            this.desired.normalize()
            this.targetAngle = Math.atan2(- this.desired.z, this.desired.x)
            this.emote = null
        }

        // Horizontal velocity (eased so starts and stops are not abrupt)
        const targetSpeed = moving ? (sprint ? this.sprintSpeed : this.walkSpeed) * strength : 0
        const easing = 1 - Math.exp(- delta * (this.grounded ? 14 : 4))
        this.velocity.x += (this.desired.x * targetSpeed - this.velocity.x) * easing
        this.velocity.z += (this.desired.z * targetSpeed - this.velocity.z) * easing

        // Vertical
        if(this.grounded)
        {
            this.verticalVelocity = - 2

            if(jump)
            {
                this.verticalVelocity = this.jumpVelocity
                this.grounded = false
                this.emote = null
            }
        }
        else
        {
            this.verticalVelocity += this.gravity * delta
        }

        // Resolve against the world
        const translation = {
            x: this.velocity.x * delta,
            y: this.verticalVelocity * delta,
            z: this.velocity.z * delta
        }
        this.controller.computeColliderMovement(this.collider, translation, undefined, this.game.physics.categories.object)

        const movement = this.controller.computedMovement()
        const current = this.body.translation()

        // No walking into the water: the step is cancelled when the ground ahead is below the shore
        if(movement.x !== 0 || movement.z !== 0)
        {
            const ahead = groundAt(current.x + movement.x * 3, current.z + movement.z * 3, 0)

            if(ahead < - 0.28)
            {
                movement.x = 0
                movement.z = 0
                this.velocity.x = 0
                this.velocity.z = 0
            }
        }

        this.body.setNextKinematicTranslation({
            x: current.x + movement.x,
            y: current.y + movement.y,
            z: current.z + movement.z
        })

        const wasGrounded = this.grounded
        this.grounded = this.controller.computedGrounded() && this.verticalVelocity <= 0

        if(this.grounded)
            this.airTime = 0
        else
            this.airTime += delta

        this.justLanded = this.grounded && !wasGrounded
        this.speed = Math.hypot(movement.x, movement.z) / Math.max(delta, 0.0001)
        this.sprinting = sprint && moving
    }

    updatePostPhysics()
    {
        if(!this.active)
            return

        const delta = this.game.ticker.delta
        const translation = this.body.translation()

        this.position.set(translation.x, translation.y - this.centerOffset, translation.z)

        // Rotation
        const angleDelta = smallestAngle(this.angle, this.targetAngle)
        this.angle += angleDelta * (1 - Math.exp(- delta * 14))

        this.humanoid.root.position.copy(this.position)
        this.humanoid.root.rotation.y = this.angle

        // Punch: the hit lands a little after the start of the swing
        const now = this.game.ticker.elapsed

        if(this.punchHit && now > this.punchStart + 0.16)
        {
            const callback = this.punchHit
            this.punchHit = null
            callback()
        }

        // Animation
        if(now < this.punchUntil)
        {
            this.humanoid.play(this.punchName, 0.06, { once: true, timeScale: 1.5 })
        }
        else if(this.emote)
        {
            this.humanoid.play(this.emote, 0.25)
        }
        else if(!this.grounded && this.airTime > 0.12)
        {
            this.humanoid.play('Jump_Loop', 0.15)
        }
        else if(this.speed > 0.4)
        {
            if(this.sprinting)
                this.humanoid.play('Sprint_Loop', 0.18, { timeScale: 1.05 })
            else
                this.humanoid.play('Jog_Fwd_Loop', 0.18, { timeScale: Math.max(0.6, this.speed / this.walkSpeed) })
        }
        else
        {
            this.humanoid.play('Idle_Loop', 0.22)
        }

        this.humanoid.update(delta)
    }
}
