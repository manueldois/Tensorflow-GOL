import * as tf from '@tensorflow/tfjs-core'
import GOLCompute from "./GOLCompute";
import GOLVis from "./GOLVis";
import { printVectors, LOGGER, Timeline } from './util';
import GOLDraw from './GOLDraw';
import { Subject, Observable, fromEvent } from 'rxjs';
import { delayWhen } from 'rxjs/operators'

/**
 * Glues the app togheter. Manages UI and communication between GOLCompute, GOLDraw, and GOLVis
 * @param GOLCompute The GOLCompute instance
 * @param GOLVis The GOLVis instance
 * @param GOLDraw The GOLDraw instance (optional)
 * 
 */
export default class GOLApp {
    STATE = {
        WORLD_SIZE: 1000,
        FRAMES_PER_SECOND: 20,
        STEPS_PER_FRAME: 1,
        RUNNING: true,
        PAUSED: false,
        BACKEND: 'webgl',
        COLOR1: '#19dae0'
    }

    /**  A 2D World Tensor Variable Shape [H, W] Dtype int32.
    *  A zero is a dead cell. A value > zero is a living cell, and it represents the age of the cell.
    */
    WORLD: tf.Variable<tf.Rank.R2> | null = null

    LAST_ITER_TIME = Date.now()
    LAST_ITER_DONE = true
    LAST_ITER_COMPLETED = new Subject()

    /** List of HTMLElements that are marked as a control input in the HTML template */
    CONTROLS = document.querySelectorAll('[data-action]')
    /** List of HTMLElements that are marked as a binding variable in the HTML template */
    BINDINGS = document.querySelectorAll('[data-value]')

    INITIAL_WORLD: tf.Tensor<tf.Rank.R2> | null = null

    $RANDOMIZE_WORLD = fromEvent(<HTMLElement
        >document.getElementById('IN_randomize'),
        'click')

    constructor(public Compute: GOLCompute, public Vis: GOLVis, public Draw?: GOLDraw) {
        this.attachControls()
        this.updateUI()
        this.setBackend(this.STATE.BACKEND)
        this.setupWorld()
        this.Vis.setColors('', this.STATE.COLOR1)

        this.$RANDOMIZE_WORLD.pipe(
            delayWhen(() => this.LAST_ITER_COMPLETED)
        )
            .subscribe(() => {
                console.log('randomize')
                if(this.INITIAL_WORLD) this.INITIAL_WORLD.dispose()
                this.INITIAL_WORLD = tf.randomUniform([this.STATE.WORLD_SIZE, this.STATE.WORLD_SIZE],0,2,'int32')
                this.setupWorld()
            })
    }

    start() {
        setInterval(() => {
            if (this.LAST_ITER_DONE && !this.STATE.PAUSED
                 && this.STATE.RUNNING
                 && Date.now() - this.LAST_ITER_TIME > 1000 / this.STATE.FRAMES_PER_SECOND) {
                this.next()
            }
        })
    }

    async next() {
        if(!this.WORLD) return
        const TIMELINE = new Timeline('next')
        this.LAST_ITER_DONE = false

        await this.Vis.renderWithTF()
        TIMELINE.mark('Render')

        for(let i = 0; i < this.STATE.STEPS_PER_FRAME; i++){
            await this.Compute.nextState()
        }
        TIMELINE.mark('Compute')
        TIMELINE.end()

        const TF_MEMORY = tf.memory()
        LOGGER.log("Render duration (ms)", TIMELINE.TIMES.get('Render'))
        LOGGER.log("Compute duration (ms)", TIMELINE.TIMES.get('Compute'))
        LOGGER.log("N Tensors in memory", TF_MEMORY.numTensors)
        LOGGER.log("N bytes in memory (kB)", Math.round(TF_MEMORY.numBytes / 1000))
        LOGGER.log("Population: ", tf.tidy(() => this.WORLD ? this.WORLD.toBool().sum().dataSync() : 0))

        LOGGER.log("Real FPS", Math.min(this.STATE.FRAMES_PER_SECOND, Math.round(1000 / TIMELINE.RUN_DURATION)))
        LOGGER.printLogToConsole()

        this.LAST_ITER_DONE = true
        this.LAST_ITER_COMPLETED.next()
        this.LAST_ITER_TIME = Date.now()
    }

    setupWorld() {
        if (!this.INITIAL_WORLD) {
            this.INITIAL_WORLD = tf.zeros([this.STATE.WORLD_SIZE, this.STATE.WORLD_SIZE], 'int32')
        }

        if (this.WORLD) this.WORLD.dispose()
        this.WORLD = tf.variable(this.INITIAL_WORLD)

        this.Compute.useWorld(this.WORLD)
        this.Vis.useWorld(this.WORLD)
        if (this.Draw) this.Draw.useWorld(this.WORLD)
    }

    attachControls() {
        const STATE = this.STATE
        const CONTROLS = this.CONTROLS

        CONTROLS.forEach((EL: any) => {
            const ACTION_NAME = EL.getAttribute('data-action')
            if (!ACTION_NAME) return
            const ACTION = this[ACTION_NAME]
            if (!ACTION) { console.error('No such action: ' + ACTION_NAME, EL); return }

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

    onColor(color: string) {
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