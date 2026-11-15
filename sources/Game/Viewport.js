import { Events } from './Events.js'

export class Viewport
{
    constructor(domElement)
    {
        this.domElement = domElement

        this.events = new Events()
        
        this.measure()
        this.setResize()
    }

    measure()
    {
        const bounding = this.domElement.getBoundingClientRect()

        this.width = bounding.width
        this.height = bounding.height
        this.ratio = this.width / this.height

        this.pixelRatioPure = window.devicePixelRatio
        this.pixelRatioMax = 2
        this.pixelRatioNative = Math.min(this.pixelRatioPure, this.pixelRatioMax)

        // First guess from a pixel budget so the very first frames are already smooth,
        // then Smoothness.js keeps adjusting the scale from measured frame times
        if(typeof this.resolutionScale === 'undefined')
        {
            const pixelBudget = 2600000
            const nativePixels = this.width * this.height * this.pixelRatioNative * this.pixelRatioNative
            this.resolutionScale = Math.min(1, Math.sqrt(pixelBudget / nativePixels))
        }

        this.pixelRatioMin = Math.min(0.7, this.pixelRatioNative)
        this.pixelRatio = Math.max(this.pixelRatioMin, this.pixelRatioNative * this.resolutionScale)
    }

    setResolutionScale(scale)
    {
        const minScale = this.pixelRatioMin / this.pixelRatioNative
        this.resolutionScale = Math.min(1, Math.max(minScale, scale))
        this.pixelRatio = Math.max(this.pixelRatioMin, this.pixelRatioNative * this.resolutionScale)
        this.events.trigger('change')
    }

    setResize()
    {
        const throttleDuration = 400
        let throttleTimeout = null
        addEventListener('resize', () =>
        {
            this.measure()
            this.events.trigger('change')

            if(throttleTimeout)
            {
                clearTimeout(throttleTimeout)
            }

            throttleTimeout = setTimeout(() =>
            {
                throttleTimeout = null
                this.events.trigger('throttleChange')
            }, throttleDuration)
        })
    }
}