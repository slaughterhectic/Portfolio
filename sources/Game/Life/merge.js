import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Collapses every visible static mesh under `root` into one mesh per material.
 * A parked car goes from 5-30 draw calls to 1-4, a furnished room from 16 to 1.
 */
export function mergeStatic(root)
{
    root.updateMatrixWorld(true)

    const inverse = root.matrixWorld.clone().invert()
    const byMaterial = new Map()
    const matrix = new THREE.Matrix4()

    root.traverseVisible((child) =>
    {
        if(!child.isMesh || child.isSkinnedMesh)
            return

        let geometry = child.geometry.clone()
        geometry.applyMatrix4(matrix.multiplyMatrices(inverse, child.matrixWorld))

        if(geometry.index)
            geometry = geometry.toNonIndexed()

        // Same attribute set for everybody
        for(const name of Object.keys(geometry.attributes))
        {
            if(name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color')
                geometry.deleteAttribute(name)
        }

        for(const name of [ 'normal', 'uv' ])
        {
            const attribute = geometry.attributes[name]

            if(!attribute)
                geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * (name === 'uv' ? 2 : 3)), name === 'uv' ? 2 : 3))
            else if(!(attribute.array instanceof Float32Array) || attribute.isInterleavedBufferAttribute)
            {
                const array = new Float32Array(attribute.count * attribute.itemSize)
                for(let i = 0; i < attribute.count; i++)
                    for(let j = 0; j < attribute.itemSize; j++)
                        array[i * attribute.itemSize + j] = attribute.getComponent(i, j)
                geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize))
            }
        }

        if(!byMaterial.has(child.material))
            byMaterial.set(child.material, { geometries: [], castShadow: false, receiveShadow: false })

        const entry = byMaterial.get(child.material)
        entry.geometries.push(geometry)
        entry.castShadow = entry.castShadow || child.castShadow
        entry.receiveShadow = entry.receiveShadow || child.receiveShadow
    })

    const merged = []

    for(const [ material, entry ] of byMaterial)
    {
        // Colours only survive if every part has them
        if(!entry.geometries.every((geometry) => geometry.attributes.color))
            entry.geometries.forEach((geometry) => geometry.deleteAttribute('color'))

        const geometry = mergeGeometries(entry.geometries)

        if(!geometry)
            return false

        const mesh = new THREE.Mesh(geometry, material)
        mesh.castShadow = entry.castShadow
        mesh.receiveShadow = entry.receiveShadow
        merged.push(mesh)
    }

    root.clear()

    for(const mesh of merged)
        root.add(mesh)

    return true
}
