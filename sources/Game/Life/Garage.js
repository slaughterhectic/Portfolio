import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { groundAt } from './Npcs.js'
import { mergeStatic } from './merge.js'
import { parkedVehicles } from '../../data/life.js'

/**
 * Every vehicle of the island.
 * There is a single physical vehicle: taking a parked one moves the physics there,
 * swaps the visual and the handling, and leaves the previous one parked where it stood.
 */
export class Garage
{
    // Height of the physical chassis above the ground when resting
    static REST = 0.98

    static TYPES = {
        default:   { label: 'Enter', handling: { topSpeed: 5,   topSpeedBoost: 40, engineForceAmplitude: 300, steeringAmplitude: 0.5 } },
        sports:    { label: 'Enter', node: 'veh_sports',    sound: { volume: 1.15, rate: 1.25 }, handling: { topSpeed: 6.5, topSpeedBoost: 48, engineForceAmplitude: 340, steeringAmplitude: 0.5 } },
        police:    { label: 'Enter', node: 'veh_police',    sound: { volume: 1, rate: 1.1 }, handling: { topSpeed: 6,   topSpeedBoost: 44, engineForceAmplitude: 330, steeringAmplitude: 0.5 } },
        suv:       { label: 'Enter', node: 'veh_suv',       sound: { volume: 0.9, rate: 0.85 }, handling: { topSpeed: 5,   topSpeedBoost: 36, engineForceAmplitude: 310, steeringAmplitude: 0.48 } },
        pickup:    { label: 'Enter', node: 'veh_pickup',    sound: { volume: 1, rate: 0.72 }, handling: { topSpeed: 4.8, topSpeedBoost: 34, engineForceAmplitude: 310, steeringAmplitude: 0.46 } },
        motorbike: { label: 'Ride',  node: 'veh_motorbike', rider: { x: - 0.18, y: 0.74 }, sound: { volume: 0.9, rate: 1.65 }, handling: { topSpeed: 6.5, topSpeedBoost: 48, engineForceAmplitude: 320, steeringAmplitude: 0.56 } },
        vespa:     { label: 'Ride',  node: 'veh_vespa',     rider: { x: - 0.28, y: 0.72 }, sound: { volume: 0.6, rate: 2.1 }, handling: { topSpeed: 4.2, topSpeedBoost: 20, engineForceAmplitude: 240, steeringAmplitude: 0.58 } },
        bicycle:   { label: 'Ride',  node: 'veh_bicycle',   rider: { x: - 0.3,  y: 0.88 }, sound: { volume: 0, rate: 1 }, handling: { topSpeed: 2.6, topSpeedBoost: 7.5, engineForceAmplitude: 170, steeringAmplitude: 0.6 } },
    }

