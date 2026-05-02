import * as THREE from 'three'

export default class PlaygroundSection
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.resources = _options.resources
        this.objects = _options.objects
        this.areas = _options.areas
        this.walls = _options.walls
        this.tiles = _options.tiles
        this.debug = _options.debug
        this.x = _options.x
        this.y = _options.y

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('playgroundSection')
            // this.debugFolder.open()
        }

        // Set up
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        this.resources.items.areaResetTexture.magFilter = THREE.NearestFilter
        this.resources.items.areaResetTexture.minFilter = THREE.LinearFilter

        this.setStatic()
        this.setBricksWalls()
        this.setBowling()
        this.setToys()
    }

    setToys()
    {
        // A pocket of the playground filled with mixed-mass physics props.
        // Each toy uses a different mass / shadow / sound so the same drive-
        // through-and-knock-stuff-over mechanic feels distinct per group.
        this.toys = {}
        this.toys.x = this.x - 12
        this.toys.y = this.y - 6

        // ---- Traffic cones - a slalom row, medium mass, wood-clack sound
        this.toys.cones = []
        for(let i = 0; i < 6; i++)
        {
            this.toys.cones.push(this.objects.add({
                base: this.resources.items.coneBase.scene,
                collision: this.resources.items.coneCollision.scene,
                offset: new THREE.Vector3(this.toys.x + i * 2.2, this.toys.y, 0),
                rotation: new THREE.Euler(0, 0, 0),
                duplicated: true,
                shadow: { sizeX: 1.2, sizeY: 1.2, offsetZ: - 0.15, alpha: 0.4 },
                mass: 0.4,
                soundName: 'woodHit'
            }))
        }

        // ---- Awwwards trophy stack - heavy, harder to topple
        this.toys.trophies = []
        const trophyPositions = [
            [this.toys.x - 4, this.toys.y - 4],
            [this.toys.x - 2, this.toys.y - 4],
            [this.toys.x, this.toys.y - 4]
        ]
        for(const [tx, ty] of trophyPositions)
        {
            this.toys.trophies.push(this.objects.add({
                base: this.resources.items.awwwardsTrophyBase.scene,
                collision: this.resources.items.awwwardsTrophyCollision.scene,
                offset: new THREE.Vector3(tx, ty, 0),
                rotation: new THREE.Euler(0, 0, 0),
                duplicated: true,
                shadow: { sizeX: 1.3, sizeY: 1.3, offsetZ: - 0.15, alpha: 0.4 },
                mass: 2.0,
                soundName: 'brick'
            }))
        }

        // ---- Egg crate - very light, scatter on the slightest tap
        this.toys.eggs = []
        for(let i = 0; i < 12; i++)
        {
            const ex = this.toys.x + 4 + (i % 4) * 0.9
            const ey = this.toys.y - 4 + Math.floor(i / 4) * 0.9
            this.toys.eggs.push(this.objects.add({
                base: this.resources.items.eggBase.scene,
                collision: this.resources.items.eggCollision.scene,
                offset: new THREE.Vector3(ex, ey, 0.3),
                rotation: new THREE.Euler(0, 0, Math.random() * Math.PI),
                duplicated: true,
                shadow: { sizeX: 0.7, sizeY: 0.7, offsetZ: - 0.15, alpha: 0.35 },
                mass: 0.12,
                soundName: 'woodHit'
            }))
        }

        // ---- Webby trophy duo - heavier display piece
        this.toys.webby = []
        for(let i = 0; i < 2; i++)
        {
            this.toys.webby.push(this.objects.add({
                base: this.resources.items.webbyTrophyBase.scene,
                collision: this.resources.items.webbyTrophyCollision.scene,
                offset: new THREE.Vector3(this.toys.x + 10 + i * 2, this.toys.y, 0),
                rotation: new THREE.Euler(0, 0, 0),
                duplicated: true,
                shadow: { sizeX: 1.4, sizeY: 1.4, offsetZ: - 0.15, alpha: 0.4 },
                mass: 1.8,
                soundName: 'brick'
            }))
        }

        // ---- Lemon orchard - bouncy citrus pile
        this.toys.lemons = []
        for(let i = 0; i < 8; i++)
        {
            const lx = this.toys.x + 12 + (i % 4) * 0.9
            const ly = this.toys.y - 4 + Math.floor(i / 4) * 0.9
            this.toys.lemons.push(this.objects.add({
                base: this.resources.items.lemonBase.scene,
                collision: this.resources.items.lemonCollision.scene,
                offset: new THREE.Vector3(lx, ly, 0.4),
                rotation: new THREE.Euler(Math.random(), Math.random(), Math.random()),
                duplicated: true,
                shadow: { sizeX: 0.7, sizeY: 0.7, offsetZ: - 0.15, alpha: 0.35 },
                mass: 0.18,
                soundName: 'woodHit'
            }))
        }

        // ---- Diet-Coke-ish tower: vertical stack of orange bricks
        // (no soda-can model ships in the repo, so we fake it with bricks).
        this.toys.cokeTower = []
        const towerX = this.toys.x + 18
        const towerY = this.toys.y - 1
        for(let i = 0; i < 8; i++)
        {
            this.toys.cokeTower.push(this.objects.add({
                base: this.resources.items.brickBase.scene,
                collision: this.resources.items.brickCollision.scene,
                offset: new THREE.Vector3(towerX, towerY, 0.45 + i * 0.5),
                rotation: new THREE.Euler(0, 0, i % 2 === 0 ? 0 : Math.PI * 0.5),
                duplicated: true,
                shadow: { sizeX: 1.2, sizeY: 1.8, offsetZ: - 0.15, alpha: 0.35 },
                mass: 0.5,
                soundName: 'brick'
            }))
        }

        // ---- Reset all toys via a marked area
        this.toys.reset = () =>
        {
            const groups = [this.toys.cones, this.toys.trophies, this.toys.eggs, this.toys.webby, this.toys.lemons, this.toys.cokeTower]
            for(const group of groups)
            {
                for(const item of group)
                {
                    item.collision.reset()
                }
            }
        }

        this.toys.resetArea = this.areas.add({
            position: new THREE.Vector2(this.toys.x + 18, this.toys.y - 5),
            halfExtents: new THREE.Vector2(2, 2)
        })
        this.toys.resetArea.on('interact', () =>
        {
            this.toys.reset()
        })

        this.toys.areaLabelMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: 0xffffff, alphaMap: this.resources.items.areaResetTexture }))
        this.toys.areaLabelMesh.position.x = this.toys.x + 18
        this.toys.areaLabelMesh.position.y = this.toys.y - 5
        this.toys.areaLabelMesh.matrixAutoUpdate = false
        this.toys.areaLabelMesh.updateMatrix()
        this.container.add(this.toys.areaLabelMesh)

        if(this.debugFolder)
        {
            this.debugFolder.add(this.toys, 'reset').name('toys reset')
        }
    }

    setStatic()
    {
        this.objects.add({
            base: this.resources.items.playgroundStaticBase.scene,
            collision: this.resources.items.playgroundStaticCollision.scene,
            floorShadowTexture: this.resources.items.playgroundStaticFloorShadowTexture,
            offset: new THREE.Vector3(this.x, this.y, 0),
            mass: 0
        })
    }

    setBricksWalls()
    {
        // Set up
        this.brickWalls = {}
        this.brickWalls.x = this.x + 15
        this.brickWalls.y = this.y + 14
        this.brickWalls.items = []

        // Brick options
        this.brickWalls.brickOptions = {
            base: this.resources.items.brickBase.scene,
            collision: this.resources.items.brickCollision.scene,
            offset: new THREE.Vector3(0, 0, 0.1),
            rotation: new THREE.Euler(0, 0, 0),
            duplicated: true,
            shadow: { sizeX: 1.2, sizeY: 1.8, offsetZ: - 0.15, alpha: 0.35 },
            mass: 0.5,
            soundName: 'brick'
        }

        this.brickWalls.items.push(
            this.walls.add({
                object: this.brickWalls.brickOptions,
                shape:
                {
                    type: 'rectangle',
                    widthCount: 5,
                    heightCount: 6,
                    position: new THREE.Vector3(this.brickWalls.x - 6, this.brickWalls.y, 0),
                    offsetWidth: new THREE.Vector3(0, 1.05, 0),
                    offsetHeight: new THREE.Vector3(0, 0, 0.45),
                    randomOffset: new THREE.Vector3(0, 0, 0),
                    randomRotation: new THREE.Vector3(0, 0, 0.4)
                }
            }),
            this.walls.add({
                object: this.brickWalls.brickOptions,
                shape:
                {
                    type: 'brick',
                    widthCount: 5,
                    heightCount: 6,
                    position: new THREE.Vector3(this.brickWalls.x - 12, this.brickWalls.y, 0),
                    offsetWidth: new THREE.Vector3(0, 1.05, 0),
                    offsetHeight: new THREE.Vector3(0, 0, 0.45),
                    randomOffset: new THREE.Vector3(0, 0, 0),
                    randomRotation: new THREE.Vector3(0, 0, 0.4)
                }
            }),
            this.walls.add({
                object: this.brickWalls.brickOptions,
                shape:
                {
                    type: 'triangle',
                    widthCount: 6,
                    position: new THREE.Vector3(this.brickWalls.x - 18, this.brickWalls.y, 0),
                    offsetWidth: new THREE.Vector3(0, 1.05, 0),
                    offsetHeight: new THREE.Vector3(0, 0, 0.45),
                    randomOffset: new THREE.Vector3(0, 0, 0),
                    randomRotation: new THREE.Vector3(0, 0, 0.4)
                }
            })
        )

        // Reset
        this.brickWalls.reset = () =>
        {
            for(const _wall of this.brickWalls.items)
            {
                for(const _brick of _wall.items)
                {
                    _brick.collision.reset()
                }
            }
        }

        // Reset area
        this.brickWalls.resetArea = this.areas.add({
            position: new THREE.Vector2(this.brickWalls.x, this.brickWalls.y),
            halfExtents: new THREE.Vector2(2, 2)
        })
        this.brickWalls.resetArea.on('interact', () =>
        {
            this.brickWalls.reset()
        })

        // Reset label
        this.brickWalls.areaLabelMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: 0xffffff, alphaMap: this.resources.items.areaResetTexture }))
        this.brickWalls.areaLabelMesh.position.x = this.brickWalls.x
        this.brickWalls.areaLabelMesh.position.y = this.brickWalls.y
        this.brickWalls.areaLabelMesh.matrixAutoUpdate = false
        this.brickWalls.areaLabelMesh.updateMatrix()
        this.container.add(this.brickWalls.areaLabelMesh)

        // Debug
        if(this.debugFolder)
        {
            this.debugFolder.add(this.brickWalls, 'reset').name('brickWalls reset')
        }
    }

    setBowling()
    {
        this.bowling = {}
        this.bowling.x = this.x + 15
        this.bowling.y = this.y + 4

        this.bowling.pins = this.walls.add({
            object:
            {
                base: this.resources.items.bowlingPinBase.scene,
                collision: this.resources.items.bowlingPinCollision.scene,
                offset: new THREE.Vector3(0, 0, 0.1),
                rotation: new THREE.Euler(0, 0, 0),
                duplicated: true,
                shadow: { sizeX: 1.4, sizeY: 1.4, offsetZ: - 0.15, alpha: 0.35 },
                mass: 0.1,
                soundName: 'bowlingPin'
                // sleep: false
            },
            shape:
            {
                type: 'triangle',
                widthCount: 4,
                position: new THREE.Vector3(this.bowling.x - 25, this.bowling.y, 0),
                offsetWidth: new THREE.Vector3(0, 1, 0),
                offsetHeight: new THREE.Vector3(0.65, 0, 0),
                randomOffset: new THREE.Vector3(0, 0, 0),
                randomRotation: new THREE.Vector3(0, 0, 0)
            }
        })

        this.bowling.ball = this.objects.add({
            base: this.resources.items.bowlingBallBase.scene,
            collision: this.resources.items.bowlingBallCollision.scene,
            offset: new THREE.Vector3(this.bowling.x - 5, this.bowling.y, 0),
            rotation: new THREE.Euler(Math.PI * 0.5, 0, 0),
            duplicated: true,
            shadow: { sizeX: 1.5, sizeY: 1.5, offsetZ: - 0.15, alpha: 0.35 },
            mass: 1,
            soundName: 'bowlingBall'
            // sleep: false
        })

        // Reset
        this.bowling.reset = () =>
        {
            // Reset pins
            for(const _pin of this.bowling.pins.items)
            {
                _pin.collision.reset()
            }

            // Reset ball
            this.bowling.ball.collision.reset()
        }

        // Reset area
        this.bowling.resetArea = this.areas.add({
            position: new THREE.Vector2(this.bowling.x, this.bowling.y),
            halfExtents: new THREE.Vector2(2, 2)
        })
        this.bowling.resetArea.on('interact', () =>
        {
            this.bowling.reset()
        })

        // Reset label
        this.bowling.areaLabelMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: 0xffffff, alphaMap: this.resources.items.areaResetTexture }))
        this.bowling.areaLabelMesh.position.x = this.bowling.x
        this.bowling.areaLabelMesh.position.y = this.bowling.y
        this.bowling.areaLabelMesh.matrixAutoUpdate = false
        this.bowling.areaLabelMesh.updateMatrix()
        this.container.add(this.bowling.areaLabelMesh)

        // Debug
        if(this.debugFolder)
        {
            this.debugFolder.add(this.bowling, 'reset').name('bowling reset')
        }
    }
}
