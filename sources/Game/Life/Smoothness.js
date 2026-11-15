import { Game } from '../Game.js'

/**
 * Keeps the frame rate high by adapting the render resolution (and, as a last
 * resort, the quality level) to what the device can actually sustain.
 */
export class Smoothness
{
    constructor()
    {
        this.game = Game.getInstance()

        this.targetLow = 50
        this.targetHigh = 57.5
        this.windowDuration = 1
        this.cooldown = 0
        this.goodWindows = 0
        this.badWindows = 0
        this.warmup = 4
        this.ceiling = 1
        this.ceilingExpiry = 0
        this.trial = null
        this.blockedUntil = 0

        this.frames = 0
        this.time = 0
        this.last = performance.now()
        this.fps = 60

        document.addEventListener('visibilitychange', () =>
        {
            this.reset()
        })

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 999)
    }

    reset()
    {
        this.frames = 0
        this.time = 0
        this.last = performance.now()
        this.goodWindows = 0
    }

    update()
    {
        const now = performance.now()
        const delta = (now - this.last) / 1000
        this.last = now

        // Tab was in the background or a long hitch (loading, shader compilation) => don't judge
        if(delta > 0.25 || document.hidden)
        {
            this.reset()
            return
        }

        this.frames++
        this.time += delta

        if(this.time < this.windowDuration)
            return

        this.fps = this.frames / this.time
        this.frames = 0
        this.time = 0

        // Wait for the world to be revealed and the first shaders to be compiled
        if(this.game.reveal.step < 2)
        {
            this.warmup = 8
            return
        }

        if(this.warmup > 0)
        {
            this.warmup--
            return
        }

        if(this.cooldown > 0)
        {
            this.cooldown--
            return
        }

        const viewport = this.game.viewport

        // Did the last reduction actually help? If not, the device is limited by the CPU,
        // not by the pixels: give the resolution back instead of blurring for nothing
        if(this.trial)
        {
            const trial = this.trial
            this.trial = null

            if(this.fps < trial.fps * 1.1)
            {
                if(trial.type === 'resolution')
                    viewport.setResolutionScale(trial.scale)
                else
                    this.game.quality.changeLevel(0)

                this.blockedUntil = now + 20000
                this.badWindows = 0
                this.cooldown = trial.type === 'resolution' ? 1 : 4
                return
            }
        }

        if(now < this.blockedUntil)
            return

        const scale = viewport.resolutionScale
        const atMinimum = viewport.pixelRatio <= viewport.pixelRatioMin + 0.001

        // Too slow (two windows in a row, a single one can be a hitch)
        if(this.fps < this.targetLow)
        {
            this.goodWindows = 0
            this.badWindows++

            // Lighter effects is a bigger step than resolution: ask for more evidence
            const needed = (viewport.pixelRatio <= 1.001 && this.game.quality.level === 0) ? 5 : 2

            if(this.badWindows < needed)
                return

            this.badWindows = 0
            const pixelRatio = viewport.pixelRatio

            // 1. Resolution down to 1x
            // 2. Lighter effects
            // 3. Resolution below 1x
            if(pixelRatio > 1.001 || (this.game.quality.level === 1 && !atMinimum))
            {
                const factor = Math.max(0.72, Math.min(0.92, Math.sqrt(this.fps / 60)))
                let newScale = scale * factor

                if(this.game.quality.level === 0)
                    newScale = Math.max(newScale, 1 / viewport.pixelRatioNative)

                this.ceiling = scale
                this.ceilingExpiry = now + 45000
                this.trial = { type: 'resolution', scale, fps: this.fps }
                viewport.setResolutionScale(newScale)
                this.cooldown = 1
            }
            else if(this.game.quality.level === 0)
            {
                this.trial = { type: 'quality', fps: this.fps }
                this.game.quality.changeLevel(1)
                this.cooldown = 4
            }
        }

        // Comfortable for a while => Try a slightly higher resolution
        else if(this.fps > this.targetHigh && scale < 1)
        {
            this.badWindows = 0
            this.goodWindows++

            if(now > this.ceilingExpiry)
                this.ceiling = 1

            if(this.goodWindows >= 6 && scale * 1.08 < this.ceiling)
            {
                this.goodWindows = 0
                viewport.setResolutionScale(scale * 1.08)
                this.cooldown = 1
            }
        }
        else
        {
            this.goodWindows = 0
            this.badWindows = 0
        }
    }
}