    constructor()
    {
        this.game = Game.getInstance()

        this.parked = []
        this.activeType = 'default'
        this.activeVisual = null
        this.visibleDistance = 36
        this.wheelAngle = 0
        this.steer = 0

        this.setTemplates()

        for(const [ type, x, z, yaw ] of parkedVehicles)
        {
            const spot = this.findFreeSpot(x, z, yaw)

            if(spot)
                this.park(type, spot[0], spot[1], yaw)
        }

        this.game.player.events.on('modeChange', (mode) =>
        {
            this.updateRider(mode)
        })

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 8)
    }

    setTemplates()
    {
        this.templates = new Map()

        const gltf = this.game.resources.vehiclesModel
        const scene = gltf.scenes.find((_scene) => _scene.children.some((child) => child.name.startsWith('veh_'))) ?? gltf.scene

        this.game.materials.updateObject(scene)

        scene.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.castShadow = true
                child.receiveShadow = true
            }
        })

        for(const [ name, type ] of Object.entries(Garage.TYPES))
        {
            if(!type.node)
                continue

            this.templates.set(name, scene.children.find((child) => child.name === type.node))
        }
    }

    /**
     * Visual: outer group follows the chassis (position + rotation), +X is forward
     */
    createVisual(typeName)
    {
        const type = Garage.TYPES[typeName]
        const visual = { type: typeName, group: new THREE.Group(), wheels: [] }

        if(typeName === 'default')
        {
            // Static copy of the original vehicle
            const copy = this.game.world.visualVehicle.parts.chassis.clone(true)
            copy.position.set(0, 0, 0)
            copy.quaternion.identity()
            copy.visible = true
            visual.group.add(copy)
        }
        else
        {
            // Models face +Z and stand on the ground, the vehicle faces +X
            const inner = new THREE.Group()
            inner.rotation.y = Math.PI * 0.5
            inner.position.y = - Garage.REST
            inner.add(this.templates.get(typeName).clone(true))

            inner.updateMatrixWorld(true)
            inner.traverse((child) =>
            {
                if(child.isMesh && child.name.match(/wheel/i))
                {
                    // Pivot the wheel on its own axle (done once per shared geometry)
                    const geometry = child.geometry

                    if(!geometry.userData.wheel)
                    {
                        geometry.computeBoundingBox()
                        const center = geometry.boundingBox.getCenter(new THREE.Vector3())
                        const size = geometry.boundingBox.getSize(new THREE.Vector3()).toArray()

                        // The axle is the axis whose two other dimensions are the same (the diameter)
                        let axis = 0
                        let best = Infinity
                        for(let i = 0; i < 3; i++)
                        {
                            const difference = Math.abs(size[(i + 1) % 3] - size[(i + 2) % 3])

                            if(difference < best)
                            {
                                best = difference
                                axis = i
                            }
                        }

                        geometry.translate(- center.x, - center.y, - center.z)
                        geometry.userData.wheel = {
                            center,
                            axis: new THREE.Vector3().setComponent(axis, 1),
                            radius: size[(axis + 1) % 3] * 0.5
                        }
                    }

                    const wheel = geometry.userData.wheel
                    child.position.add(wheel.center.clone().multiply(child.scale).applyQuaternion(child.quaternion))

                    const scale = child.getWorldScale(new THREE.Vector3()).y
                    visual.wheels.push({ object: child, axis: wheel.axis, radius: Math.max(wheel.radius * scale, 0.1) })
                }
            })

            visual.group.add(inner)
        }

        return visual
    }

    /**
     * Free spot for a parked vehicle around (x, z)
     */
    findFreeSpot(x, z, yaw)
    {
        const world = this.game.physics.world
        const shape = new this.game.RAPIER.Cuboid(1.55, 0.4, 0.95)
        const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)

        for(let radius = 0; radius <= 6; radius += 1)
        {
            const steps = radius === 0 ? 1 : 10

            for(let i = 0; i < steps; i++)
            {
                const angle = i / steps * Math.PI * 2
                const px = x + Math.cos(angle) * radius
                const pz = z + Math.sin(angle) * radius

                // Flat dry land under the whole vehicle
                let flat = true
                for(const [ dx, dz ] of [ [ 0, 0 ], [ 1.4, 0.8 ], [ 1.4, - 0.8 ], [ - 1.4, 0.8 ], [ - 1.4, - 0.8 ] ])
                {
                    const offset = new THREE.Vector3(dx, 0, dz).applyQuaternion(quaternion)
                    const y = groundAt(px + offset.x, pz + offset.z, - 10)

                    if(y < - 0.15 || y > 0.25)
                    {
                        flat = false
                        break
                    }
                }

                if(!flat)
                    continue

                let blocked = false
                world.intersectionsWithShape({ x: px, y: 0.95, z: pz }, quaternion, shape, () =>
                {
                    blocked = true
                    return false
                })

                if(!blocked)
                    return [ px, pz ]
            }
        }

        return null
    }

    park(typeName, x, z, yaw)
    {
        const prop = {}
        prop.type = typeName
        prop.yaw = yaw
        prop.position = new THREE.Vector3(x, groundAt(x, z), z)
        prop.visual = this.createVisual(typeName)

        const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
        prop.visual.group.position.set(x, prop.position.y + Garage.REST, z)
        prop.visual.group.quaternion.copy(quaternion)
        // Parked vehicles don't move: one mesh per material
        mergeStatic(prop.visual.group)
        this.game.scene.add(prop.visual.group)

        const narrow = !!Garage.TYPES[typeName].rider
        prop.object = this.game.objects.add(null, {
            type: 'fixed',
            category: 'floor',
            position: { x, y: prop.position.y + 0.6, z },
            rotation: quaternion,
            colliders: [ { shape: 'cuboid', parameters: [ narrow ? 0.95 : 1.4, 0.5, narrow ? 0.25 : 0.7 ] } ]
        })

        this.parked.push(prop)

        return prop
    }

    unpark(prop)
    {
        const index = this.parked.indexOf(prop)

        if(index !== - 1)
            this.parked.splice(index, 1)

        prop.visual.group.removeFromParent()

        // Remove the collider for good
        const physics = this.game.physics
        const physical = prop.object.physical
        const physicalIndex = physics.physicals.indexOf(physical)

        if(physicalIndex !== - 1)
            physics.physicals.splice(physicalIndex, 1)

        this.game.objects.list.forEach((value, key) =>
        {
            if(value === prop.object)
                this.game.objects.list.delete(key)
        })

        physics.world.removeRigidBody(physical.body)
    }

    getNearest(position, reach)
    {
        let nearest = null
        let nearestDistance = reach

        for(const prop of this.parked)
        {
            const distance = Math.hypot(prop.position.x - position.x, prop.position.z - position.z)

            if(distance < nearestDistance)
            {
                nearest = prop
                nearestDistance = distance
            }
        }

        return nearest ? { prop: nearest, distance: nearestDistance } : null
    }

    /**
     * Take a parked vehicle: the one driven until now stays parked where it is
     */
    take(prop)
    {
        const vehicle = this.game.physicalVehicle
        const previousType = this.activeType
        const previous = { x: vehicle.position.x, z: vehicle.position.z, yaw: vehicle.yRotation ?? 0 }
        const target = { type: prop.type, position: prop.position.clone(), yaw: prop.yaw }

        this.unpark(prop)

        // Physics to the new vehicle
        vehicle.moveTo({ x: target.position.x, y: target.position.y + Garage.REST + 0.15, z: target.position.z }, target.yaw)

        // The previous one becomes a parked vehicle
        this.park(previousType, previous.x, previous.z, previous.yaw)

        this.setActive(target.type)
    }

    setActive(typeName)
    {
        this.activeType = typeName

        const vehicle = this.game.physicalVehicle
        const type = Garage.TYPES[typeName]
        Object.assign(vehicle, type.handling)

        // Visual
        if(this.activeVisual)
        {
            this.activeVisual.group.removeFromParent()
            this.activeVisual = null
        }

        const visualVehicle = this.game.world.visualVehicle
        const isDefault = typeName === 'default'

        visualVehicle.parts.chassis.visible = isDefault

        if(visualVehicle.antenna?.head)
            visualVehicle.antenna.head.visible = isDefault

        if(!isDefault)
        {
            this.activeVisual = this.createVisual(typeName)
            this.game.scene.add(this.activeVisual.group)
        }
    }

    /**
     * Riders are visible on bikes
     */
    updateRider(mode)
    {
        const humanoid = this.game.player.foot.humanoid
        const rider = Garage.TYPES[this.activeType].rider

        if(mode === 'vehicle' && rider && this.activeVisual)
        {
            this.activeVisual.group.add(humanoid.root)
            humanoid.root.position.set(0, 0, 0)
            humanoid.root.rotation.set(0, 0, 0)
            humanoid.root.visible = true
            humanoid.play('Riding_Loop', 0)
            humanoid.update(0)

            // Put the hips on the saddle: rider.x / rider.y are the saddle, measured from the ground
            humanoid.root.updateMatrixWorld(true)
            const hips = humanoid.root.worldToLocal(humanoid.hips.getWorldPosition(new THREE.Vector3()))
            humanoid.root.position.set(rider.x - hips.x, - Garage.REST + rider.y - hips.y + 0.06, - hips.z)
            this.riding = true
        }
        else
        {
            this.riding = false

            if(humanoid.root.parent !== this.game.scene)
                this.game.scene.add(humanoid.root)
        }
    }

    update()
    {
        const vehicle = this.game.physicalVehicle
        const delta = this.game.ticker.delta

        // Active vehicle
        if(this.activeVisual)
        {
            this.activeVisual.group.position.copy(vehicle.position)
            this.activeVisual.group.quaternion.copy(vehicle.quaternion)

            const inVehicle = this.game.player.mode === 'vehicle'
            const speed = inVehicle ? (vehicle.forwardSpeed || 0) : 0
            const targetSteer = inVehicle ? this.game.player.steering * 0.45 : 0
            this.steer += (targetSteer - this.steer) * Math.min(1, delta * 10)

            for(const wheel of this.activeVisual.wheels)
                wheel.object.rotateOnAxis(wheel.axis, speed * this.game.ticker.deltaScaled / wheel.radius)

            if(this.riding)
                this.game.player.foot.humanoid.update(delta)
        }

        // Parked ones: only drawn when around
        const focus = this.game.view.focusPoint.position

        for(const prop of this.parked)
            prop.visual.group.visible = Math.hypot(prop.position.x - focus.x, prop.position.z - focus.z) < this.visibleDistance
    }
}
