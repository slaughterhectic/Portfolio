import * as THREE from 'three/webgpu'
import { color, uniform, uv, vec4, sin } from 'three/tsl'
import { Game } from '../Game.js'
import { groundAt } from './Npcs.js'
import { missions as missionsData } from '../../data/life.js'

export class Missions
{
    constructor()
    {
        this.game = Game.getInstance()

        this.list = missionsData
        this.completed = new Set()
        this.active = null
        this.stepIndex = 0
        this.step = null
        this.pending = null
        this.collected = new Set()
        this.talked = new Set()
        this.timeLeft = null
        this.pickupRadius = 2.3

        this.load()
        this.setTracker()
        this.setMarkers()
        this.setSounds()

        this.game.life.events.on('talk', (npcId) =>
        {
            this.onTalk(npcId)
        })

        this.game.life.dialog.events.on('close', () =>
        {
            if(this.pending)
            {
                const mission = this.pending
                this.pending = null
                this.start(mission)
            }
        })

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    load()
    {
        try
        {
            const saved = JSON.parse(localStorage.getItem('lifeMissions') ?? '[]')
            for(const id of saved)
                this.completed.add(id)
        }
        catch(error) {}
    }

    save()
    {
        localStorage.setItem('lifeMissions', JSON.stringify([ ...this.completed ]))
    }

    setSounds()
    {
        this.sounds = {}
        this.sounds.pickup = this.game.audio.register({
            path: 'sounds/ding/Cash Register 03.mp3',
            autoplay: false,
            loop: false,
            volume: 0.35,
            antiSpam: 0.1,
            onPlay: (item) =>
            {
                item.rate = 1.1 + Math.random() * 0.1
            }
        })
        this.sounds.complete = this.game.audio.register({
            path: 'sounds/achievements/Money Reward 2.mp3',
            autoplay: false,
            loop: false,
            volume: 0.5,
        })
    }

    setTracker()
    {
        this.tracker = {}
        this.tracker.element = document.querySelector('.js-mission-tracker')
        this.tracker.eyebrow = this.tracker.element.querySelector('.js-eyebrow')
        this.tracker.title = this.tracker.element.querySelector('.js-title')
        this.tracker.objective = this.tracker.element.querySelector('.js-objective')
        this.tracker.meta = this.tracker.element.querySelector('.js-meta')
        this.tracker.fill = this.tracker.element.querySelector('.js-fill')
        this.tracker.count = this.tracker.element.querySelector('.js-count')
        this.tracker.timer = this.tracker.element.querySelector('.js-timer')
        this.tracker.lastTimer = null
    }

    setMarkers()
    {
        this.markers = {}
        this.markers.items = []
        this.markers.colorA = uniform(color('#d5ff95'))

        const pulse = sin(this.game.ticker.elapsedUniform.mul(3)).mul(0.25).add(1)

        // Beam fading out towards the top
        const beamMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })
        beamMaterial.outputNode = vec4(this.markers.colorA.mul(2.2).mul(pulse), uv().y.oneMinus().pow(2).mul(0.55))
        beamMaterial.fog = false

