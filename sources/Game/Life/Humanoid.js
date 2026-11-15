import * as THREE from 'three/webgpu'
import { attribute, color, mix, texture } from 'three/tsl'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Animated humanoid sharing one rig and one set of animation clips.
 * Each instance gets its own skeleton and mixer, materials are shared per colour.
 */
export class Humanoid
{
    static materials = new Map()
    static clips = null
    static source = null

    static DEFAULT_LOOK = {
        skin: '#c68a5e',
        shirt: '#2f6fdb',
        pants: '#23263a',
        shoes: '#f1f1f1',
        hair: '#15110f',
        eyes: '#0a0a0f',
    }

    static HAIR_STYLES = [ 'SimpleParted', 'Buzzed', 'Long', 'Buns' ]

    /**
     * Body: skin texture, with the clothes painted over it from per-vertex attributes
     */
    static getBodyMaterial(body, tone)
    {
        const key = `body_${body}_${tone}`

        if(!Humanoid.materials.has(key))
        {
            const map = tone === 'light' ? Humanoid.bodies[body].skinLight : Humanoid.bodies[body].skinDark

            Humanoid.materials.set(key, new MeshDefaultMaterial({
                colorNode: mix(texture(map).rgb, attribute('color', 'vec3'), attribute('cloth', 'float')),
                hasLightBounce: false,
                hasWater: false,
            }))
        }

        return Humanoid.materials.get(key)
    }

    static getHairMaterial(hex, map)
    {
        const key = `hair_${hex}_${map.uuid}`

        if(!Humanoid.materials.has(key))
        {
            Humanoid.materials.set(key, new MeshDefaultMaterial({
                colorNode: texture(map).r.mul(0.7).add(0.45).mul(color(hex)),
                hasLightBounce: false,
                hasWater: false,
            }))
        }

        return Humanoid.materials.get(key)
    }

    static getEyesMaterial(map)
    {
        if(!Humanoid.materials.has('eyes'))
        {
            Humanoid.materials.set('eyes', new MeshDefaultMaterial({
                colorNode: texture(map).rgb,
                hasLightBounce: false,
                hasWater: false,
                hasCoreShadows: false,
            }))
        }

        return Humanoid.materials.get('eyes')
    }

    /**
     * Clothing regions (0 skin, 1 shirt, 2 pants, 3 shoes), from the bone each vertex follows the most
     */
    static getPartIndices(mesh)
    {
        if(mesh.geometry.userData.partIndices)
            return mesh.geometry.userData.partIndices

        // 0 skin, 1 torso, 2 hips and thighs, 3 feet, 4 forearms, 5 upper arms, 6 lower legs
        const partOf = (name) =>
        {
            name = name.toLowerCase()

            if(name.match(/^(head|neck|hand|index|middle|ring|pinky|thumb)/))
                return 0
            if(name.match(/^lowerarm/))
                return 4
            if(name.match(/^upperarm/))
                return 5
            if(name.match(/^(foot|ball)/))
                return 3
            if(name.match(/^calf/))
                return 6
            if(name.match(/^(pelvis|thigh)/))
                return 2

            return 1
        }

        const boneParts = mesh.skeleton.bones.map((bone) => partOf(bone.name))
        const skinIndex = mesh.geometry.attributes.skinIndex
        const skinWeight = mesh.geometry.attributes.skinWeight
        const indices = new Uint8Array(skinIndex.count)
        const weights = [ 0, 0, 0, 0, 0, 0, 0 ]

        for(let i = 0; i < skinIndex.count; i++)
        {
            weights.fill(0)

            for(let j = 0; j < 4; j++)
                weights[boneParts[skinIndex.getComponent(i, j)]] += skinWeight.getComponent(i, j)

            indices[i] = weights.indexOf(Math.max(...weights))
        }

        mesh.geometry.userData.partIndices = indices
        return indices
    }

