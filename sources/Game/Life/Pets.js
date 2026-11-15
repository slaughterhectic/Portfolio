import * as THREE from 'three/webgpu'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { Game } from '../Game.js'
import { groundAt } from './Npcs.js'
import { smallestAngle } from '../utilities/maths.js'
import { pets as petsData } from '../../data/life.js'

/**
 * Dogs and cats living around the island.
 * Pet one (E) and it follows you, on foot or behind your vehicle. Pet it again and it stays.
 */
export class Pets
{
    static KINDS = {
        shiba: { resource: 'petShibaModel', height: 0.62, walk: 1.7, run: 7.5 },
        husky: { resource: 'petHuskyModel', height: 0.7,  walk: 1.7, run: 8 },
        cat:   { resource: 'petCatModel',   height: 0.4,  walk: 1.3, run: 6.5 },
    }

    constructor()
    {
        this.game = Game.getInstance()

        this.items = []
        this.near = null
        this.visibleDistance = 36
        this.projected = new THREE.Vector3()

        this.tamed = new Set()
        try
        {
            for(const id of JSON.parse(localStorage.getItem('lifePets') ?? '[]'))
                this.tamed.add(id)
        }
        catch(error) {}

        this.setTemplates()
        this.setPrompt()

        for(const data of petsData)
            this.add(data)

        this.game.inputs.events.on('interact', (action) =>
        {
            if(action.active && this.near && this.promptVisible && !this.game.life.dialog.isOpen)
                this.toggle(this.near)
        })

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    setTemplates()
    {
        this.templates = new Map()

        for(const [ name, kind ] of Object.entries(Pets.KINDS))
        {
            const gltf = this.game.resources[kind.resource]

            // Material names are generic ("Main", "Black"...): make them unique before they are shared by name
            gltf.scene.traverse((child) =>
            {
                if(child.isMesh && !child.material.name.startsWith(`pet_${name}_`))
                    child.material.name = `pet_${name}_${child.material.name}`
            })
            this.game.materials.updateObject(gltf.scene)

            // Real size of the model, skinning included
            gltf.scene.updateMatrixWorld(true)
            const box = new THREE.Box3().setFromObject(gltf.scene, true)
            const scale = kind.height / Math.max(0.0001, box.max.y - box.min.y)

            const find = (...suffixes) =>
            {
                for(const suffix of suffixes)
                {
                    const clip = gltf.animations.find((_clip) => _clip.name.endsWith(suffix))

                    if(clip)
                        return clip
                }

                return gltf.animations[0]
            }

            this.templates.set(name, {
                scene: gltf.scene,
                scale,
                lift: - box.min.y * scale,
                clips: { idle: find('Idle'), walk: find('Walk'), run: find('Gallop', 'Run', 'Walk') }
            })
        }
    }

    setPrompt()
    {
        this.prompt = document.createElement('div')
        this.prompt.className = 'vehicle-prompt is-anchored'
        this.prompt.innerHTML = '<span class="key">E</span><span class="label"></span>'
        this.promptLabel = this.prompt.querySelector('.label')
        this.game.domElement.append(this.prompt)
    }

    add(data)
    {
        const kind = Pets.KINDS[data.kind]
        const template = this.templates.get(data.kind)

        const pet = {}
        pet.data = data
        pet.kind = kind
        pet.home = new THREE.Vector3(data.position[0], 0, data.position[1])
        pet.position = pet.home.clone()
        pet.position.y = groundAt(pet.position.x, pet.position.z)
        pet.target = pet.position.clone()
        pet.angle = Math.random() * Math.PI * 2
        pet.pause = Math.random() * 3
        pet.following = this.tamed.has(data.id)
        pet.slot = this.items.length
        pet.state = null

        // Visual: +X is forward once turned
        pet.root = new THREE.Group()
        const model = cloneSkinned(template.scene)
        model.scale.setScalar(template.scale)
        model.position.y = template.lift
        model.rotation.y = Math.PI * 0.5
        model.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.castShadow = true
                child.receiveShadow = false
                child.frustumCulled = false
            }
        })
        pet.root.add(model)
        this.game.scene.add(pet.root)

        pet.mixer = new THREE.AnimationMixer(model)
        pet.actions = {}
        for(const [ name, clip ] of Object.entries(template.clips))
            pet.actions[name] = pet.mixer.clipAction(clip)

        this.items.push(pet)
    }

    play(pet, name)
    {
        if(pet.state === name)
            return

        const previous = pet.actions[pet.state]
        const next = pet.actions[name]

        if(previous && previous !== next)
            previous.fadeOut(0.2)

        if(previous !== next)
        {
            next.reset().setEffectiveWeight(1)

            if(previous)
                next.fadeIn(0.2)

            next.play()
        }

        pet.state = name
    }

    toggle(pet)
    {
        pet.following = !pet.following

        if(pet.following)
            this.tamed.add(pet.data.id)
        else
        {
            this.tamed.delete(pet.data.id)
            pet.home.copy(pet.position)
        }

        localStorage.setItem('lifePets', JSON.stringify([ ...this.tamed ]))

        this.game.notifications.show(/* html */`
            <div class="top"><div class="title">${pet.data.name}</div></div>
            <div class="bottom"><div class="description">${pet.following ? `${pet.data.name} is with you now and will follow you everywhere.` : `${pet.data.name} will wait here.`}</div></div>
        `, 'achievement', 3)
    }

    update()
    {
        const delta = this.game.ticker.delta
        const player = this.game.player
        const playerPosition = player.mode === 'foot' ? player.foot.position : this.game.physicalVehicle.position
        const focus = this.game.view.focusPoint.position
        const onFoot = player.mode === 'foot'

        let near = null
        let nearDistance = 1.9
        let followIndex = 0

        for(const pet of this.items)
        {
            const toPlayer = Math.hypot(playerPosition.x - pet.position.x, playerPosition.z - pet.position.z)
            let speed = 0

            if(pet.following)
            {
                // Left far behind (fast vehicle, respawn): catch up at once
                if(toPlayer > 32)
                {
                    pet.position.set(playerPosition.x - 2, 0, playerPosition.z - 2)
                    pet.position.y = groundAt(pet.position.x, pet.position.z, 0)
                }

                // Each one keeps its own place around the player
                const slotAngle = 2.2 + followIndex * 1.1
                const slotRadius = onFoot ? 1.5 : 3.2
                pet.target.set(playerPosition.x + Math.cos(slotAngle) * slotRadius, 0, playerPosition.z + Math.sin(slotAngle) * slotRadius)
                followIndex++

                const distance = Math.hypot(pet.target.x - pet.position.x, pet.target.z - pet.position.z)

                if(distance > 0.5)
                    speed = distance > 3 ? Math.min(pet.kind.run * (distance > 9 ? 1.6 : 1), distance * 2.2) : pet.kind.walk
            }
            else
            {
                // Strolling around its spot
                pet.pause -= delta

                if(pet.pause < 0)
                {
                    const angle = Math.random() * Math.PI * 2
                    const radius = Math.random() * 3
                    pet.target.set(pet.home.x + Math.cos(angle) * radius, 0, pet.home.z + Math.sin(angle) * radius)
                    pet.pause = 3 + Math.random() * 5
                }

                if(Math.hypot(pet.target.x - pet.position.x, pet.target.z - pet.position.z) > 0.3)
                    speed = pet.kind.walk * 0.7
            }

            // Move, staying on dry land
            if(speed > 0)
            {
                const dx = pet.target.x - pet.position.x
                const dz = pet.target.z - pet.position.z
                const distance = Math.hypot(dx, dz)
                const step = Math.min(distance, speed * delta)
                const x = pet.position.x + dx / distance * step
                const z = pet.position.z + dz / distance * step
                const y = groundAt(x, z, pet.position.y)

                if(y > - 0.3)
                {
                    pet.position.set(x, y, z)
                    pet.angle += smallestAngle(pet.angle, Math.atan2(- dz, dx)) * (1 - Math.exp(- delta * 10))
                }
                else
                {
                    speed = 0
                    pet.pause = 0
                }
            }
            else if(pet.following && onFoot && toPlayer < 4)
            {
                // Sitting around: look at the player
                pet.angle += smallestAngle(pet.angle, Math.atan2(- (playerPosition.z - pet.position.z), playerPosition.x - pet.position.x)) * (1 - Math.exp(- delta * 4))
            }

            // Visual, only when around
            const visible = Math.hypot(pet.position.x - focus.x, pet.position.z - focus.z) < this.visibleDistance
            pet.root.visible = visible

            if(visible)
            {
                pet.root.position.copy(pet.position)
                pet.root.rotation.y = pet.angle
                this.play(pet, speed === 0 ? 'idle' : (speed > pet.kind.walk * 1.5 ? 'run' : 'walk'))
                pet.mixer.update(delta)
            }

            if(onFoot && toPlayer < nearDistance)
            {
                near = pet
                nearDistance = toPlayer
            }
        }

        // Prompt above the closest pet
        this.near = near

        // One prompt at a time: a vehicle within reach takes priority
        const show = !!near && this.game.inputs.filters.has('wandering') && !this.game.interactivePoints.activeItem && this.game.player.prompt.state === null

        if(show)
        {
            const label = near.following ? `Tell ${near.data.name} to stay` : `Pet ${near.data.name}`

            if(this.promptLabel.textContent !== label)
                this.promptLabel.textContent = label

            this.projected.copy(near.position)
            this.projected.y += 1.25
            this.projected.project(this.game.view.camera)
            this.prompt.style.left = `${(this.projected.x * 0.5 + 0.5) * this.game.viewport.width}px`
            this.prompt.style.top = `${(- this.projected.y * 0.5 + 0.5) * this.game.viewport.height}px`
        }

        if(show !== this.promptVisible)
        {
            this.promptVisible = show
            this.prompt.classList.toggle('is-visible', show)
        }
    }
}
