import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Humanoid } from './Humanoid.js'
import { InteractivePoints } from '../InteractivePoints.js'
import { smallestAngle } from '../utilities/maths.js'
import { npcs as npcsData, walkers as walkersData } from '../../data/life.js'

export function groundAt(x, z, fallback = 0)
{
    const game = Game.getInstance()
    const ray = new game.RAPIER.Ray({ x, y: 12, z }, { x: 0, y: - 1, z: 0 })
    const hit = game.physics.world.castRay(ray, 30, true, undefined, undefined, game.player?.foot?.collider, game.physicalVehicle?.chassis.physical.body)

    if(!hit)
        return fallback

    const y = 12 - hit.timeOfImpact

    // Something tall is in the way (a roof, a tree) => Don't climb on it
    return y > 1.5 ? fallback : y
}

/**
 * Closest spot around (x, z) that is on dry land and not inside scenery
 */
export function findFreeSpot(x, z)
{
    const game = Game.getInstance()
    const foot = game.player.foot

    for(let radius = 0; radius <= 4; radius += 0.8)
    {
        const steps = radius === 0 ? 1 : 10

        for(let i = 0; i < steps; i++)
        {
            const angle = i / steps * Math.PI * 2
            const px = x + Math.cos(angle) * radius
            const pz = z + Math.sin(angle) * radius
            const py = groundAt(px, pz, - 10)

            if(py < - 0.25 || py > 0.6)
                continue

            if(foot.isFree(new THREE.Vector3(px, py, pz)))
                return [ px, pz ]
        }
    }

    return [ x, z ]
}

