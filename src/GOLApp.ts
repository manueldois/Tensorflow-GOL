import * as tf from '@tensorflow/tfjs-core'
import { IAppState } from "./interfaces";
import GOLCompute from "./GOLCompute";
import GOLVis from "./GOLVis";
import { printVectors, logger } from './util';
import GOLDraw from './GOLDraw';

export default class GOLApp {
    STATE: IAppState = {
        WORLD_SIZE: 100,
        FRAMES_PER_SECOND: 20,
        STEPS_PER_FRAME: 1,
        RUNNING: false,
        PAUSED: false,
        BACKEND: 'webgl'
    }

    CONTROLS = document.querySelectorAll('[data-action]')
    BINDINGS = document.querySelectorAll('[data-value]')

    WORLD: tf.Variable<tf.Rank.R2> | null = null
    INITIAL_WORLD: tf.Tensor<tf.Rank.R2> | null = null

    LOOPTIMER: number = 0

    constructor(public Compute: GOLCompute, public Vis: GOLVis, public Draw: GOLDraw) {
        this.attachUIEventListeners()
        this.updateUI()
        this.setupWorld()
        this.setBackend(this.STATE.BACKEND)
    }

    attachUIEventListeners() {
        const STATE = this.STATE
        const CONTROLS = this.CONTROLS

        CONTROLS.forEach((EL: any) => {
            const ACTION_NAME = EL.getAttribute('data-action')
            if (!ACTION_NAME) return
            const ACTION = this[ACTION_NAME]
            if (!ACTION) { console.error('No such action: ' + ACTION, EL); return }

            switch (EL.tagName) {
                case 'INPUT':
                    if (EL.type === 'range') {
                        EL.addEventListener('input', e => {
                            const VALUE = e.target.value
                            if (typeof ACTION === 'function') this[ACTION_NAME](VALUE)
                            if (typeof ACTION === 'string') STATE[ACTION] = VALUE
                        })
                    }
                    if (EL.type === 'checkbox') {
                        EL.addEventListener('change', e => {
                            const VALUE = e.target.checked
                            if (typeof ACTION === 'function') this[ACTION_NAME](VALUE)
                            if (typeof ACTION === 'string') STATE[ACTION] = VALUE
                        })
                    }
                    break;

                case 'SELECT':
                    EL.addEventListener('change', e => {
                        const VALUE = e.target.value
                        if (typeof ACTION === 'function') this[ACTION_NAME](VALUE)
                        if (typeof ACTION === 'string') STATE[ACTION] = VALUE
                    })
                    break;

                case 'BUTTON':
                    EL.addEventListener('click', e => {
                        if (typeof ACTION === 'function') this[ACTION_NAME]()
                    })
                    break;

                default:
                    break;
            }


        })
    }

    updateUI() {
        const STATE = this.STATE
        const BINDINGS = this.BINDINGS

        BINDINGS.forEach((EL: any) => {
            const VAR_NAME = EL.getAttribute('data-value')
            if (!VAR_NAME) return
            const VALUE = STATE[VAR_NAME]
            if (VALUE === undefined) { console.error('No such property: ', VAR_NAME); return }

            switch (EL.tagName) {
                case 'INPUT':
                    if (EL.type === 'range') {
                        EL.value = VALUE
                    }
                    if (EL.type === 'checkbox') {
                        EL.checked = VALUE
                    }
                    break;

                case 'SELECT':
                    EL.value = VALUE
                    break;

                default:
                    EL.textContent = VALUE
                    break;
            }
        })

    }

    async loop() {
        const time_start = Date.now()

        await this.Vis.render()
        logger.log("Render duration (ms)", Date.now() - time_start)

        if (!this.STATE.PAUSED) {
            const time_start_compute = Date.now()
            for (let i = 0; i < this.STATE.STEPS_PER_FRAME; i++) {
                this.Compute.nextState()
            }
            if(this.WORLD){
                await this.WORLD.data()
            }
            logger.log("Compute duration (ms)", Date.now() - time_start_compute)
        }
        this.LOOPTIMER = setTimeout(() => this.loop(), 1000 / this.STATE.FRAMES_PER_SECOND)
        logger.printLogToConsole()
    }

    start() {
        console.log('Start')
        if (!this.WORLD) this.setupWorld()
        this.STATE.RUNNING = true
        this.loop()
    }

    restart() {
        console.log("Restarting")
        this.setupWorld()
    }

    setupWorld() {
        const { WORLD_SIZE } = this.STATE

        // If there is not an initial world, or meanwhile the user changed the world size, just start at zeros
        if (!this.INITIAL_WORLD || this.INITIAL_WORLD.shape[0] !== WORLD_SIZE) {
            this.INITIAL_WORLD = <tf.Tensor<tf.Rank.R2>>tf.zeros([WORLD_SIZE, WORLD_SIZE], 'int32')
        }

        this.WORLD = tf.variable(this.INITIAL_WORLD)
        this.Compute.useWorld(this.WORLD)
        this.Vis.useWorld(this.WORLD)
        this.Draw.useWorld(this.WORLD)
    }

    randomizeWorld() {
        const { WORLD_SIZE, RUNNING } = this.STATE
        this.INITIAL_WORLD = tf.randomUniform([WORLD_SIZE, WORLD_SIZE], -1, 2, 'int32')

        if (RUNNING) this.restart()
    }

    clear() {
        const { WORLD_SIZE } = this.STATE
        if (this.WORLD) {
            this.INITIAL_WORLD = tf.zeros([WORLD_SIZE, WORLD_SIZE], 'bool')
        }
        this.restart()
    }

    next() {
        if (this.WORLD) {
            this.Compute.nextState()
            this.Vis.render()
        }
    }

    setBackend(backend: string) {
        this.STATE.BACKEND = backend
        tf.setBackend(backend)
        this.updateUI()
    }

    onPause(paused: boolean) {
        if (paused) {
            this.STATE.PAUSED = true
        } else {
            this.STATE.PAUSED = false
        }
        this.updateUI()
    }

    onFPS(value: number) {
        this.STATE.FRAMES_PER_SECOND = value
        this.updateUI()
    }

    onWorldSize(value: number) {
        this.STATE.WORLD_SIZE = Math.round(value)
        this.updateUI()
    }

    onStepsPerFrame(value: number) {
        this.STATE.STEPS_PER_FRAME = value
        this.updateUI()
    }
}