    static prepare()
    {
        if(Humanoid.source)
            return

        const game = Game.getInstance()
        const gltf = game.resources.characterModel

        const findBody = (_gltf) =>
        {
            let body = null

            for(const scene of _gltf.scenes)
            {
                scene.traverse((child) =>
                {
                    if(!body && child.isSkinnedMesh && child.name.startsWith('Body'))
                        body = child
                })
            }

            let rig = body
            while(rig.parent && rig.parent.parent)
                rig = rig.parent

            return { body, rig }
        }

        // Male: also carries every animation clip (only those made for this skeleton are kept)
        const male = findBody(gltf)
        const clips = new Map()

        for(const clip of gltf.animations)
        {
            if(clip.tracks.some((track) => track.name.startsWith('pelvis.')))
                clips.set(clip.name, clip)
        }

        // Swimming clips live in their own small file
        for(const clip of game.resources.characterSwimModel.animations)
        {
            if(clip.tracks.some((track) => track.name.startsWith('pelvis.')))
                clips.set(clip.name, clip)
        }

        // Riding a bike: arms forward like driving, legs down like sitting on a chair
        const driving = clips.get('Driving_Loop')
        const sitting = clips.get('Sitting_Idle_Loop')

        if(driving && sitting)
        {
            const isLeg = (track) => /^(pelvis|thigh|calf|foot|ball)/.test(track.name)
            clips.set('Riding_Loop', new THREE.AnimationClip('Riding_Loop', driving.duration, [
                ...driving.tracks.filter((track) => !isLeg(track)),
                ...sitting.tracks.filter(isLeg),
            ]))
        }

        // Female: same skeleton with her own proportions, so the clips only rotate her bones
        const female = findBody(game.resources.characterFemaleModel)
        const femaleClips = new Map()

        for(const [ name, clip ] of clips)
        {
            femaleClips.set(name, new THREE.AnimationClip(name, clip.duration, clip.tracks.filter((track) =>
            {
                if(track.name.endsWith('.scale'))
                    return false

                return !track.name.endsWith('.position') || /^(root|pelvis)\./.test(track.name)
            })))
        }

        Humanoid.bodies = {
            male: { source: male.rig, skinDark: male.body.material.map, skinLight: game.resources.characterSkinLight, clips, hairStyles: [ 'SimpleParted', 'Buzzed' ] },
            female: { source: female.rig, skinDark: female.body.material.map, skinLight: game.resources.characterSkinFemaleLight, clips: femaleClips, hairStyles: [ 'Long', 'Buns' ] },
        }

        Humanoid.source = male.rig
        Humanoid.clips = clips
    }

