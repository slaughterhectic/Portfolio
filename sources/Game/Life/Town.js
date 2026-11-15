import * as THREE from 'three/webgpu'
import { attribute, color, texture } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import gsap from 'gsap'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { mergeStatic } from './merge.js'
import { InteractivePoints } from '../InteractivePoints.js'
import { places, signposts, achievementsBoard, desk, links, outfits } from '../../data/life.js'

/**
 * Collects boxes by colour and merges them into one mesh per colour,
 * so a whole building is only a handful of draw calls.
 */
class Builder
{
    static material = null

    static getMaterial()
    {
        if(!Builder.material)
            Builder.material = new MeshDefaultMaterial({ colorNode: attribute('color', 'vec3') })

        return Builder.material
    }

    constructor()
    {
        this.geometries = []
        this.color = new THREE.Color()
    }

    add(hex, geometry)
    {
        if(geometry.index)
            geometry = geometry.toNonIndexed()

        const count = geometry.attributes.position.count
        const colors = new Float32Array(count * 3)
        this.color.set(hex)

        for(let i = 0; i < count; i++)
            this.color.toArray(colors, i * 3)

        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        this.geometries.push(geometry)
    }

    // x, z = centre, y = base
    box(hex, width, height, depth, x, y, z, rotationY = 0)
    {
        const geometry = new THREE.BoxGeometry(width, height, depth)

        if(rotationY)
            geometry.rotateY(rotationY)

        geometry.translate(x, y + height * 0.5, z)
        this.add(hex, geometry)
    }

    // Gable roof, ridge along X
    gable(hex, width, height, depth, x, y, z)
    {
        const shape = new THREE.Shape()
        shape.moveTo(- depth * 0.5, 0)
        shape.lineTo(depth * 0.5, 0)
        shape.lineTo(0, height)
        shape.closePath()

        const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false })
        geometry.rotateY(Math.PI * 0.5)
        geometry.translate(x - width * 0.5, y, z)
        this.add(hex, geometry)
    }

    // The whole building is a single draw call
    build(parent)
    {
        const mesh = new THREE.Mesh(mergeGeometries(this.geometries), Builder.getMaterial())
        mesh.castShadow = true
        mesh.receiveShadow = true
        parent.add(mesh)

        for(const geometry of this.geometries)
            geometry.dispose()

        this.geometries = []
    }
}

