import './style/main.css'
import Application from './javascript/Application.js'
import { Analytics } from "@vercel/analytics/react"
window.application = new Application({
    $canvas: document.querySelector('.js-canvas'),
    useComposer: true
})
