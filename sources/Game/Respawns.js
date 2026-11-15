import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { spawn } from '../data/life.js'

export class Respawns
{
    constructor(defaultName = 'landing')
    {
        this.game = Game.getInstance()
        this.defaultName = defaultName

        this.setItems()
    }

    setItems()
    {
        this.items = new Map()

        for(const child of this.game.resources.respawnsReferencesModel.scene.children)
        {
            child.rotation.reorder('YXZ')

            let name = child.name.replace(/^respawn(.+)$/i, '$1')

            name = name.charAt(0).toLowerCase() + name.slice(1)

            const item = {
                name: name,
                position: new THREE.Vector3(
                    child.position.x,
                    4,
                    child.position.z
                ),
                rotation: child.rotation.y
            }

            this.items.set(name, item)
        }

        // Home: the game starts on the player, standing in his house (the intro light is centred here)
        this.items.set('home', {
            name: 'home',
            position: new THREE.Vector3(spawn.foot.x, 4, spawn.foot.z),
            rotation: spawn.vehicle.rotation,
            footOnly: true
        })

        // The vehicle waits outside
        this.items.set('driveway', {
            name: 'driveway',
            position: new THREE.Vector3(spawn.vehicle.x, 4, spawn.vehicle.z),
            rotation: spawn.vehicle.rotation
        })
    }

    getByName(name)
    {
        return this.items.get(name)
    }

    getDefault()
    {
        return this.items.get(this.defaultName)
    }

    getClosest(position)
    {
        let closestItem = null
        let closestDistance = Infinity

        this.items.forEach((item) =>
        {
            if(item.footOnly)
                return

            const distance = Math.hypot(item.position.x - position.x, item.position.z - position.z)

            if(distance < closestDistance)
            {
                closestDistance = distance
                closestItem = item
            }
        })

        return closestItem
    }
}