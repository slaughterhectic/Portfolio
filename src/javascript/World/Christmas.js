import * as THREE from 'three'

export default class Christmas
{
    constructor(_options)
    {
        this.scene = _options.scene
        this.time = _options.time
        this.renderer = _options.renderer

        this.setSnow()
    }

    setSnow()
    {
        this.snow = {}
        this.snow.count = 2000
        this.snow.geometry = new THREE.BufferGeometry()
        this.snow.positions = new Float32Array(this.snow.count * 3)
        this.snow.velocities = new Float32Array(this.snow.count)

        for(let i = 0; i < this.snow.count; i++)
        {
            this.snow.positions[i * 3 + 0] = (Math.random() - 0.5) * 80
            this.snow.positions[i * 3 + 1] = (Math.random() - 0.5) * 80
            this.snow.positions[i * 3 + 2] = (Math.random() - 0.5) * 80
            
            this.snow.velocities[i] = Math.random()
        }

        this.snow.geometry.setAttribute('position', new THREE.BufferAttribute(this.snow.positions, 3))
        
        this.snow.material = new THREE.PointsMaterial({
            size: 0.1,
            sizeAttenuation: true,
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        })

        this.snow.points = new THREE.Points(this.snow.geometry, this.snow.material)
        this.scene.add(this.snow.points)

        // Update
        this.time.on('tick', () =>
        {
            for(let i = 0; i < this.snow.count; i++)
            {
                const i3 = i * 3

                this.snow.positions[i3 + 1] -= this.snow.velocities[i] * 0.05
                this.snow.positions[i3 + 0] += Math.sin(this.time.elapsed * 0.001 + this.snow.positions[i3 + 1]) * 0.01

                if(this.snow.positions[i3 + 1] < - 40)
                {
                    this.snow.positions[i3 + 1] = 40
                }
            }

            this.snow.geometry.attributes.position.needsUpdate = true
        })
    }
}
