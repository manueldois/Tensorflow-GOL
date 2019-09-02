import { ISize, IVector, ITransform, IRect, IVisibleSquare } from './interfaces'
import * as tf from '@tensorflow/tfjs-core'
import GOLVis from './GOLVis';
import * as rxjs from 'rxjs'
import { throttle, delay, debounce, last, debounceTime, buffer } from 'rxjs/operators'
import { printVectors } from './util';

export default class GOLDraw {
    WORLD: tf.Variable<tf.Rank.R2> | null = null
    WORLD_SIZE: number | null = null

    MOUSEDOWNTIME: number = 0

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
        this.Vis.BOARD_EL.addEventListener('mousedown', () => {
            this.MOUSEDOWNTIME = Date.now()
        })

        this.Vis.BOARD_EL.addEventListener('mouseup', e => {
            if(Date.now() - this.MOUSEDOWNTIME < 200){

                const MOUSE_COORDS = [
                    (e.clientX), 
                    (e.clientY)
                ]

                const CELL_COORDS = [
                    Math.floor((MOUSE_COORDS[1] - this.Vis.BOARD.Y) / this.Vis.SCALE),
                    Math.floor((MOUSE_COORDS[0] - this.Vis.BOARD.X) / this.Vis.SCALE),
                ]

                if(this.WORLD){
                    const BUFFER = this.WORLD.bufferSync()
                    const CELL = BUFFER.get(...CELL_COORDS)
                    CELL ? BUFFER.set(0, ...CELL_COORDS) : BUFFER.set(1, ...CELL_COORDS)
                    this.Vis.render()
                }
            }
        })
    }
}