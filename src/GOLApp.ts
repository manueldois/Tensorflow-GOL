import * as tf from '@tensorflow/tfjs-core'
import GOLCompute from "./GOLCompute";
import GOLVis from "./GOLVis";
import { printVectors, LOGGER, Timeline } from './util';
import GOLDraw from './GOLDraw';


/**
 * Glues the app togheter. Manages UI and communication between GOLCompute, GOLDraw, and GOLVis
 * @param GOLCompute The GOLCompute instance
 * @param GOLVis The GOLVis instance
 * @param GOLDraw The GOLDraw instance (optional)
 * 
 */
export default class GOLApp {
    STATE = {
        WORLD_SIZE: 200,
        FRAMES_PER_SECOND: 20,
        STEPS_PER_FRAME: 1,
        RUNNING: false,
        PAUSED: false,
        BACKEND: 'webgl',
        COLOR1: '#19dae0'
    }

    /**  A 2D World Tensor Variable Shape [H, W] Dtype int32.
    *  A zero is a dead cell. A value > zero is a living cell, and it represents the age of the cell.
    */
    WORLD: tf.Variable<tf.Rank.R2> | null = null

    /** List of HTMLElements that are marked as a control input in the HTML template */
    CONTROLS = document.querySelectorAll('[data-action]')
    /** List of HTMLElements that are marked as a binding variable in the HTML template */
    BINDINGS = document.querySelectorAll('[data-value]')

    INITIAL_WORLD: tf.Tensor<tf.Rank.R2> | null = null

    LOOPTIMER: number = 0

    constructor(public Compute: GOLCompute, public Vis: GOLVis, public Draw?: GOLDraw) {
        this.attachControls()
        this.updateUI()
        this.setupWorld()
        this.setBackend(this.STATE.BACKEND)
        this.Vis.setColors('', this.STATE.COLOR1)
    }

    attachControls() {
        const STATE = this.STATE
        const CONTROLS = this.CONTROLS

        CONTROLS.forEach((EL: any) => {
            const ACTION_NAME = EL.getAttribute('data-action')
            if (!ACTION_NAME) return
            const ACTION = this[ACTION_NAME]
            if (!ACTION) { console.error('No such action: ' + ACTION, EL); return }

            switch (EL.tagName) {
                case 'INPUT':
                    if (EL.type === 'range' || EL.type === 'color') {
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
                    if (EL.type === 'range' || EL.type === 'color') {
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
        if (!this.WORLD) return
        if (!this.STATE.RUNNING) return

        const TIMELINE = new Timeline('Loop')

        await this.Vis.render()
        TIMELINE.mark('Render')

        if (!this.STATE.PAUSED) {
            for (let i = 0; i < this.STATE.STEPS_PER_FRAME; i++) {
                this.Compute.nextState()
            }
            await this.WORLD.data()
            TIMELINE.mark('Compute')
        }

        TIMELINE.end()

        const TF_MEMORY = tf.memory()
        LOGGER.log("Render duration (ms)", TIMELINE.TIMES.get('Render'))
        LOGGER.log("Compute duration (ms)", TIMELINE.TIMES.get('Compute'))
        LOGGER.log("N Tensors in memory", TF_MEMORY.numTensors)
        LOGGER.log("N bytes in memory (kB)", Math.round(TF_MEMORY.numBytes / 1000))
        LOGGER.log("Population: ", tf.tidy(() => this.WORLD ? this.WORLD.toBool().sum().dataSync() : 0))

        LOGGER.log("Real FPS", Math.min(this.STATE.FRAMES_PER_SECOND, Math.round(1000 / TIMELINE.RUN_DURATION)))
        LOGGER.printLogToConsole()
        const TIME_TO_NEXT_FRAME = Math.max(0, 1000 / this.STATE.FRAMES_PER_SECOND - TIMELINE.RUN_DURATION)
        window.setTimeout(() => this.loop(), TIME_TO_NEXT_FRAME)
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

        if (this.WORLD) {
            this.WORLD.dispose()
        }

        this.WORLD = tf.variable(this.INITIAL_WORLD)
        this.Compute.useWorld(this.WORLD)
        this.Vis.useWorld(this.WORLD)

        if(this.Draw) this.Draw.useWorld(this.WORLD)
    }

    randomizeWorld() {
        const { WORLD_SIZE, RUNNING } = this.STATE

        if (this.INITIAL_WORLD) this.INITIAL_WORLD.dispose()
        this.INITIAL_WORLD = tf.randomUniform([WORLD_SIZE, WORLD_SIZE], -1, 2, 'int32')

        if (RUNNING) this.restart()
    }

    clear() {
        const { WORLD_SIZE } = this.STATE
        if (this.WORLD) {
            this.INITIAL_WORLD = tf.zeros([WORLD_SIZE, WORLD_SIZE], 'int32')
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
        console.log(paused)
        if (paused) {
            this.STATE.PAUSED = paused
        } else {
            this.STATE.PAUSED = false
        }
        this.updateUI()
    }

    onFPS(value: number) {
        this.STATE.FRAMES_PER_SECOND = value
        this.updateUI()
    }

    onColor(color: string){
        this.STATE.COLOR1 = color
        this.Vis.setColors('', color)
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