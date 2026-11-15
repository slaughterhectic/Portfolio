import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Events } from '../Events.js'
import { Player } from '../Player.js'
import { Dialog } from './Dialog.js'
import { Town } from './Town.js'
import { Missions } from './Missions.js'
import { Npcs, groundAt } from './Npcs.js'
import { Garage } from './Garage.js'
import { Pets } from './Pets.js'
import { spawn } from '../../data/life.js'

/**
 * Everything that turns the world into Gourav's life:
 * home, town, people, conversations and missions.
 */
export class Life
{
    constructor()
    {
        this.game = Game.getInstance()
        this.game.life = this

        this.events = new Events()
        this.dialog = new Dialog()
        this.town = new Town()
        this.ready = false

        // People and vehicles look for free ground with physics queries,
        // which only see the world once it has been stepped a few times
        this.game.ticker.wait(5, () =>
        {
            this.garage = new Garage()
            this.npcs = new Npcs()
            this.missions = new Missions()
            this.pets = new Pets()
            this.ready = true
        })
        this.startedAtHome = false

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    /**
     * The game starts on foot, inside the house, with the car parked outside
     */
    startAtHome()
    {
        const player = this.game.player
        const position = new THREE.Vector3(spawn.foot.x, 0, spawn.foot.z)
        position.y = Math.max(0.14, groundAt(spawn.foot.x, spawn.foot.z, 0.14))

        player.mode = Player.MODE_FOOT
        player.foot.activate(position, spawn.foot.angle)
        player.setVehicleParked(true)
        player.events.trigger('modeChange', [ player.mode ])

    }

    update()
    {
        if(!this.startedAtHome && this.ready)
        {
            this.startedAtHome = true

            if(!location.hash.match(/car/i))
                this.startAtHome()
        }
    }
}