    constructor(look = {}, scale = 0.7)
    {
        this.game = Game.getInstance()

        Humanoid.prepare()

        this.look = { ...Humanoid.DEFAULT_LOOK, ...look }
        this.scale = scale

        // Root: rotation.y = facing angle, the model is turned so that +X is forward at angle 0
        this.root = new THREE.Group()
        this.body = this.look.body === 'female' ? 'female' : 'male'
        this.clips = Humanoid.bodies[this.body].clips
        this.model = cloneSkinned(Humanoid.bodies[this.body].source)
        this.model.scale.setScalar(scale)
        this.model.rotation.y = Math.PI * 0.5
        this.model.position.set(0, 0, 0)
        this.root.add(this.model)

        // Skin tone from the look colour, hairstyle from the look or picked from the shirt colour
        const skin = new THREE.Color(this.look.skin)
        const tone = (skin.r + skin.g + skin.b) / 3 < 0.2 ? 'dark' : 'light'
        let hash = 0
        for(const character of this.look.shirt)
            hash = (hash * 31 + character.charCodeAt(0)) % 997
        const hairStyles = Humanoid.bodies[this.body].hairStyles
        const hairStyle = this.look.hairStyle ?? hairStyles[hash % hairStyles.length]

        this.model.traverse((child) =>
        {
            if(child.isSkinnedMesh)
            {
                child.castShadow = true
                child.receiveShadow = false
                child.frustumCulled = false

                if(child.name.startsWith('Body'))
                {
                    const indices = Humanoid.getPartIndices(child)
                    this.partIndices = indices
                    const geometry = child.geometry.clone()
                    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(indices.length * 3), 3))
                    geometry.setAttribute('cloth', new THREE.BufferAttribute(new Float32Array(indices.length), 1))
                    child.geometry = geometry
                    child.material = Humanoid.getBodyMaterial(this.body, tone)
                    this.mesh = child
                }
                else if(child.name.startsWith('Eyes'))
                {
                    child.material = Humanoid.getEyesMaterial(child.material.map)
                    child.castShadow = false
                }
                else
                {
                    // Eyebrows, beard and the hairstyles
                    const isHair = child.name.startsWith('Hair_')
                    child.visible = !isHair || (child.name.startsWith('Hair_Beard') ? !!this.look.beard : child.name.startsWith(`Hair_${hairStyle}`))
                    child.material = Humanoid.getHairMaterial(this.look.hair, child.material.map)
                    child.castShadow = isHair && !child.name.startsWith('Hair_Beard')
                }
            }
            else if(child.isBone && child.name === 'pelvis')
            {
                this.hips = child
            }
        })

        this.setLook({})

        this.mixer = new THREE.AnimationMixer(this.model)
        this.actions = new Map()
        this.current = null
        this.currentName = null

        this.play('Idle_Loop', 0)
    }

    /**
     * Change clothes: rewrites the clothing colours painted on the body
     */
    setLook(look)
    {
        this.look = { ...this.look, ...look }

        // The cut of the clothes decides which regions are fabric and which stay skin
        const shirt = new THREE.Color(this.look.shirt)
        const pants = new THREE.Color(this.look.pants)
        const sleeves = this.look.sleeves ?? 'short'
        const legs = this.look.legs ?? 'long'
        const parts = [
            null,
            shirt,
            this.look.top === 'long' ? shirt : pants,
            new THREE.Color(this.look.shoes),
            sleeves === 'long' ? shirt : null,
            sleeves === 'none' ? null : shirt,
            legs === 'shorts' ? null : pants,
        ]
        const indices = this.partIndices
        const colors = this.mesh.geometry.attributes.color
        const cloth = this.mesh.geometry.attributes.cloth

        for(let i = 0; i < indices.length; i++)
        {
            const part = parts[indices[i]]

            if(part)
            {
                part.toArray(colors.array, i * 3)
                cloth.array[i] = 1
            }
            else
            {
                cloth.array[i] = 0
            }
        }

        colors.needsUpdate = true
        cloth.needsUpdate = true
    }

    getAction(name)
    {
        if(this.actions.has(name))
            return this.actions.get(name)

        const clip = this.clips.get(name)

        if(!clip)
            return null

        const action = this.mixer.clipAction(clip)
        this.actions.set(name, action)

        return action
    }

    play(name, fade = 0.2, { once = false, timeScale = 1 } = {})
    {
        if(this.currentName === name)
        {
            if(this.current)
                this.current.timeScale = timeScale
            return
        }

        const action = this.getAction(name)

        if(!action)
            return

        // Fade the previous clip out and this one in (works whether or not the previous one has ended)
        if(this.current && this.current !== action)
        {
            if(fade > 0)
                this.current.fadeOut(fade)
            else
                this.current.stop()
        }

        action.reset()
        action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
        action.clampWhenFinished = once
        action.setEffectiveTimeScale(timeScale)
        action.setEffectiveWeight(1)

        if(fade > 0 && this.current && this.current !== action)
            action.fadeIn(fade)

        action.play()

        this.current = action
        this.currentName = name
    }

    update(delta)
    {
        this.mixer.update(delta)
    }
}
