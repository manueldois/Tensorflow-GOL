import * as tf from '@tensorflow/tfjs-core'
import GOLVis from './GOLVis';

/** Provides functionaly to allow the user to draw onto the GOL World */
export default class GOLDraw {
    WORLD: tf.Variable<tf.Rank.R2> | null = null
    WORLD_SIZE: number | null = null

    FINGER_DOWN_TIME: number = 0

    constructor(public Vis: GOLVis) {
        this.attachEventListeners()
    }

    useWorld(WORLD: tf.Variable<tf.Rank.R2>) {
        const WORLD_SIZE = WORLD.shape[0]
        if (WORLD_SIZE < 0) throw new Error('WORLD_SIZE must be greater than zero')
        if (WORLD_SIZE % 1 !== 0) throw new Error('WORLD_SIZE must be an integer')

        this.WORLD_SIZE = WORLD_SIZE
        this.WORLD = WORLD
    }

    attachEventListeners() {
        const fingerDown = (e: (TouchEvent | MouseEvent)) => {
            this.FINGER_DOWN_TIME = Date.now()
        }

        const fingerUp = (e: (TouchEvent | MouseEvent)) => {
            // Detect a tap
            if (Date.now() - this.FINGER_DOWN_TIME < 200) {
                let MOUSE_COORDS: number[] = []

                if (e.type == 'mouseup') {
                    e = <MouseEvent> e
                    MOUSE_COORDS = [
                        (e.clientX),
                        (e.clientY)
                    ]
                }

                if (e.type == 'touchend') {
                    e = <TouchEvent> e
                    MOUSE_COORDS = [
                        (e.changedTouches[0].clientX),
                        (e.changedTouches[0].clientY)
                    ]
                }

                if(MOUSE_COORDS === []) return
                this.onClick(MOUSE_COORDS);
            }
        }

        this.Vis.BOARD_EL.addEventListener('mousedown', fingerDown)
        this.Vis.BOARD_EL.addEventListener('touchstart', fingerDown) // For mobile

        this.Vis.BOARD_EL.addEventListener('mouseup', fingerUp)
        this.Vis.BOARD_EL.addEventListener('touchend', fingerUp)
    }

    onClick(MOUSE_COORDS: number[]) {
        const CELL_COORDS = [
            Math.floor((MOUSE_COORDS[1] - this.Vis.BOARD.Y) / this.Vis.SCALE),
            Math.floor((MOUSE_COORDS[0] - this.Vis.BOARD.X) / this.Vis.SCALE),
        ];
        if (this.WORLD) {
            const BUFFER = this.WORLD.bufferSync();
            const CELL = BUFFER.get(...CELL_COORDS);
            CELL ? BUFFER.set(0, ...CELL_COORDS) : BUFFER.set(1, ...CELL_COORDS);
        }
    }
}