export class Npcs
{
    constructor()
    {
        this.game = Game.getInstance()

        this.items = new Map()
        this.walkers = []
        this.visibleDistance = 34
        this.defaultAngle = - Math.PI * 0.25
        this.talkingTo = null

        for(const data of npcsData)
            this.add(data)

        for(const data of walkersData)
            this.addWalker(data)

        this.game.life.dialog.events.on('close', () =>
        {
            this.talkingTo = null
        })

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    add(data)
    {
        const npc = {}
        npc.data = data
        npc.id = data.id
        const [ x, z ] = findFreeSpot(data.position[0], data.position[1])
        npc.position = new THREE.Vector3(x, groundAt(x, z), z)
        npc.angle = this.defaultAngle
        npc.targetAngle = npc.angle
        npc.near = false

        // Visual
        npc.humanoid = new Humanoid(data.look)
        npc.humanoid.root.position.copy(npc.position)
        npc.humanoid.root.rotation.y = npc.angle
        npc.humanoid.mixer.setTime(Math.random() * 4)
        this.game.scene.add(npc.humanoid.root)

        // Physical
        npc.object = this.game.objects.add(null, {
            type: 'fixed',
            position: { x: npc.position.x, y: npc.position.y + 0.65, z: npc.position.z },
            category: 'floor',
            colliders: [ { shape: 'cylinder', parameters: [ 0.65, 0.32 ] } ]
        })

        // Interaction
        const pointPosition = npc.position.clone()
        pointPosition.y += 2.05

        npc.interactivePoint = this.game.interactivePoints.create(
            pointPosition,
            `Talk to ${data.name}`,
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.talk(npc)
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        this.items.set(npc.id, npc)
    }

    addWalker(data)
    {
        const walker = {}
        walker.path = data.path.map(([ x, z ]) => new THREE.Vector3(x, groundAt(x, z), z))
        walker.index = 0
        walker.pause = Math.random() * 2
        walker.speed = 1.15 + Math.random() * 0.25
        walker.position = walker.path[0].clone()
        walker.angle = 0

        walker.humanoid = new Humanoid(data.look, 0.68)
        walker.humanoid.root.position.copy(walker.position)
        this.game.scene.add(walker.humanoid.root)

        this.walkers.push(walker)
    }

    /**
     * Health bar: two flat planes above the head, turned towards the (fixed) camera
     */
    createBar(target)
    {
        if(!this.barGeometry)
        {
            this.barGeometry = new THREE.PlaneGeometry(1, 1)
            this.barGeometry.translate(0.5, 0, 0)
            this.barBackMaterial = new THREE.MeshBasicNodeMaterial({ color: '#1d1721', depthTest: false, transparent: true })
            this.barFillMaterial = new THREE.MeshBasicNodeMaterial({ color: '#7dff6b', depthTest: false, transparent: true })
            this.barLowMaterial = new THREE.MeshBasicNodeMaterial({ color: '#ff5a4d', depthTest: false, transparent: true })
        }

        const bar = {}
        bar.group = new THREE.Group()
        bar.group.rotation.reorder('YXZ')
        bar.group.rotation.set(- Math.PI * 0.15, Math.PI * 0.25, 0)
        bar.group.visible = false
        bar.group.userData.preventPreRender = true

        const back = new THREE.Mesh(this.barGeometry, this.barBackMaterial)
        back.scale.set(1.08, 0.2, 1)
        back.position.x = - 0.54
        back.renderOrder = 9

        bar.fill = new THREE.Mesh(this.barGeometry, this.barFillMaterial)
        bar.fill.scale.set(1, 0.12, 1)
        bar.fill.position.set(- 0.5, 0, 0.01)
        bar.fill.renderOrder = 10

        bar.group.add(back, bar.fill)
        this.game.scene.add(bar.group)

        target.bar = bar
    }

    /**
     * A punch from `position` towards `angle`: the closest person in front takes it
     */
    hit(position, angle)
    {
        const forwardX = Math.cos(angle)
        const forwardZ = - Math.sin(angle)
        let target = null
        let targetDistance = 1.75

        for(const person of [ ...this.items.values(), ...this.walkers ])
        {
            if(person.down)
                continue

            const dx = person.position.x - position.x
            const dz = person.position.z - position.z
            const distance = Math.hypot(dx, dz)

            if(distance < targetDistance && (dx * forwardX + dz * forwardZ) / Math.max(distance, 0.001) > 0.25)
            {
                target = person
                targetDistance = distance
            }
        }

        if(!target)
            return false

        this.damage(target, 25)

        return true
    }

    damage(target, amount)
    {
        const now = this.game.ticker.elapsed

        if(target.down)
            return

        if(!target.bar)
            this.createBar(target)

        target.health = Math.max(0, (target.health ?? 100) - amount)
        target.barUntil = now + 5
        target.hitUntil = now + 0.45
        target.bar.fill.scale.x = Math.max(0.001, target.health / 100)
        target.bar.fill.material = target.health <= 25 ? this.barLowMaterial : this.barFillMaterial
        target.humanoid.currentName = null

        try
        {
            this.game.audio.groups.get('hitDefault').playRandomNext(6, target.position)
        }
        catch(error) {}

        // Knocked out: back on their feet a few seconds later, vehicles can pass meanwhile
        if(target.health <= 0)
        {
            target.down = true
            target.reviveAt = now + 9
            target.interactivePoint?.hide()
            target.object?.physical.body.setEnabled(false)
        }
    }

    /**
     * Driving into people hurts them, the faster the worse
     */
    updateVehicleHits()
    {
        const player = this.game.player

        if(player.mode !== 'vehicle')
            return

        const vehicle = this.game.physicalVehicle
        const now = this.game.ticker.elapsed

        // Speed just before the impact (the collision itself stops the vehicle)
        this.recentSpeed = Math.max(vehicle.xzSpeed || 0, (this.recentSpeed ?? 0) - this.game.ticker.delta * 12)
        const speed = this.recentSpeed

        // Direction of travel, kept from just before the impact too
        if(!this.vehicleHeading)
            this.vehicleHeading = { x: 1, z: 0 }

        if((vehicle.xzSpeed || 0) > 1.5)
        {
            const length = Math.hypot(vehicle.velocity.x, vehicle.velocity.z) || 1
            this.vehicleHeading.x = vehicle.velocity.x / length
            this.vehicleHeading.z = vehicle.velocity.z / length
        }

        if(speed < 4)
            return

        for(const person of [ ...this.items.values(), ...this.walkers ])
        {
            if(person.down || now < (person.runOverUntil ?? 0))
                continue

            // Only a real impact counts: close to the bumper and driving straight at them
            const dx = person.position.x - vehicle.position.x
            const dz = person.position.z - vehicle.position.z
            const distance = Math.hypot(dx, dz)
            const heading = this.vehicleHeading
            const towards = distance > 0.001 ? (dx * heading.x + dz * heading.z) / distance : 0

            if(distance < 2.35 && towards > 0.75)
            {
                person.runOverUntil = now + 0.7
                this.damage(person, Math.min(100, 20 + speed * 6))
            }
        }
    }

    updateHealth(person)
    {
        const now = this.game.ticker.elapsed

        if(person.down && now > person.reviveAt)
        {
            person.down = false
            person.health = 100
            person.humanoid.currentName = null
            person.interactivePoint?.show()
            person.object?.physical.body.setEnabled(true)

            if(person.bar)
                person.bar.fill.scale.x = 1
        }

        if(person.bar)
        {
            const visible = now < person.barUntil && person.humanoid.root.visible
            person.bar.group.visible = visible

            if(visible)
                person.bar.group.position.set(person.position.x, person.position.y + 1.72, person.position.z)
        }

        // Animation override while hit or down
        if(person.down)
        {
            person.humanoid.play('Death01', 0.1, { once: true })
            return true
        }

        if(now < person.hitUntil)
        {
            person.humanoid.play('Hit_Chest', 0.05, { once: true, timeScale: 1.3 })
            return true
        }

        return false
    }

    talk(npc)
    {
        const life = this.game.life

        if(life.dialog.isOpen || npc.down)
            return

        this.talkingTo = npc

        // On foot => Face the person
        if(this.game.player.mode === 'foot')
            this.game.player.foot.faceTowards(npc.position.x, npc.position.z)

        const override = life.missions.getGreeting(npc.id)

        life.dialog.open({
            id: npc.id,
            name: npc.data.name,
            role: npc.data.role,
            greeting: override ?? npc.data.greeting,
            topics: () => [ ...life.missions.getTopics(npc.id), ...npc.data.topics ],
        })

        life.events.trigger('talk', [ npc.id ])
    }

    update()
    {
        const delta = this.game.ticker.delta
        const focus = this.game.view.focusPoint.position
        const player = this.game.player.position

        this.updateVehicleHits()

        for(const npc of this.items.values())
        {
            const viewDistance = Math.hypot(npc.position.x - focus.x, npc.position.z - focus.z)
            const visible = viewDistance < this.visibleDistance

            npc.humanoid.root.visible = visible

            if(!visible)
                continue

            // Turn towards the player when close
            const playerDistance = Math.hypot(npc.position.x - player.x, npc.position.z - player.z)
            const near = playerDistance < 5.5

            npc.targetAngle = near ? Math.atan2(- (player.z - npc.position.z), player.x - npc.position.x) : this.defaultAngle
            npc.angle += smallestAngle(npc.angle, npc.targetAngle) * (1 - Math.exp(- delta * 6))
            npc.humanoid.root.rotation.y = npc.angle

            if(!this.updateHealth(npc))
                npc.humanoid.play(this.talkingTo === npc ? 'Idle_Talking_Loop' : 'Idle_Loop', 0.3)

            npc.humanoid.update(delta)
        }

        for(const walker of this.walkers)
        {
            const viewDistance = Math.hypot(walker.position.x - focus.x, walker.position.z - focus.z)
            const visible = viewDistance < this.visibleDistance

            walker.humanoid.root.visible = visible

            // Hit or knocked out
            if(this.updateHealth(walker))
            {
                if(visible)
                {
                    walker.humanoid.root.position.copy(walker.position)
                    walker.humanoid.update(delta)
                }

                continue
            }

            // Keep strolling even when out of view (cheap), only animate when visible
            if(walker.pause > 0)
            {
                walker.pause -= delta

                if(visible)
                    walker.humanoid.play('Idle_Loop', 0.3)
            }
            else
            {
                const target = walker.path[walker.index]
                const dx = target.x - walker.position.x
                const dz = target.z - walker.position.z
                const distance = Math.hypot(dx, dz)

                // Give way to the player
                const blocked = Math.hypot(player.x - walker.position.x, player.z - walker.position.z) < 1.6

                if(distance < 0.15)
                {
                    walker.index = (walker.index + 1) % walker.path.length
                    walker.pause = 1 + Math.random() * 3
                }
                else if(!blocked)
                {
                    const step = Math.min(distance, walker.speed * delta)
                    walker.position.x += dx / distance * step
                    walker.position.z += dz / distance * step
                    walker.position.y = target.y

                    const targetAngle = Math.atan2(- dz, dx)
                    walker.angle += smallestAngle(walker.angle, targetAngle) * (1 - Math.exp(- delta * 8))
                }

                if(visible)
                    walker.humanoid.play(blocked ? 'Idle_Loop' : 'Walk_Loop', 0.3, { timeScale: 1.1 })
            }

            if(visible)
            {
                walker.humanoid.root.position.copy(walker.position)
                walker.humanoid.root.rotation.y = walker.angle
                walker.humanoid.update(delta)
            }
        }
    }
}