export class Town
{
    constructor()
    {
        this.game = Game.getInstance()

        this.group = new THREE.Group()
        this.game.scene.add(this.group)

        this.colliders = []
        this.buildings = []

        this.setHome()
        this.setBuilding(places.codegang, {
            name: 'codegang',
            pointLabel: 'Visit codegang.in',
            onInteract: () => window.open(links.codegang, '_blank', 'noopener')
        })

        this.setBuilding(places.mathco, { name: 'mathco' })

        for(const signpost of signposts)
            this.setSignpost(signpost)

        // One fixed body for every wall
        this.game.objects.add(null, {
            type: 'fixed',
            category: 'floor',
            friction: 0.3,
            colliders: this.colliders
        })

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    addCollider(width, height, depth, x, y, z)
    {
        this.colliders.push({
            shape: 'cuboid',
            parameters: [ width * 0.5, height * 0.5, depth * 0.5 ],
            position: { x, y: y + height * 0.5, z }
        })
    }

    createTextTexture(lines, { width = 512, height = 256, background = '#1d1721', foreground = '#ffffff' } = {})
    {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const context = canvas.getContext('2d')
        context.fillStyle = background
        context.fillRect(0, 0, width, height)
        context.textAlign = 'center'
        context.textBaseline = 'middle'

        for(const line of lines)
        {
            context.font = line.font
            context.fillStyle = line.color ?? foreground
            context.fillText(line.text, width * 0.5, height * line.y, width * 0.92)
        }

        const canvasTexture = new THREE.CanvasTexture(canvas)
        canvasTexture.colorSpace = THREE.SRGBColorSpace
        canvasTexture.anisotropy = 4

        return canvasTexture
    }

    createPanel(canvasTexture, width, height)
    {
        const material = new MeshDefaultMaterial({
            colorNode: texture(canvasTexture).rgb,
            hasCoreShadows: false,
            hasLightBounce: false,
        })
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
        mesh.receiveShadow = true

        return mesh
    }

    /**
     * Home: open towards the camera when the player is inside
     */
    setHome()
    {
        const place = places.home
        const W = place.width
        const D = place.depth
        const H = 2.9
        const T = 0.24
        const floorY = 0.14
        const doorX = 1.4
        const doorWidth = 1.5
        const doorHeight = 2.15

        const wall = '#f1e3cf'
        const trim = '#7a4a34'
        const roof = '#d8452e'

        this.home = {}
        this.home.place = place
        this.home.isInside = false
        this.home.group = new THREE.Group()
        this.home.group.position.set(place.x, 0, place.z)
        this.group.add(this.home.group)

        // Always visible: floor and the two walls away from the camera
        const base = new Builder()
        base.box('#c99a6b', W, floorY, D, 0, 0, 0)
        base.box('#9a9088', 2.4, 0.07, 1.3, doorX, 0, D * 0.5 + 0.65)
        base.box(wall, W, H, T, 0, floorY, - D * 0.5 + T * 0.5)
        base.box(wall, T, H, D - T, - W * 0.5 + T * 0.5, floorY, T * 0.5)
        base.box(trim, W, 0.16, T + 0.04, 0, floorY, - D * 0.5 + T * 0.5)
        base.box(trim, T + 0.04, 0.16, D - T, - W * 0.5 + T * 0.5, floorY, T * 0.5)
        // Door frame: stays visible from the inside so the way out is obvious
        const zDoor = D * 0.5 - T * 0.5
        base.box(trim, 0.14, doorHeight, T + 0.08, doorX - doorWidth * 0.5 - 0.07, floorY, zDoor)
        base.box(trim, 0.14, doorHeight, T + 0.08, doorX + doorWidth * 0.5 + 0.07, floorY, zDoor)
        base.box(trim, doorWidth + 0.28, 0.14, T + 0.08, doorX, floorY + doorHeight, zDoor)
        base.build(this.home.group)

        // Exit cues, only shown from the inside
        this.home.exit = new THREE.Group()
        this.home.exit.visible = false
        this.home.group.add(this.home.exit)

        const exitMaterial = (canvasTexture) =>
        {
            const material = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide })
            material.colorNode = texture(canvasTexture).rgb.mul(1.7)
            material.opacityNode = texture(canvasTexture).a
            material.fog = false
            return material
        }

