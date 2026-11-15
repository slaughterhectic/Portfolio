import { Game } from './Game.js'
import gsap from 'gsap'
import { remapClamp, smallestAngle } from './utilities/maths.js'
import * as THREE from 'three/webgpu'
import { Inputs } from './Inputs/Inputs.js'
import { Events } from './Events.js'
import { clamp } from 'three/src/math/MathUtils.js'
import { Foot } from './Life/Foot.js'
import { groundAt } from './Life/Npcs.js'

export class Player
{
    static STATE_DEFAULT = 1
    static STATE_LOCKED = 2

    static MODE_VEHICLE = 'vehicle'
    static MODE_FOOT = 'foot'

    constructor()
    {
        this.game = Game.getInstance()
        
        this.state = Player.STATE_DEFAULT
        this.mode = Player.MODE_VEHICLE
        this.events = new Events()
        this.accelerating = 0
        this.steering = 0
        this.boosting = 0
        this.braking = 0
        this.suspensions = ['low', 'low', 'low', 'low']

        const respawn = this.game.respawns.getDefault()

        this.position = respawn.position.clone()
        this.basePosition = this.position.clone()
        this.position2 = new THREE.Vector2(this.position.x, this.position.z)
        this.rotationY = 0

        this.setSounds()
        this.setInputs()
        this.setDistanceDriven()
        this.setUnstuck()
        // this.setBackWheel()
        this.setFlip()
        this.setTimePlayed()
        this.setFoot()

        this.game.physicalVehicle.chassis.physical.initialState.position.x = respawn.position.x
        this.game.physicalVehicle.chassis.physical.initialState.position.y = respawn.position.y
        this.game.physicalVehicle.chassis.physical.initialState.position.z = respawn.position.z
        this.game.physicalVehicle.moveTo(respawn.position, respawn.rotation)

        // The player starts on foot at home: the vehicle is parked in the driveway
        if(respawn.footOnly)
        {
            const driveway = this.game.respawns.getByName('driveway')
            this.game.physicalVehicle.chassis.physical.initialState.position.x = driveway.position.x
            this.game.physicalVehicle.chassis.physical.initialState.position.z = driveway.position.z
            this.game.physicalVehicle.moveTo(driveway.position, driveway.rotation)
        }

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePrePhysics()
        }, 1)

        this.game.ticker.events.on('tick', () =>
        {
            this.updatePostPhysics()
        }, 6)
    }

    setSounds()
    {
        this.sounds = {}
        this.sounds.suspensions = this.game.audio.register({
            path: 'sounds/vehicle/suspensions/Robotic_Lifeforms_2_-_Air_Source_-_Piston_Studio_Chair_07.mp3',
            autoplay: false,
            loop: false,
            volume: 0.4,
            antiSpam: 0.1,
            onPlay: (item, count) =>
            {
                item.volume = 0.3 + count * 0.08
                item.rate = 0.9 + Math.random() * 0.2
            }
        })
        this.sounds.honk = this.game.audio.register(
        {
            path: 'sounds/vehicle/honk/Car Horn Long 4.mp3',
            autoplay: true,
            loop: true,
            volume: 0.4,
            antiSpam: 0.1,
            onPlaying: (item) =>
            {
                item.volume = (this.game.inputs.actions.get('honk').active && this.mode === Player.MODE_VEHICLE) ? 0.5 : 0
            }
        })
        this.sounds.spring1 = this.game.audio.register({
            path: 'sounds/vehicle/springs/HandleSqueak_BW.60329.mp3',
            autoplay: false,
            loop: false,
            volume: 0.4,
            antiSpam: 1,
            onPlay: (item, count) =>
            {
                item.volume = 0.05 + count * 0.02
                item.rate = 1 + Math.random() * 0.1
            }
        })
        this.sounds.spring2 = this.game.audio.register({
            path: 'sounds/vehicle/springs/SpringMetalMovements_1u54Y_01.mp3',
            autoplay: false,
            loop: false,
            volume: 0.4,
            antiSpam: 0.2,
            onPlay: (item, count) =>
            {
                item.volume = 0.05 + count * 0.1
                item.rate = 0.9 + Math.random() * 0.4
            }
        })

        // Wheels on floor
        {
            // Default pebbles
            this.game.audio.register({
                group: 'wheelsOnFloor',
                path: 'sounds/vehicle/floor/wheels-on-pebbles-road.mp3',
                autoplay: true,
                loop: true,
                volume: 0,
                onPlaying: (item) =>
                {
                    const defaultElevation = 1.08
                    const inAirEffect = remapClamp(Math.abs(this.game.physicalVehicle.position.y - defaultElevation), 0, 2, 1, 0)
                    const speedEffect = Math.min(1, this.game.physicalVehicle.xzSpeed * 0.1)
                    item.volume = inAirEffect * speedEffect * 0.25
                }
            })

            // Brake pebbles
            this.game.audio.register({
                group: 'wheelsOnFloor',
                path: 'sounds/vehicle/floor/Source Stone Loop Small Rubbing Pebbles On Concrete 02.mp3',
                autoplay: true,
                loop: true,
                volume: 0,
                onPlaying: (item) =>
                {
                    const directionRatio = (1 - Math.abs(this.game.physicalVehicle.forwardRatio)) * 0.6
                    
                    let brakeEffect = Math.max(directionRatio, this.game.player.braking) * this.game.physicalVehicle.xzSpeed * 0.15 * this.game.physicalVehicle.wheels.inContactCount / 4
                    brakeEffect = clamp(brakeEffect, 0, 1)

                    const volume = brakeEffect * 0.4
                    const delta = volume - item.volume

                    if(delta > 0)
                        item.volume += delta * this.game.ticker.deltaScaled * 20
                    else
                        item.volume += delta * this.game.ticker.deltaScaled * 5
                    
                    item.rate = 0.8
                }
            })
        }

        // Engine and speed
        {
            // Engine
            this.game.audio.register({
                path: 'sounds/vehicle/engine/muscle car engine loop idle.mp3',
                autoplay: true,
                loop: true,
                volume: 0,
                onPlaying: (item) =>
                {
                    const accelerating = Math.abs(this.game.player.accelerating) * 0.5
                    const boosting = this.game.player.boosting + 1
                    // Each vehicle has its own voice (a bicycle has none), and a parked engine is off
                    const garage = this.game.life?.garage
                    const voice = (garage && garage.constructor.TYPES[garage.activeType].sound) || { volume: 1, rate: 1 }
                    const engineOn = this.mode === Player.MODE_VEHICLE ? 1 : 0
                    const volume = Math.max(0.05, accelerating * boosting * 0.8) * voice.volume * engineOn
                    const delta = volume - item.volume
                    const easing = delta > 0 ? 10 : 2.5
                    
                    item.volume += delta * this.game.ticker.deltaScaled * easing

                    const rate = remapClamp(accelerating * boosting, 0, 1, 0.6, 1.1) * voice.rate
                    item.rate += (rate - item.rate) * this.game.ticker.deltaScaled * 5
                }
            })

            // Spin and wind
            this.game.audio.register({
                path: 'sounds/vehicle/spin/41051 Glass stone turning loop 09-full.mp3',
                autoplay: true,
                loop: true,
                volume: 0,
                onPlaying: (item) =>
                {
                    const speedEffect = clamp(this.game.physicalVehicle.xzSpeed * 0.1, 0, 1)
                    const volume = speedEffect * 0.3
                    const delta = volume - item.volume
                    const easing = delta > 0 ? 10 : 2.5
                    
                    item.volume += delta * this.game.ticker.deltaScaled * easing

                    const rate = remapClamp(speedEffect, 0, 1, 1, 2)
                    item.rate += (rate - item.rate) * this.game.ticker.deltaScaled * 5
                }
            })
        }

        // Boost
        this.game.audio.register({
            path: 'sounds/vehicle/energy/Energy_-_force_field_8_loop.mp3',
            autoplay: true,
            loop: true,
            volume: 0,
            onPlaying: (item) =>
            {
                const accelerating = 0.5 + Math.abs(this.game.player.accelerating) * 0.5
                const boosting = this.game.player.boosting
                const volume = accelerating * boosting * 0.3
                const delta = volume - item.volume
                const easing = delta > 0 ? 10 : 1
                
                item.volume += delta * this.game.ticker.deltaScaled * easing

                const rate = 0.95 + Math.abs(this.game.player.accelerating) * 2
                item.rate += (rate - item.rate) * this.game.ticker.deltaScaled * 5
            }
        })
    }

    setInputs()
    {
        this.game.inputs.addActions([
            { name: 'forward',               categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowUp', 'Keyboard.KeyW', 'Gamepad.up', 'Gamepad.r2' ] },
            { name: 'right',                 categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowRight', 'Keyboard.KeyD', 'Gamepad.right' ] },
            { name: 'backward',              categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowDown', 'Keyboard.KeyS', 'Gamepad.down', 'Gamepad.l2' ] },
            { name: 'left',                  categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.ArrowLeft', 'Keyboard.KeyA', 'Gamepad.left' ] },
            { name: 'boost',                 categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.ShiftLeft', 'Keyboard.ShiftRight', 'Gamepad.circle' ] },
            { name: 'brake',                 categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.KeyB', 'Keyboard.ControlLeft', 'Gamepad.square' ] },
            { name: 'respawn',               categories: [ 'wandering',                       ], keys: [ 'Keyboard.KeyR', 'Gamepad.select' ] },
            { name: 'suspensions',           categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad5', 'Keyboard.Space', 'Gamepad.triangle' ] },
            { name: 'suspensionsFront',      categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad8' ] },
            { name: 'suspensionsBack',       categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad2' ] },
            { name: 'suspensionsRight',      categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad6' ] },
            { name: 'suspensionsLeft',       categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad4', 'Gamepad.l1' ] },
            { name: 'suspensionsFrontLeft',  categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad7', 'Keyboard.Digit2' ] },
            { name: 'suspensionsFrontRight', categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad9', 'Keyboard.Digit3' ] },
            { name: 'suspensionsBackRight',  categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad3', 'Keyboard.Digit4' ] },
            { name: 'suspensionsBackLeft',   categories: [ 'wandering', 'racing'              ], keys: [ 'Keyboard.Numpad1', 'Keyboard.Digit1' ] },
            { name: 'interact',              categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.Enter', 'Keyboard.KeyE', 'Gamepad.cross' ] },
            { name: 'punch',                 categories: [ 'wandering'                        ], keys: [ 'Keyboard.KeyQ', 'Keyboard.KeyX' ] },
            { name: 'vehicleToggle',         categories: [ 'wandering'                        ], keys: [ 'Keyboard.KeyF', 'Gamepad.r1' ] },
            { name: 'honk',                  categories: [ 'wandering', 'racing', 'cinematic' ], keys: [ 'Keyboard.KeyH', 'Gamepad.l3' ] },
        ])

        // Respawn
        this.game.inputs.events.on('respawn', (action) =>
        {
            if(this.state !== Player.STATE_DEFAULT)
                return

            if(action.active)
            {
                this.respawn()
            }
        })

        // Honk
        this.game.inputs.events.on('honk', (action) =>
        {
            if(action.active && this.mode === Player.MODE_VEHICLE)
                this.honk()
        })

        // Suspensions
        const suspensionsUpdate = () =>
        {
            if(this.state !== Player.STATE_DEFAULT || this.mode !== Player.MODE_VEHICLE)
                return

            const activeSuspensions = [
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsFront').active || this.game.inputs.actions.get('suspensionsRight').active || this.game.inputs.actions.get('suspensionsFrontRight').active, // front right
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsFront').active || this.game.inputs.actions.get('suspensionsLeft').active || this.game.inputs.actions.get('suspensionsFrontLeft').active, // front left
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsBack').active || this.game.inputs.actions.get('suspensionsRight').active || this.game.inputs.actions.get('suspensionsBackRight').active, // back right
                this.game.inputs.actions.get('suspensions').active || this.game.inputs.actions.get('suspensionsBack').active || this.game.inputs.actions.get('suspensionsLeft').active || this.game.inputs.actions.get('suspensionsBackLeft').active, // back left
            ]

            const activeState = this.game.inputs.actions.get('suspensions').active ? 'high' : 'mid' // high = jump, mid = lowride

            for(let i = 0; i < 4; i++)
                this.suspensions[i] = activeSuspensions[i] ? activeState : 'low'

            const activeCount = activeSuspensions[0] + activeSuspensions[1] + activeSuspensions[2] + activeSuspensions[3]
            

            if(activeCount)
            {
                // Sound
                this.sounds.suspensions.play(activeCount)

                // Not a jump => Achievement
                if(!this.game.inputs.actions.get('suspensions').active)
                    this.game.achievements.addProgress('suspensions')
            }
                
        }

        this.game.inputs.events.on('suspensions', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsFront', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsBack', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsRight', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsLeft', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsFrontLeft', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsFrontRight', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsBackRight', suspensionsUpdate)
        this.game.inputs.events.on('suspensionsBackLeft', suspensionsUpdate)

        this.game.inputs.events.on('suspensions', () =>
        {
            if(this.game.inputs.mode === Inputs.MODE_TOUCH)
                this.game.inputs.nipple.jump()
        })

        // Nipple tap jump
        let nippleJumpTimeout = null
        this.game.inputs.nipple.events.on('tap', () =>
        {
            if(this.mode !== Player.MODE_VEHICLE)
            {
                this.foot.jumpRequested = true
                return
            }

            this.game.inputs.nipple.jump()

            for(let i = 0; i < 4; i++)
                this.suspensions[i] = 'high'

            if(nippleJumpTimeout)
                clearTimeout(nippleJumpTimeout)
            
            nippleJumpTimeout = setTimeout(() =>
            {
                for(let i = 0; i < 4; i++)
                    this.suspensions[i] = 'low'
            }, 200)
        })
    }

    setDistanceDriven()
    {
        this.distanceDriven = {}

        const localDistanceDriven = localStorage.getItem('distanceDriven')
        this.distanceDriven.value = localDistanceDriven ? parseInt(localDistanceDriven) : 0
        this.distanceDriven.floored = Math.floor(this.distanceDriven.value)
        this.distanceDriven.reset = () =>
        {
            localStorage.removeItem('distanceDriven')
            this.distanceDriven.value = 0
            this.distanceDriven.floored = 0
        }
        
    }

    setUnstuck()
    {
        this.unstuck = {}
        this.unstuck.duration = 3
        this.unstuck.delay = null

        this.game.physicalVehicle.events.on('rightSideUp', () =>
        {
            // Reset delay
            if(this.unstuck.delay)
                this.unstuck.delay.kill()
        })

        const waitAndTest = () =>
        {
            this.unstuck.delay = gsap.delayedCall(this.unstuck.duration, () =>
            {
                this.unstuck.delay = null

                if(this.state !== Player.STATE_DEFAULT)
                    return

                // Still upside down => Flip back
                if(this.game.physicalVehicle.upsideDown.active)
                {
                    this.game.physicalVehicle.flip.jump()
                    
                    // Sound
                    this.sounds.suspensions.play(4)

                    // Achievement
                    if(this.game.physicalVehicle.upsideDown.ratio > 0.75)
                        this.game.achievements.setProgress('upsideDown', 1)

                    // Again in case it didn't work
                    waitAndTest()
                }
            })
        }

        this.game.physicalVehicle.events.on('upsideDown', (ratio) =>
        {
            // Reset delay
            if(this.unstuck.delay)
                this.unstuck.delay.kill()

            // Wait a moment
            waitAndTest()
        })

        this.game.physicalVehicle.events.on('stuck', () =>
        {
            this.game.inputs.interactiveButtons.addItems(['unstuck'])
        })

        this.game.physicalVehicle.events.on('unstuck', () =>
        {
            this.game.inputs.interactiveButtons.removeItems(['unstuck'])
        })

        this.game.inputs.interactiveButtons.events.on('unstuck', () =>
        {
            this.game.inputs.interactiveButtons.removeItems(['unstuck'])
            this.respawn()
        })
    }

    // setBackWheel()
    // {
    //     let delay = null
    //     let startTime = null

    //     this.game.physicalVehicle.events.on('backWheel', (_active) =>
    //     {
    //         if(_active)
    //         {
    //             startTime = this.game.ticker.elapsed

    //             if(delay)
    //             {
    //                 delay.kill()
    //                 delay = null
    //             }
    //         }
    //         else
    //         {
    //             delay = gsap.delayedCall(0.1, () =>
    //             {
    //                 delay = null

    //                 const duration = this.game.ticker.elapsed - startTime

    //                 if(duration > 5)
    //                     this.game.achievements.setProgress('backWheel', 1)
    //             })
    //         }
    //     })
    // }

    setFlip()
    {
        this.game.physicalVehicle.events.on('flip', (direction) =>
        {
            if(direction > 0)
                this.game.achievements.setProgress('frontFlip', 1)
            else
                this.game.achievements.setProgress('backFlip', 1)
        })
    }

    setTimePlayed()
    {
        const localTimePlayed = localStorage.getItem('timePlayed')
        this.timePlayed = {}
        this.timePlayed.all = localTimePlayed ? parseFloat(localTimePlayed) : 0
        this.timePlayed.session = 0
        this.timePlayed.achieved = false

        setInterval(() =>
        {
            localStorage.setItem('timePlayed', this.timePlayed.all)
        }, 1000)
    }

    setFoot()
    {
        this.foot = new Foot()
        this.vehicleReach = 4.2
        this.nearVehicle = false

        // Prompt
        this.prompt = {}
        this.prompt.element = document.querySelector('.js-vehicle-prompt')
        this.prompt.labelElement = this.prompt.element?.querySelector('.js-label')
        this.prompt.state = null
        this.prompt.set = (state) =>
        {
            if(state === this.prompt.state || !this.prompt.element)
                return

            this.prompt.state = state
            this.prompt.element.classList.toggle('is-visible', state !== null)

            if(state !== null)
                this.prompt.labelElement.textContent = state

            // Touch button
            if(state !== null)
                this.game.inputs.interactiveButtons.addItems(['vehicle'])
            else
                this.game.inputs.interactiveButtons.removeItems(['vehicle'])

            const touchButton = document.querySelector('.js-touch-buttons .js-button.vehicle')
            if(touchButton && state !== null)
                touchButton.textContent = state
        }

        this.game.inputs.events.on('punch', (action) =>
        {
            if(action.active && this.mode === Player.MODE_FOOT && this.state === Player.STATE_DEFAULT)
            {
                this.foot.punch(() =>
                {
                    this.game.life?.npcs?.hit(this.foot.position, this.foot.angle)
                })
            }
        })

        this.game.inputs.events.on('vehicleToggle', (action) =>
        {
            if(action.active)
                this.toggleVehicle()
        })

        this.game.inputs.interactiveButtons.events.on('vehicle', () =>
        {
            this.toggleVehicle()
        })
    }

    toggleVehicle()
    {
        if(this.state !== Player.STATE_DEFAULT)
            return

        if(this.mode === Player.MODE_VEHICLE)
        {
            this.exitVehicle()
        }
        else if(this.nearVehicle)
        {
            // A parked vehicle => It becomes the player's vehicle
            if(this.vehicleTarget)
                this.game.life.garage.take(this.vehicleTarget)

            this.enterVehicle()
        }
    }

    exitVehicle()
    {
        const vehicle = this.game.physicalVehicle

        // Too fast or upside down
        if(vehicle.xzSpeed > 6 || vehicle.upsideDown.active)
            return false

        // Look for a free spot around the vehicle (driver side first)
        const candidates = [
            vehicle.sideward.clone().multiplyScalar(- 1.75),
            vehicle.sideward.clone().multiplyScalar(1.75),
            vehicle.forward.clone().multiplyScalar(- 2.4),
            vehicle.forward.clone().multiplyScalar(2.4),
        ]

        const RAPIER = this.game.RAPIER
        let spot = null

        for(const offset of candidates)
        {
            const origin = { x: vehicle.position.x + offset.x, y: vehicle.position.y + 1.2, z: vehicle.position.z + offset.z }
            const ray = new RAPIER.Ray(origin, { x: 0, y: - 1, z: 0 })
            const hit = this.game.physics.world.castRay(ray, 5, true, undefined, undefined, this.foot.collider, vehicle.chassis.physical.body)

            if(!hit)
                continue

            const position = new THREE.Vector3(origin.x, origin.y - hit.timeOfImpact, origin.z)

            // Not in the water and not on top of something high
            if(position.y < - 0.4 || position.y > vehicle.position.y + 0.4)
                continue

            if(this.foot.isFree(position))
            {
                spot = position
                break
            }
        }

        if(!spot)
        {
            this.game.notifications?.show('No room to get out here', 'warning', 2)
            return false
        }

        this.mode = Player.MODE_FOOT
        this.accelerating = 0
        this.steering = 0
        this.boosting = 0
        this.braking = 1
        this.suspensions = ['low', 'low', 'low', 'low']

        const angle = Math.atan2(- vehicle.forward.z, vehicle.forward.x)
        this.foot.activate(spot, angle)

        this.setVehicleParked(true)

        gsap.to(this.game.view.zoom, { baseRatio: 0.42, duration: 0.9, ease: 'power2.out', overwrite: true })

        this.events.trigger('modeChange', [ this.mode ])
        return true
    }

    enterVehicle(silent = false)
    {
        this.mode = Player.MODE_VEHICLE
        this.foot.deactivate()
        this.braking = 0
        this.setVehicleParked(false)

        if(!silent)
            gsap.to(this.game.view.zoom, { baseRatio: 0, duration: 0.9, ease: 'power2.out', overwrite: true })
        else
            this.game.view.zoom.baseRatio = 0

        this.events.trigger('modeChange', [ this.mode ])
    }

    /**
     * A parked vehicle is a fixed body: it can't roll away or be pushed
     */
    setVehicleParked(parked)
    {
        const RigidBodyType = this.game.RAPIER.RigidBodyType
        const body = this.game.physicalVehicle.chassis.physical.body

        body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        body.setAngvel({ x: 0, y: 0, z: 0 }, true)

        // Parked means standing on its wheels on the ground, never frozen in the air or tilted
        if(parked)
        {
            const position = body.translation()
            const ground = groundAt(position.x, position.z, null)

            if(ground !== null)
            {
                const yaw = this.game.physicalVehicle.yRotation ?? 0
                body.setTranslation({ x: position.x, y: ground + 0.98, z: position.z }, true)
                body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), true)
            }
        }

        body.setBodyType(parked ? RigidBodyType.Fixed : RigidBodyType.Dynamic, true)
    }

    updateFootPrePhysics()
    {
        const actions = this.game.inputs.actions
        let moveX = 0
        let moveY = 0
        let sprint = false
        let jump = false

        // Park brake
        this.braking = 1

        if(this.state === Player.STATE_DEFAULT)
        {
            if(actions.get('forward').active)
                moveY += 1
            if(actions.get('backward').active)
                moveY -= 1
            if(actions.get('right').active)
                moveX += 1
            if(actions.get('left').active)
                moveX -= 1

            // Gamepad joystick
            const joystick = this.game.inputs.gamepad.joysticks.left
            if(moveX === 0 && moveY === 0 && joystick.active)
            {
                moveX = joystick.safeX
                moveY = - joystick.safeY
            }

            // Touch joystick: world direction from the nipple angle
            const nipple = this.game.inputs.nipple
            if(nipple.active && nipple.progress > 0 && typeof nipple.targetAngle === 'number')
            {
                const strength = Math.min(1, nipple.progress * 1.5)
                const worldX = Math.cos(nipple.targetAngle) * strength
                const worldZ = Math.sin(nipple.targetAngle) * strength
                moveX = worldX * this.foot.screenRight.x + worldZ * this.foot.screenRight.z
                moveY = worldX * this.foot.screenUp.x + worldZ * this.foot.screenUp.z
                sprint = nipple.progress > 0.9
            }

            sprint = sprint || actions.get('boost').active
            jump = actions.get('suspensions').active || this.foot.jumpRequested
        }

        this.foot.jumpRequested = false
        this.foot.updatePrePhysics(moveX, moveY, sprint, jump)
    }

    updatePromptPosition()
    {
        const element = this.prompt.element

        if(!element)
            return

        if(!this.prompt.anchor || this.prompt.state === null)
        {
            if(this.prompt.anchored)
            {
                this.prompt.anchored = false
                element.classList.remove('is-anchored')
                element.style.left = ''
                element.style.top = ''
            }
            return
        }

        const projected = this.promptVector ?? (this.promptVector = new THREE.Vector3())
        projected.copy(this.prompt.anchor)
        projected.y += 2.3
        projected.project(this.game.view.camera)

        this.prompt.anchored = true
        element.classList.add('is-anchored')
        element.style.left = `${(projected.x * 0.5 + 0.5) * this.game.viewport.width}px`
        element.style.top = `${(- projected.y * 0.5 + 0.5) * this.game.viewport.height}px`
    }

    updateVehiclePrompt()
    {
        if(this.state !== Player.STATE_DEFAULT || !this.game.inputs.filters.has('wandering'))
        {
            this.prompt.set(null)
            return
        }

        if(this.mode === Player.MODE_VEHICLE)
        {
            this.nearVehicle = true
            this.prompt.set(this.game.physicalVehicle.xzSpeed < 6 ? 'Exit' : null)
            this.prompt.anchor = null
        }
        else
        {
            // Closest between the player's own vehicle and the parked ones
            const garage = this.game.life?.garage
            const ownDistance = Math.hypot(
                this.foot.position.x - this.game.physicalVehicle.position.x,
                this.foot.position.z - this.game.physicalVehicle.position.z
            )
            const parked = garage ? garage.getNearest(this.foot.position, this.vehicleReach) : null

            let label = null
            this.vehicleTarget = null
            this.nearVehicle = false

            if(parked && parked.distance < ownDistance)
            {
                this.nearVehicle = true
                this.vehicleTarget = parked.prop
                label = garage.constructor.TYPES[parked.prop.type].label
            }
            else if(ownDistance < this.vehicleReach)
            {
                this.nearVehicle = true
                label = garage ? garage.constructor.TYPES[garage.activeType].label : 'Drive'
            }

            this.prompt.set(label)

            // The prompt floats above the vehicle it is about
            this.prompt.anchor = this.vehicleTarget ? this.vehicleTarget.position : (this.nearVehicle ? this.game.physicalVehicle.position : null)
        }
    }

    respawn(respawnName = null, callback = null)
    {
        this.game.overlay.show(() =>
        {
            if(typeof callback === 'function')
                callback()

            // Find respawn
            let respawn = respawnName ? this.game.respawns.getByName(respawnName) : this.game.respawns.getClosest(this.position)

            // Back in the vehicle
            if(this.mode === Player.MODE_FOOT)
                this.enterVehicle(true)

            // Update physical vehicle
            this.game.physicalVehicle.moveTo(
                respawn.position,
                respawn.rotation
            )
            
            this.state = Player.STATE_DEFAULT
            this.game.overlay.hide()
        })
    }

    die()
    {
        this.state = Player.STATE_LOCKED
        
        gsap.delayedCall(2, () =>
        {
            this.respawn(null, () =>
            {
                this.state = Player.STATE_DEFAULT
            })
        })
    }

    honk()
    {
        // Suspensions
        const randomWheelIndex = Math.floor(Math.random() * 4)
        const previousState = this.suspensions[randomWheelIndex]
        this.suspensions[ randomWheelIndex ] = 'mid'

        gsap.delayedCall(0.15, () =>
        {
            if(this.suspensions[ randomWheelIndex ] === 'mid')
            {
                this.suspensions[ randomWheelIndex ] = previousState
            }
        })

        // Achievement
        this.game.achievements.addProgress('honk')
    }

    updatePrePhysics()
    {
        this.accelerating = 0
        this.steering = 0
        this.boosting = 0
        this.braking = 0

        if(this.mode === Player.MODE_FOOT)
        {
            this.updateFootPrePhysics()
            return
        }

        if(this.state !== Player.STATE_DEFAULT)
            return

        /**
         * Accelerating
         */
        if(this.game.inputs.actions.get('forward').active)
            this.accelerating += this.game.inputs.actions.get('forward').value

        if(this.game.inputs.actions.get('backward').active)
            this.accelerating -= this.game.inputs.actions.get('backward').value

        /**
         * Boosting
         */
        if(this.game.inputs.actions.get('boost').active)
            this.boosting = 1

        /**
         * Braking
         */
        if(this.game.inputs.actions.get('brake').active)
        {
            this.accelerating = 0
            this.braking = 1
        }

        /**
         * Steering
         */
        // Left / right actions
        if(this.game.inputs.actions.get('right').active)
            this.steering -= 1
        if(this.game.inputs.actions.get('left').active)
            this.steering += 1

        // Gamepad joystick
        if(this.steering === 0 && this.game.inputs.gamepad.joysticks.left.active)
            this.steering = - this.game.inputs.gamepad.joysticks.left.safeX

        /**
         * Nipple
         */
        if(this.game.inputs.nipple.active && this.game.inputs.nipple.progress > 0)
        {
            if(!this.game.view.focusPoint.isTracking)
            {
                // Wait a few frames in case it a multi-touch
                this.game.ticker.wait(5, () =>
                {
                    if(this.game.inputs.nipple.active)
                        this.game.view.focusPoint.isTracking = true
                })
            }
            this.accelerating = Math.pow(this.game.inputs.nipple.progress, 3)
            // this.boosting = this.game.inputs.nipple.progress > 0.999

            const angleDeltaAbs = Math.abs(this.game.inputs.nipple.smallestAngle)
            const angleDeltaAbsNormalized = angleDeltaAbs / ((Math.PI * 2 - this.game.inputs.nipple.forwardAmplitude) / 2)
            const angleDeltaSign = Math.sign(this.game.inputs.nipple.smallestAngle)
            const steering = - Math.min(angleDeltaAbsNormalized, 1) * angleDeltaSign

            this.steering = steering

            if(!this.game.inputs.nipple.forward)
            {
                this.accelerating *= -1
                this.steering *= -1
            }
        }
    }

    updatePostPhysics()
    {
        // Position
        if(this.mode === Player.MODE_FOOT)
        {
            this.foot.updatePostPhysics()
            this.position.copy(this.foot.position)
            this.position.y += 0.6

            // Fell in the water
            if(this.foot.position.y < - 4 && this.state === Player.STATE_DEFAULT)
                this.respawn()
        }
        else
        {
            this.position.copy(this.game.physicalVehicle.position)
        }
        this.position2.set(this.position.x, this.position.z)
        
        // View > Focus point
        this.game.view.focusPoint.trackedPosition.copy(this.position)

        // View > Speed lines
        if(this.boosting && this.accelerating && this.game.physicalVehicle.speed > 15)
            this.game.view.speedLines.strength = 1
        else
            this.game.view.speedLines.strength = 0

        this.game.view.speedLines.worldTarget.copy(this.position)

        // Tracks > Focus point
        this.game.tracks.focusPoint.set(this.position.x, this.position.z)

        // Inputs touch joystick
        if(this.mode === Player.MODE_FOOT)
            this.rotationY = - this.foot.angle
        else
            this.rotationY = Math.atan2(this.game.physicalVehicle.forward.z, this.game.physicalVehicle.forward.x)
        this.game.inputs.nipple.setCoordinates(this.position.x, this.position.y, this.position.z, this.rotationY)

        // Vehicle prompt
        this.updateVehiclePrompt()
        this.updatePromptPosition()

        // Sound
        if(this.game.physicalVehicle.wheels.justTouchedCount > 1)
        {
            this.sounds.spring1.play(this.game.physicalVehicle.wheels.justTouchedCount)
            this.sounds.spring2.play(this.game.physicalVehicle.wheels.justTouchedCount)
        }

        // Time played
        this.timePlayed.all += this.game.ticker.delta
        this.timePlayed.session += this.game.ticker.delta

        if(!this.timePlayed.achieved && this.timePlayed.session > this.game.dayCycles.duration)
        {
            this.timePlayed.achieved = true
            this.game.achievements.setProgress('fullDay', 1)
        }

        // Sea achievement
        const distanceToCenter = this.position2.length()
        if(distanceToCenter > 120)
            this.game.achievements.setProgress('sea', 1)

        // Go high achievements
        const elevation = Math.floor(this.position.y)
        if(this.game.achievements.groups.get('goHigh') && elevation > this.game.achievements.groups.get('goHigh').progress)
            this.game.achievements.setProgress('goHigh', elevation)

        // // Speed achievement
        // const speedKmPerHour = Math.floor(this.game.physicalVehicle.xzSpeed / 1000 * 3600)

        // if(this.game.achievements.groups.get('speed') && speedKmPerHour > this.game.achievements.groups.get('speed').progress)
        //     this.game.achievements.setProgress('speed', speedKmPerHour)

        // Distance driven
        if(this.mode === Player.MODE_VEHICLE)
            this.distanceDriven.value += this.game.physicalVehicle.xzSpeed * this.game.ticker.deltaScaled
        const flooredDistanceDriven = Math.floor(this.distanceDriven.value)

        if(flooredDistanceDriven !== this.distanceDriven.floored)
        {
            localStorage.setItem('distanceDriven', flooredDistanceDriven)
            this.distanceDriven.floored = flooredDistanceDriven
        }
        
        // Achievement
        const distanceDrivenKm = Math.floor(this.distanceDriven.value / 1000)

        if(this.game.achievements.groups.get('distanceDriven') && distanceDrivenKm > this.game.achievements.groups.get('distanceDriven').progress)
        {
            this.game.achievements.setProgress('distanceDriven', distanceDrivenKm)

        }
    }
}