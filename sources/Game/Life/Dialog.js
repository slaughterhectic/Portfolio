import { Game } from '../Game.js'
import { Events } from '../Events.js'
import { Player } from '../Player.js'

/**
 * Conversation panel: a few lines of speech, then a list of topics.
 */
export class Dialog
{
    constructor()
    {
        this.game = Game.getInstance()
        this.events = new Events()

        this.element = document.querySelector('.js-dialog')
        this.nameElement = this.element.querySelector('.js-name')
        this.roleElement = this.element.querySelector('.js-role')
        this.textElement = this.element.querySelector('.js-text')
        this.choicesElement = this.element.querySelector('.js-choices')
        this.nextElement = this.element.querySelector('.js-next')

        this.isOpen = false
        this.current = null
        this.queue = []
        this.choices = []
        this.seen = new Set()
        this.previousFilters = []

        this.setInputs()
    }

    setInputs()
    {
        const actions = [
            { name: 'dialogNext', categories: [ 'dialog' ], keys: [ 'Keyboard.Enter', 'Keyboard.KeyE', 'Keyboard.Space', 'Gamepad.cross' ] },
            { name: 'dialogClose', categories: [ 'dialog' ], keys: [ 'Keyboard.Escape', 'Gamepad.circle' ] },
        ]

        for(let i = 1; i <= 6; i++)
            actions.push({ name: `dialogChoice${i}`, categories: [ 'dialog' ], keys: [ `Keyboard.Digit${i}`, `Keyboard.Numpad${i}` ] })

        this.game.inputs.addActions(actions)

        this.game.inputs.events.on('dialogNext', (action) =>
        {
            // The key press that opened the dialog must not also advance it
            if(action.active && performance.now() - this.openedAt > 250)
                this.next()
        })

        this.game.inputs.events.on('dialogClose', (action) =>
        {
            if(action.active)
                this.close()
        })

        for(let i = 1; i <= 6; i++)
        {
            this.game.inputs.events.on(`dialogChoice${i}`, (action) =>
            {
                if(action.active && this.queue.length === 0 && this.choices[i - 1])
                    this.choose(this.choices[i - 1])
            })
        }

        this.nextElement.addEventListener('click', (event) =>
        {
            event.preventDefault()
            this.next()
        })
    }

    /**
     * conversation: { id, name, role, greeting, topics: [ { label, lines?, url?, action?, type? } ], onClose }
     */
    open(conversation)
    {
        if(this.isOpen)
            return

        this.isOpen = true
        this.current = conversation
        this.openedAt = performance.now()

        this.nameElement.textContent = conversation.name
        this.roleElement.textContent = conversation.role ?? ''

        // Inputs
        this.previousFilters = [ ...this.game.inputs.filters ]
        this.game.inputs.filters.clear()
        this.game.inputs.filters.add('dialog')
        this.game.player.state = Player.STATE_LOCKED
        this.game.interactivePoints.temporaryHide()

        document.documentElement.classList.add('has-dialog')
        this.element.classList.add('is-visible')

        this.say(Array.isArray(conversation.greeting) ? conversation.greeting : [ conversation.greeting ])
        this.events.trigger('open', [ conversation ])
    }

    say(lines)
    {
        this.queue = [ ...lines ]
        this.showLine()
    }

    showLine()
    {
        const line = this.queue.shift()

        this.textElement.innerHTML = line

        // Last line => Show the topics
        if(this.queue.length === 0)
            this.showChoices()
        else
            this.hideChoices()
    }

    hideChoices()
    {
        this.choices = []
        this.choicesElement.replaceChildren()
        this.nextElement.textContent = 'Next'
    }

    showChoices()
    {
        const topics = typeof this.current.topics === 'function' ? this.current.topics() : this.current.topics
        this.choices = [ ...topics, { label: 'Goodbye', type: 'close' } ]
        this.choicesElement.replaceChildren()

        this.choices.forEach((choice, index) =>
        {
            const button = document.createElement('button')
            button.className = 'choice'

            if(choice.type === 'mission')
                button.classList.add('is-mission')
            if(choice.url)
                button.classList.add('is-link')
            if(this.seen.has(`${this.current.id}:${choice.label}`))
                button.classList.add('is-seen')

            const indexElement = document.createElement('span')
            indexElement.className = 'index'
            indexElement.textContent = index + 1

            const labelElement = document.createElement('span')
            labelElement.textContent = choice.url ? `${choice.label} ↗` : choice.label

            button.append(indexElement, labelElement)
            button.addEventListener('click', () =>
            {
                this.choose(choice)
            })

            this.choicesElement.append(button)
        })

        this.nextElement.textContent = 'Leave'
    }

    choose(choice)
    {
        if(!this.isOpen)
            return

        this.seen.add(`${this.current.id}:${choice.label}`)

        if(choice.type === 'close')
        {
            this.close()
            return
        }

        if(choice.url)
        {
            window.open(choice.url, '_blank', 'noopener')
            this.showChoices()
            return
        }

        if(typeof choice.action === 'function')
        {
            const result = choice.action()

            // The action can answer with lines or end the conversation
            if(result === false)
            {
                this.close()
                return
            }

            if(Array.isArray(result))
            {
                this.say(result)
                return
            }
        }

        if(choice.lines)
            this.say(choice.lines)
    }

    next()
    {
        if(!this.isOpen)
            return

        if(this.queue.length)
            this.showLine()
        else
            this.close()
    }

    close()
    {
        if(!this.isOpen)
            return

        this.isOpen = false
        this.element.classList.remove('is-visible')
        document.documentElement.classList.remove('has-dialog')

        // Inputs
        this.game.inputs.filters.clear()
        for(const filter of this.previousFilters)
            this.game.inputs.filters.add(filter)

        this.game.player.state = Player.STATE_DEFAULT
        this.game.interactivePoints.recover()

        const conversation = this.current
        this.current = null

        if(typeof conversation.onClose === 'function')
            conversation.onClose()

        this.events.trigger('close', [ conversation ])
    }
}