        const exitSignCanvas = document.createElement('canvas')
        exitSignCanvas.width = 256
        exitSignCanvas.height = 96
        const exitSignContext = exitSignCanvas.getContext('2d')
        exitSignContext.fillStyle = '#12301a'
        exitSignContext.fillRect(0, 0, 256, 96)
        exitSignContext.fillStyle = '#8cff5a'
        exitSignContext.font = '900 62px "Nunito"'
        exitSignContext.textAlign = 'center'
        exitSignContext.textBaseline = 'middle'
        exitSignContext.fillText('EXIT', 128, 52)
        const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.42), exitMaterial(new THREE.CanvasTexture(exitSignCanvas)))
        exitSign.position.set(doorX, floorY + doorHeight + 0.42, zDoor + 0.1)
        this.home.exit.add(exitSign)

        // Chevrons on the floor pointing at the door
        const arrowCanvas = document.createElement('canvas')
        arrowCanvas.width = 128
        arrowCanvas.height = 256
        const arrowContext = arrowCanvas.getContext('2d')
        arrowContext.strokeStyle = '#8cff5a'
        arrowContext.lineWidth = 16
        arrowContext.lineCap = 'round'
        arrowContext.lineJoin = 'round'
        for(let i = 0; i < 3; i++)
        {
            arrowContext.globalAlpha = 0.45 + i * 0.25
            arrowContext.beginPath()
            arrowContext.moveTo(26, 30 + i * 74)
            arrowContext.lineTo(64, 66 + i * 74)
            arrowContext.lineTo(102, 30 + i * 74)
            arrowContext.stroke()
        }
        const arrow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), exitMaterial(new THREE.CanvasTexture(arrowCanvas)))
        arrow.rotation.x = - Math.PI * 0.5
        arrow.position.set(doorX, floorY + 0.02, D * 0.5 - 1.25)
        this.home.exit.add(arrow)

        // Hidden when inside: camera-side walls and the roof
        this.home.shell = new THREE.Group()
        this.home.group.add(this.home.shell)

        const shell = new Builder()
        const zFront = D * 0.5 - T * 0.5
        const leftWidth = (doorX - doorWidth * 0.5) + W * 0.5
        const rightWidth = W * 0.5 - (doorX + doorWidth * 0.5)

        shell.box(wall, leftWidth, H, T, - W * 0.5 + leftWidth * 0.5, floorY, zFront)
        shell.box(wall, rightWidth, H, T, W * 0.5 - rightWidth * 0.5, floorY, zFront)
        shell.box(wall, doorWidth, H - doorHeight, T, doorX, floorY + doorHeight, zFront)
        shell.box(wall, T, H, D - T, W * 0.5 - T * 0.5, floorY, - T * 0.5)

        // Windows
        shell.box('#9fd8ff', 1.5, 1.1, T + 0.06, - 2.6, floorY + 1.05, zFront)
        shell.box(trim, 1.7, 0.1, T + 0.12, - 2.6, floorY + 0.95, zFront)
        shell.box('#9fd8ff', T + 0.06, 1.1, 1.6, W * 0.5 - T * 0.5, floorY + 1.05, - 0.4)
        shell.box(trim, T + 0.12, 0.1, 1.8, W * 0.5 - T * 0.5, floorY + 0.95, - 0.4)

        // Roof
        shell.box('#e9dcc8', W + 0.5, 0.18, D + 0.5, 0, floorY + H, 0)
        shell.gable(roof, W + 0.8, 1.7, D + 0.9, 0, floorY + H + 0.18, 0)
        shell.box('#8a8078', 0.7, 1.5, 0.7, - 3, floorY + H + 0.6, - 1.2)
        shell.build(this.home.shell)

        // Name plate
        const plate = this.createPanel(
            this.createTextTexture([
                { text: 'GOURAV', font: '700 120px "Amatic SC"', y: 0.42, color: '#ffe08a' },
                { text: 'HOME', font: '900 38px "Nunito"', y: 0.8, color: '#ffceca' },
            ], { width: 384, height: 256 }),
            1.2, 0.8
        )
        plate.position.set(doorX + doorWidth * 0.5 + 0.95, floorY + 1.75, D * 0.5 + 0.02)
        this.home.shell.add(plate)

        // Colliders
        const cx = place.x
        const cz = place.z
        this.addCollider(W, floorY, D, cx, 0, cz)
        this.addCollider(W, H, T, cx, floorY, cz - D * 0.5 + T * 0.5)
        this.addCollider(T, H, D, cx - W * 0.5 + T * 0.5, floorY, cz)
        this.addCollider(T, H, D, cx + W * 0.5 - T * 0.5, floorY, cz)
        this.addCollider(leftWidth, H, T, cx - W * 0.5 + leftWidth * 0.5, floorY, cz + zFront)
        this.addCollider(rightWidth, H, T, cx + W * 0.5 - rightWidth * 0.5, floorY, cz + zFront)

        this.setFurniture(W, D, floorY)

        // Wardrobe: change clothes (remembered for the next visit)
        const savedOutfit = outfits.find((outfit) => outfit.name === localStorage.getItem('lifeOutfit'))
        if(savedOutfit)
            this.game.player.foot.humanoid.setLook(savedOutfit.look)

        this.game.interactivePoints.create(
            new THREE.Vector3(place.x - W * 0.5 + 2.6, floorY + 1.9, place.z - D * 0.5 + 1.25),
            'Wardrobe',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.life.dialog.open({
                    id: 'wardrobe',
                    name: 'Wardrobe',
                    role: 'Change clothes',
                    greeting: 'What are you wearing today?',
                    topics: outfits.map((outfit) => ({
                        label: outfit.name,
                        action: () =>
                        {
                            this.game.player.foot.humanoid.setLook(outfit.look)
                            localStorage.setItem('lifeOutfit', outfit.name)
                            return [ `<strong>${outfit.name}</strong> it is. Pick another one or head out.` ]
                        }
                    })),
                })
            },
            () => this.game.inputs.interactiveButtons.addItems(['interact']),
            () => this.game.inputs.interactiveButtons.removeItems(['interact']),
            () => this.game.inputs.interactiveButtons.removeItems(['interact'])
        )
        this.setAchievementsWall(W, D, H, T, floorY)

        // Desk: recent achievements
        const deskPosition = new THREE.Vector3(place.x + 2.3, floorY + 1.7, place.z - D * 0.5 + 1.2)
        this.home.deskPoint = this.game.interactivePoints.create(
            deskPosition,
            'Recent achievements',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.life.dialog.open({
                    id: 'desk',
                    name: desk.name,
                    role: desk.role,
                    greeting: desk.lines,
                    topics: [
                        { label: 'CodeGang', url: links.codegang },
                        { label: 'LinkedIn', url: links.linkedin },
                        { label: 'GitHub', url: links.github },
                    ],
                })
            },
            () => this.game.inputs.interactiveButtons.addItems(['interact']),
            () => this.game.inputs.interactiveButtons.removeItems(['interact']),
            () => this.game.inputs.interactiveButtons.removeItems(['interact'])
        )
    }

    setFurniture(W, D, floorY)
    {
        const scale = 0.55
        const group = new THREE.Group()
        this.home.group.add(group)

        const models = new Map()
        for(const scene of this.game.resources.furnitureModel.scenes)
        {
            scene.traverse((child) =>
            {
                if(child.isMesh)
                    models.set(child.name, child)
            })
        }

        const place = (name, x, z, rotationY = 0, y = floorY, customScale = scale) =>
        {
            const model = models.get(name)

            if(!model)
                return null

            const mesh = model.clone()
            mesh.position.set(x, y, z)
            mesh.rotation.set(0, rotationY, 0)
            mesh.scale.setScalar(customScale)
            mesh.castShadow = true
            mesh.receiveShadow = true
            group.add(mesh)

            return mesh
        }

        const back = - D * 0.5
        const left = - W * 0.5

        // Bedroom corner
        place('bed_single_A', left + 0.85, back + 1.25)
        place('cabinet_medium_decorated', left + 2.6, back + 0.6)
        place('rug_oval_A', left + 2.3, back + 2.3, Math.PI * 0.5)

        // Desk
        place('table_medium_long', 2.3, back + 0.85)
        place('chair_A', 2.3, back + 1.75, Math.PI)
        place('lamp_table', 3.4, back + 0.6, 0, floorY + 0.55, 0.4)
        place('book_set', 1.35, back + 0.6, 0.3, floorY + 0.69)
        place('shelf_B_large_decorated', 4.2, back + 0.25, 0, floorY + 1.55)

        // Living corner
        place('couch_pillows', left + 0.75, 1.75, Math.PI * 0.5)
        place('rug_rectangle_stripes_A', left + 2.5, 1.75, Math.PI * 0.5)
        place('table_low', left + 2.5, 1.75, Math.PI * 0.5)
        place('lamp_standing', left + 0.6, 0.2)
        place('cactus_medium_A', 4.3, 2.75)
        place('armchair_pillows', left + 2.5, 3, Math.PI, floorY, 0.5)

        this.game.materials.updateObject(group)
        mergeStatic(group)

        // Laptop with a glowing screen on the desk
        const laptop = new Builder()
        laptop.box('#2a2a33', 0.5, 0.03, 0.34, 2.3, floorY + 0.55, back + 0.95)
        laptop.box('#2a2a33', 0.5, 0.32, 0.03, 2.3, floorY + 0.58, back + 0.78)
        laptop.build(group)

        const screenMaterial = new THREE.MeshBasicNodeMaterial()
        screenMaterial.colorNode = color('#8cff5a').mul(1.6)
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.26), screenMaterial)
        screen.position.set(2.3, floorY + 0.74, back + 0.8)
        screen.visible = false
        group.add(screen)
        this.home.screen = screen

        // Furniture you can't walk through
        const cx = this.home.place.x
        const cz = this.home.place.z
        this.addCollider(0.9, 0.6, 1.7, cx + left + 0.85, floorY, cz + back + 1.25)
        this.addCollider(1.15, 1, 0.6, cx + left + 2.6, floorY, cz + back + 0.6)
        this.addCollider(1.7, 0.6, 1.1, cx + 2.3, floorY, cz + back + 0.85)
        this.addCollider(0.9, 0.7, 1.7, cx + left + 0.75, floorY, cz + 1.75)
        this.addCollider(0.8, 0.3, 1.3, cx + left + 2.5, floorY, cz + 1.75)
    }

    setAchievementsWall(W, D, H, T, floorY)
    {
        const frameWidth = 1.15
        const frameHeight = 0.8
        const frames = new Builder()

        achievementsBoard.forEach((item, index) =>
        {
            const canvasTexture = this.createTextTexture([
                { text: item.title.toUpperCase(), font: '700 96px "Amatic SC"', y: 0.4, color: '#ffe08a' },
                { text: item.detail, font: '700 26px "Nunito"', y: 0.76, color: '#f3eef7' },
            ], { width: 512, height: 352, background: '#2a2331' })

            const panel = this.createPanel(canvasTexture, frameWidth, frameHeight)

            // First three on the back wall above the bed, the others on the side wall above the couch
            if(index < 3)
            {
                const x = - W * 0.5 + 1.3 + index * 1.45
                panel.position.set(x, floorY + 2.05, - D * 0.5 + T + 0.03)
                frames.box('#7a4a34', frameWidth + 0.12, frameHeight + 0.12, 0.04, x, floorY + 2.05 - (frameHeight + 0.12) * 0.5, - D * 0.5 + T + 0.005)
            }
            else
            {
                const z = 0.35 + (index - 3) * 1.4
                panel.rotation.y = Math.PI * 0.5
                panel.position.set(- W * 0.5 + T + 0.03, floorY + 2.05, z)
                frames.box('#7a4a34', 0.04, frameHeight + 0.12, frameWidth + 0.12, - W * 0.5 + T + 0.005, floorY + 2.05 - (frameHeight + 0.12) * 0.5, z)
            }

            this.home.group.add(panel)
        })

        frames.build(this.home.group)
    }

    /**
     * Simple landmark building with a sign facing the camera
     */
    setBuilding(place, options = {})
    {
        const W = place.width
        const D = place.depth
        const H = 4.2

        const group = new THREE.Group()
        group.position.set(place.x, 0, place.z)
        this.group.add(group)

        // A real building from the Downtown City MegaKit when one is set for this place
        if(place.model)
        {
            this.setKitBuilding(place, group, options)
            return
        }

        const builder = new Builder()
        const glass = '#9fd8ff'
        const dark = '#241d2c'

        // Body, plinth, roof
        builder.box('#8a8078', W + 0.5, 0.16, D + 0.5, 0, 0, 0)
        builder.box(place.wall, W, H, D, 0, 0.16, 0)
        builder.box(place.roof, W + 0.4, 0.3, D + 0.4, 0, 0.16 + H, 0)
        builder.box(place.roof, 1.6, 0.7, 1.4, - W * 0.25, 0.46 + H, - D * 0.15)

        // Accent band
        builder.box(place.accent, W + 0.06, 0.22, D + 0.06, 0, 0.16 + H * 0.56, 0)

        // Front (+Z): door, awning and windows
        const zFront = D * 0.5
        builder.box(dark, 1.5, 2.1, 0.1, 0, 0.16, zFront + 0.01)
        builder.box(place.accent, 2.2, 0.14, 0.9, 0, 2.36, zFront + 0.4)

        for(const side of [ - 1, 1 ])
        {
            builder.box(glass, W * 0.24, 1.3, 0.08, side * W * 0.31, 0.75, zFront + 0.01)
            builder.box(glass, W * 0.24, 0.8, 0.08, side * W * 0.31, 0.16 + H * 0.68, zFront + 0.01)
        }

        // Side (+X): windows
        for(const offset of [ - 0.25, 0.25 ])
        {
            builder.box(glass, 0.08, 1.3, D * 0.3, W * 0.5 + 0.01, 0.75, offset * D)
            builder.box(glass, 0.08, 0.8, D * 0.3, W * 0.5 + 0.01, 0.16 + H * 0.68, offset * D)
        }

        builder.build(group)

        // Sign above the roof line, facing the camera side
        const sign = this.createPanel(
            this.createTextTexture([
                { text: place.label, font: '700 150px "Amatic SC"', y: 0.4, color: place.accent },
                { text: place.sub, font: '700 34px "Nunito"', y: 0.8, color: '#ffffff' },
            ], { width: 768, height: 256, background: '#1d1721' }),
            W * 0.78, W * 0.26
        )
        sign.position.set(0, 0.16 + H + 0.3 + W * 0.13, zFront - 0.3)
        sign.castShadow = true
        group.add(sign)

        const signBack = new Builder()
        signBack.box('#1d1721', W * 0.78 + 0.16, W * 0.26 + 0.16, 0.14, 0, 0.16 + H + 0.22, zFront - 0.38)
        signBack.box('#1d1721', 0.14, 0.4, 0.14, - W * 0.3, 0.16 + H, zFront - 0.38)
        signBack.box('#1d1721', 0.14, 0.4, 0.14, W * 0.3, 0.16 + H, zFront - 0.38)
        signBack.build(group)

        this.addCollider(W, H + 0.4, D, place.x, 0, place.z)

        this.buildings.push({ group, place, height: H + 1.6 + W * 0.26 })

        // Optional interaction at the door
        if(options.pointLabel)
        {
            this.game.interactivePoints.create(
                new THREE.Vector3(place.x - 1.9, 2.2, place.z + zFront + 1.3),
                options.pointLabel,
                InteractivePoints.ALIGN_LEFT,
                InteractivePoints.STATE_CONCEALED,
                options.onInteract,
                () => this.game.inputs.interactiveButtons.addItems(['interact']),
                () => this.game.inputs.interactiveButtons.removeItems(['interact']),
                () => this.game.inputs.interactiveButtons.removeItems(['interact'])
            )
        }
    }

    setKitBuilding(place, group, options)
    {
        const model = this.game.resources[place.model].scene
        this.game.materials.updateObject(model)

        // Centre the footprint on the place and stand it on the ground
        model.scale.setScalar(place.modelScale)
        model.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(model)
        model.position.set(- (box.min.x + box.max.x) * 0.5, - box.min.y + 0.02, - (box.min.z + box.max.z) * 0.5)

        model.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.castShadow = true
                child.receiveShadow = true
            }
        })
        group.add(model)

        const width = box.max.x - box.min.x
        const depth = box.max.z - box.min.z
        const height = box.max.y - box.min.y
        place.width = width
        place.depth = depth

        // Sign on the front, above the ground floor
        const sign = this.createPanel(
            this.createTextTexture([
                { text: place.label, font: '700 150px "Amatic SC"', y: 0.4, color: place.accent },
                { text: place.sub, font: '700 34px "Nunito"', y: 0.8, color: '#ffffff' },
            ], { width: 768, height: 256, background: '#1d1721' }),
            4.2, 1.4
        )
        sign.position.set(0, 3.6, depth * 0.5 + 0.12)
        group.add(sign)

        this.addCollider(width, height, depth, place.x, 0, place.z)
        this.buildings.push({ group, place, height })

        if(options.pointLabel)
        {
            this.game.interactivePoints.create(
                new THREE.Vector3(place.x - 2.4, 2.2, place.z + depth * 0.5 + 1.3),
                options.pointLabel,
                InteractivePoints.ALIGN_LEFT,
                InteractivePoints.STATE_CONCEALED,
                options.onInteract,
                () => this.game.inputs.interactiveButtons.addItems(['interact']),
                () => this.game.inputs.interactiveButtons.removeItems(['interact']),
                () => this.game.inputs.interactiveButtons.removeItems(['interact'])
            )
        }
    }

    setSignpost(data)
    {
        const group = new THREE.Group()
        group.position.set(data.x, 0, data.z)
        this.group.add(group)

        const builder = new Builder()
        builder.box('#1d1721', 0.16, 2.3, 0.16, - 1.05, 0, 0)
        builder.box('#1d1721', 0.16, 2.3, 0.16, 1.05, 0, 0)
        builder.box('#1d1721', 2.6, 1.05, 0.1, 0, 1.45, - 0.04)
        builder.box(data.accent, 2.6, 0.1, 0.14, 0, 1.35, - 0.02)
        builder.build(group)

        const sign = this.createPanel(
            this.createTextTexture([
                { text: data.label, font: '700 150px "Amatic SC"', y: 0.4, color: data.accent },
                { text: data.sub, font: '700 34px "Nunito"', y: 0.8, color: '#ffffff' },
            ], { width: 640, height: 256, background: '#1d1721' }),
            2.4, 0.96
        )
        sign.position.set(0, 1.98, 0.03)
        group.add(sign)

        // Turned a little towards the camera
        group.rotation.y = Math.PI * 0.18

        this.addCollider(0.3, 2.3, 0.3, data.x - 0.9, 0, data.z + 0.5)
        this.addCollider(0.3, 2.3, 0.3, data.x + 0.9, 0, data.z - 0.5)
    }

    /**
     * Is the player hidden from the camera by a box of this footprint and height?
     * The camera always looks down the (-1, -1) diagonal.
     */
    isHiding(place, height, position)
    {
        const phi = this.game.view.spherical.phi
        const reach = height * Math.tan(phi)

        for(let distance = 0.6; distance <= reach; distance += 0.8)
        {
            const x = position.x + distance * Math.SQRT1_2
            const z = position.z + distance * Math.SQRT1_2

            if(Math.abs(x - place.x) < place.width * 0.5 + 0.2 && Math.abs(z - place.z) < place.depth * 0.5 + 0.2)
            {
                // Standing in front of it or inside is not "behind"
                const insideFootprint = Math.abs(position.x - place.x) < place.width * 0.5 && Math.abs(position.z - place.z) < place.depth * 0.5
                return !insideFootprint
            }
        }

        return false
    }

    update()
    {
        // Glowing things stay hidden until the world is revealed
        if(!this.home.screen.visible && this.game.reveal.step >= 1)
            this.home.screen.visible = true

        // Open the house towards the camera when the player is inside
        const place = this.home.place
        const position = this.game.player.position
        const margin = 0.15
        const isInside =
            this.game.player.mode === 'foot' &&
            Math.abs(position.x - place.x) < place.width * 0.5 + margin &&
            Math.abs(position.z - place.z) < place.depth * 0.5 + margin

        if(isInside !== this.home.isInside)
        {
            this.home.isInside = isInside
        }

        // Glowing exit cues only once the world is revealed
        this.home.exit.visible = isInside && this.game.reveal.step >= 1

        // Never lose the player behind a building: whatever stands between them and the camera is hidden
        this.home.shell.visible = !isInside && !this.isHiding(place, 4.9, position)

        for(const building of this.buildings)
            building.group.visible = !this.isHiding(building.place, building.height, position)

        // Camera: right behind the character indoors, a bit further on foot, far in the car
        if(this.game.reveal.step >= 2)
        {
            const zoom = isInside ? 1.12 : (this.game.player.mode === 'foot' ? 0.42 : null)

            if(zoom !== this.home.zoom)
            {
                this.home.zoom = zoom

                if(zoom !== null)
                    gsap.to(this.game.view.zoom, { baseRatio: zoom, duration: 1, ease: 'power2.out', overwrite: true })
            }
        }
    }
}