        const ringMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })
        ringMaterial.outputNode = vec4(this.markers.colorA.mul(2.6).mul(pulse), 1)
        ringMaterial.fog = false

        const beamGeometry = new THREE.CylinderGeometry(0.55, 0.55, 5, 20, 1, true)
        beamGeometry.translate(0, 2.5, 0)

        const ringGeometry = new THREE.RingGeometry(1.25, 1.5, 40)
        ringGeometry.rotateX(- Math.PI * 0.5)

        for(let i = 0; i < 8; i++)
        {
            const group = new THREE.Group()
            group.visible = false
            group.userData.preventPreRender = true

            const beam = new THREE.Mesh(beamGeometry, beamMaterial)
            beam.renderOrder = 5
            const ring = new THREE.Mesh(ringGeometry, ringMaterial)
            ring.position.y = 0.06
            ring.renderOrder = 5

            group.add(beam, ring)
            this.game.scene.add(group)
            this.markers.items.push({ group, key: null })
        }

        this.markers.hideAll = () =>
        {
            for(const marker of this.markers.items)
            {
                marker.group.visible = false
                marker.key = null
            }
        }

        this.markers.show = (key, x, z) =>
        {
            const marker = this.markers.items.find((_marker) => _marker.key === null)

            if(!marker)
                return

            marker.key = key
            marker.group.position.set(x, groundAt(x, z), z)
            marker.group.visible = true
        }

        this.markers.hide = (key) =>
        {
            const marker = this.markers.items.find((_marker) => _marker.key === key)

            if(marker)
            {
                marker.group.visible = false
                marker.key = null
            }
        }
    }

    /**
     * Dialog hooks
     */
    getTopics(npcId)
    {
        const topics = []

        for(const mission of this.list)
        {
            if(mission.giver !== npcId || this.active === mission)
                continue

            const done = this.completed.has(mission.id)

            topics.push({
                label: done ? `Replay mission: ${mission.title}` : `Mission: ${mission.title}`,
                type: 'mission',
                action: () =>
                {
                    if(this.active)
                        return [ `Finish <strong>${this.active.title}</strong> first, then come back to me.` ]

                    this.pending = mission
                    return [ mission.pitch ]
                }
            })
        }

        return topics
    }

    getGreeting(npcId)
    {
        if(!this.active || !this.step)
            return null

        if(this.step.type === 'talk' && this.step.npc === npcId)
        {
            const isLast = this.stepIndex === this.active.steps.length - 1
            return isLast ? this.active.reward : null
        }

        return null
    }

    onTalk(npcId)
    {
        if(!this.active || !this.step)
            return

        if(this.step.type === 'talk' && this.step.npc === npcId)
        {
            this.nextStep()
        }
        else if(this.step.type === 'talkAll' && this.step.npcs.includes(npcId) && !this.talked.has(npcId))
        {
            this.talked.add(npcId)
            this.sounds.pickup.play()
            this.markers.hide(npcId)
            this.updateTracker()

            if(this.talked.size === this.step.npcs.length)
                this.nextStep()
        }
    }

    /**
     * Flow
     */
    start(mission)
    {
        this.active = mission
        this.stepIndex = - 1
        this.tracker.element.classList.add('is-visible')
        this.tracker.title.textContent = mission.title
        this.nextStep()
    }

    nextStep()
    {
        this.stepIndex++

        if(this.stepIndex >= this.active.steps.length)
        {
            this.complete()
            return
        }

        this.setStep(this.active.steps[this.stepIndex])
    }

    setStep(step)
    {
        this.step = step
        this.collected.clear()
        this.talked.clear()
        this.markers.hideAll()
        this.timeLeft = step.timeLimit ?? null
        this.tracker.lastTimer = null

        if(step.type === 'collect')
        {
            if(step.ordered)
                this.markers.show(0, step.points[0][0], step.points[0][1])
            else
                step.points.forEach(([ x, z ], index) => this.markers.show(index, x, z))
        }
        else if(step.type === 'reach')
        {
            this.markers.show(0, step.position[0], step.position[1])
        }
        else if(step.type === 'talk' || step.type === 'talkAll')
        {
            const ids = step.type === 'talk' ? [ step.npc ] : step.npcs

            for(const id of ids)
            {
                const npc = this.game.life.npcs.items.get(id)
                this.markers.show(id, npc.position.x, npc.position.z)
            }
        }

        this.updateTracker()
    }

    complete()
    {
        const mission = this.active
        const isNew = !this.completed.has(mission.id)

        this.completed.add(mission.id)
        this.save()

        this.active = null
        this.step = null
        this.markers.hideAll()
        this.tracker.element.classList.remove('is-visible')
        this.sounds.complete.play()

        const total = this.list.length
        const html = /* html */`
            <div class="top">
                <div class="title">Mission complete: ${mission.title}</div>
                <div class="progress">
                    <span class="current">${this.completed.size}</span> / <span>${total}</span>
                </div>
            </div>
            <div class="bottom">
                <div class="description">${mission.reward}</div>
            </div>
        `
        this.game.notifications.show(html, 'achievement', 9)

        if(isNew && this.completed.size === total)
        {
            this.game.notifications.show(/* html */`
                <div class="top"><div class="title">That's the whole story</div></div>
                <div class="bottom"><div class="description">You finished every mission in Gourav's world. Say hi: gchakraborty996@gmail.com</div></div>
            `, 'achievement', 10)
        }

        this.game.life.events.trigger('missionComplete', [ mission.id ])
    }

    fail(reason)
    {
        this.game.notifications.show(/* html */`
            <div class="top"><div class="title">${reason}</div></div>
            <div class="bottom"><div class="description">The route has been reset. Give it another go.</div></div>
        `, 'achievement', 4)

        this.setStep(this.step)
    }

    updateTracker()
    {
        if(!this.active || !this.step)
            return

        const step = this.step
        this.tracker.eyebrow.textContent = `Mission · step ${this.stepIndex + 1} of ${this.active.steps.length}`
        this.tracker.objective.textContent = step.text

        let total = 0
        let current = 0

        if(step.type === 'collect')
        {
            total = step.points.length
            current = this.collected.size
        }
        else if(step.type === 'talkAll')
        {
            total = step.npcs.length
            current = this.talked.size
        }

        const hasProgress = total > 0
        const hasTimer = this.timeLeft !== null

        this.tracker.meta.style.display = hasProgress || hasTimer ? '' : 'none'
        this.tracker.fill.parentElement.style.display = hasProgress ? '' : 'none'
        this.tracker.count.style.display = hasProgress ? '' : 'none'
        this.tracker.timer.style.display = hasTimer ? '' : 'none'

        if(hasProgress)
        {
            this.tracker.fill.style.transform = `scaleX(${current / total})`
            this.tracker.count.textContent = `${current} / ${total}`
        }
    }

    update()
    {
        // Auto mission on first visit
        if(!this.active && !this.autoChecked && this.game.reveal.step >= 2)
        {
            this.autoChecked = true
            const auto = this.list.find((mission) => mission.auto && !this.completed.has(mission.id))

            if(auto)
                this.start(auto)
        }

        if(!this.active || !this.step || this.game.life.dialog.isOpen)
            return

        const step = this.step
        const player = this.game.player
        const position = player.position
        const modeOk = !step.mode || player.mode === step.mode

        // Timer
        if(this.timeLeft !== null)
        {
            this.timeLeft -= this.game.ticker.delta
            const seconds = Math.max(0, Math.ceil(this.timeLeft))

            if(seconds !== this.tracker.lastTimer)
            {
                this.tracker.lastTimer = seconds
                this.tracker.timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
                this.tracker.timer.classList.toggle('is-low', seconds <= 15)
            }

            if(this.timeLeft <= 0)
            {
                this.fail('Out of time')
                return
            }
        }

        if(step.type === 'collect')
        {
            const indexes = step.ordered ? [ this.collected.size ] : step.points.map((_point, index) => index)

            for(const index of indexes)
            {
                if(this.collected.has(index) || !modeOk)
                    continue

                const point = step.points[index]

                if(Math.hypot(point[0] - position.x, point[1] - position.z) < this.pickupRadius)
                {
                    this.collected.add(index)
                    this.markers.hide(step.ordered ? 0 : index)
                    this.sounds.pickup.play()

                    if(this.collected.size === step.points.length)
                    {
                        this.nextStep()
                        return
                    }

                    if(step.ordered)
                    {
                        const next = step.points[this.collected.size]
                        this.markers.show(0, next[0], next[1])
                    }

                    this.updateTracker()
                }
            }
        }
        else if(step.type === 'reach')
        {
            if(modeOk && Math.hypot(step.position[0] - position.x, step.position[1] - position.z) < (step.radius ?? this.pickupRadius))
                this.nextStep()
        }
        else if(step.type === 'leaveHome')
        {
            if(!this.game.life.town.home.isInside)
                this.nextStep()
        }
        else if(step.type === 'enterVehicle')
        {
            if(player.mode === 'vehicle')
                this.nextStep()
        }
    }
}
