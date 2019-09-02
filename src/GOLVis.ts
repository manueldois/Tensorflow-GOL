import { ISize, IVector, ITransform, IRect, IVisibleSquare } from './interfaces'
import * as tf from '@tensorflow/tfjs-core'
import panzoom, { PanZoom } from 'panzoom'
import { encode as PNGencoder } from 'fast-png'
import { printVectors } from './util'
import * as rxjs from 'rxjs'

/** Provides rendering, panning, and zooming for GOL.
 * @description
 * VIEWPORT contains BOARD contains IMG.
 * VIEWPORT can be any size in DOM. BOARD and IMG have their DOM size controlled by this class. 
 * BOARD floats in VIEWPORT, and has it's zoom and position controlled by panzoom.
 * In the DOM, 1px = 1cell. Zooming is achieved by using the view layer (css tranform)
*/
export default class GOLVis {
    constructor(public VIEWPORT_EL: HTMLElement, public BOARD_EL: HTMLElement, public IMG_EL: HTMLImageElement) {
        if (!VIEWPORT_EL) throw new Error('Got no viewport element')
        if (!BOARD_EL) throw new Error('Got no board element')
        if (!IMG_EL) throw new Error('Got no image element')

        this.PANZOOM = panzoom(this.BOARD_EL)

        this.updateViewport()
        this.attachEventListeners()
    }

    // A ref to the WORLD used thought the app
    WORLD: tf.Variable<tf.Rank.R2> | null = null
    WORLD_SIZE: number | null = null
    // Viewport has just height and width from DOM, in px
    // Changes on window resize
    VIEWPORT: ISize = {} as ISize
    // Board floats in Viewport using panzoom. Includes zoom. in px
    // Changes on pan or zoom
    BOARD: IRect = {} as IRect
    // IMG is where the WORLD is rendered,
    // It's offset from the board to make rendering only part of the grid possible
    IMG: IRect = {} as IRect
    IMG_LOAD_EVENT: rxjs.Observable<Event> | null = null

    /** VISIBLE_SQUARE stores the coordenates of the part of the world that is visible by the user,
     *  changes when BOARD or VIEWPORT change
    */
    VISIBLE_SQUARE: IVisibleSquare = {} as IVisibleSquare

    /** Panzoom instance. Panzoom is a library that provides pan and zoom to a DOM element.
     *  here used to pan and zoom the BOARD
     */
    PANZOOM: PanZoom

    /** Stores the same scale as Panzoom */
    SCALE = 1

    /** Binds a WORLD variable to the instance */
    useWorld(WORLD: tf.Variable<tf.Rank.R2>) {
        const WORLD_SIZE = WORLD.shape[0]
        if (WORLD_SIZE < 0) throw new Error('WORLD size must be greater than zero')
        if (WORLD_SIZE % 1 !== 0) throw new Error('WORLD size must be an integer')

        this.WORLD_SIZE = WORLD_SIZE
        this.WORLD = WORLD
        this.updateBoard()
        this.centerView()
    }

    attachEventListeners() {
        window.addEventListener('resize', () => { this.updateViewport() })

        this.IMG_LOAD_EVENT = rxjs.fromEvent(this.IMG_EL, 'load')

        this.PANZOOM.on('panend', (e: any) => {
            this.updateBoard()
        })

        this.PANZOOM.on('zoom', (e: any) => {
            const transform = e.getTransform()
            this.SCALE = transform.scale
            this.updateBoard()
        })

    }

    updateViewport() {
        this.VIEWPORT = {
            H: this.VIEWPORT_EL.getBoundingClientRect().height,
            W: this.VIEWPORT_EL.getBoundingClientRect().width
        }
        this.updateBoard()
    }

    updateBoard() {
        if (this.WORLD_SIZE !== null) {
            const transform = this.PANZOOM.getTransform()
            // BOARD in DOM is the same size in px as the world in cells
            this.BOARD_EL.style.width = this.BOARD_EL.style.height = `${this.WORLD_SIZE}px`
            this.BOARD = {
                X: <number>transform.x, // 1px = 1cell
                Y: <number>transform.y, // 1px = 1cell
                H: <number>transform.scale * this.WORLD_SIZE, // 1px = 1cell
                W: <number>transform.scale * this.WORLD_SIZE, // 1px = 1cell
            }
            this.updateVisibleSquare()
        }
    }

    updateVisibleSquare() {
        // Unpack vars
        const BOARD = this.BOARD,
            VIEWPORT = this.VIEWPORT,
            SCALE = this.SCALE,
            WORLD_SIZE = this.WORLD_SIZE

        if (WORLD_SIZE !== null) {
            // These represent the square of the world that is visible by the user
            // Cells from TOP to BOTTOM and LEFT to RIGHT
            // Initialized to the full world
            let TOP = 0, BOTTOM = WORLD_SIZE, LEFT = 0, RIGHT = WORLD_SIZE


            // Is some of the board above the viewport?
            if (BOARD.Y < 0) {
                TOP = Math.floor(-BOARD.Y / SCALE)
            }

            // Some bellow the viewport?
            if (BOARD.Y + BOARD.H > VIEWPORT.H) {
                BOTTOM = Math.ceil((VIEWPORT.H - BOARD.Y) / SCALE)
            }

            // Some left of the viewport?
            if (BOARD.X < 0) {
                LEFT = Math.floor(-BOARD.X / SCALE)
            }

            // Some right of the viewport?
            if (BOARD.X + BOARD.W > VIEWPORT.W) {
                RIGHT = Math.ceil((VIEWPORT.W - BOARD.X) / SCALE)
            }


            // The BOARD position is only updated on panend
            // When the user pans, the cells on the edges are not rendered 
            // because the VISIBLE SQUARE is out of date
            // So, instead of cutting the WORLD right at the viewport edge,
            // add some padding first
            const PADDING = Math.ceil(Math.max(VIEWPORT.H, VIEWPORT.W) / SCALE * 0.05)

            if (TOP > PADDING) {
                TOP -= PADDING
            } else {
                TOP = 0
            }

            if (BOTTOM < WORLD_SIZE - PADDING) {
                BOTTOM += PADDING
            } else {
                BOTTOM = WORLD_SIZE
            }

            if (LEFT > PADDING) {
                LEFT -= PADDING
            } else {
                LEFT = 0
            }

            if (RIGHT < WORLD_SIZE - PADDING) {
                RIGHT += PADDING
            } else {
                RIGHT = WORLD_SIZE
            }


            const WIDTH = RIGHT - LEFT, HEIGHT = BOTTOM - TOP

            this.VISIBLE_SQUARE = { TOP, LEFT, BOTTOM, RIGHT, WIDTH, HEIGHT, PADDING }
        } else {
            throw new Error('BOARD or VIEWPORT or WORLD_SIZE are null')
        }

        return
    }

    centerView() {
        if (this.WORLD_SIZE !== null) {
            const NEW_SCALE = this.VIEWPORT.W / this.WORLD_SIZE * 0.7;
            this.PANZOOM.zoomAbs(0, 0, NEW_SCALE);
            this.PANZOOM.moveTo((this.VIEWPORT.W - this.WORLD_SIZE * NEW_SCALE) / 2, (this.VIEWPORT.H - this.WORLD_SIZE * NEW_SCALE) / 2);
            this.SCALE = NEW_SCALE;
        }
    }

    /** Takes the WORLD set in useWorld and renders it as a png in IMG_EL. 
     * @description
     * Slices and downsamples the WORLD to the current VIEWPORT, then
     * colors it, converts it to a base64 string, and assigns it to IMG_EL.src.
     * Returns a promise that resolves when the browser has finished rendering 
     * the image.
    */
    render(): Promise<void> {
        /* fast-png can draw a maximum of 500 * 500 pixels.
            To render a larger WORLD, first crop and downsample as needed.
        */

        const { WORLD, IMG_LOAD_EVENT: IMG_LOAD, VISIBLE_SQUARE, IMG_EL } = this

        if (!WORLD) {
            console.error('No world to render')
            return Promise.reject('No world to render')
        }

        return new Promise((resolve, reject) => {
            let NEW_WIDTH, NEW_HEIGHT, IMG_SCALE, IMG_DATA

            // This is sync
            tf.tidy('Render', () => {
                const CROP_RESULT = cropAndDownsampleWorld(WORLD, VISIBLE_SQUARE);

                ({ NEW_WIDTH, NEW_HEIGHT, IMG_SCALE } = CROP_RESULT); // We need this info outside the tidy scope

                const WORLD_COLORED = colorWorld(CROP_RESULT.WORLD3D)
                IMG_DATA = tensorToDataArray(WORLD_COLORED)
            })

            drawImage(IMG_DATA, NEW_WIDTH, NEW_HEIGHT, this.IMG_EL)
                .then(() => {
                    offsetImage(VISIBLE_SQUARE, IMG_SCALE, this.IMG_EL)
                })
                .then(() => {
                    resolve()
                })

            /** Crops and downsamples a 2D WORLD to its visible size.
             * Returns a 3D WORLD because it's useful to color in the next operation
             */
            function cropAndDownsampleWorld(WORLD: tf.Tensor<tf.Rank.R2>, VISIBLE_SQUARE: IVisibleSquare) {
                // PNG encoder can draw a max of 500 * 500 px
                // Grid can be much larger
                // Cut and resize, then downscale using tensorflow

                const { TOP, LEFT, BOTTOM, RIGHT, WIDTH, HEIGHT } = VISIBLE_SQUARE

                // If size > 500 * 500 px, IMG_SCALE = 0.5, if > 500 * 500 * 2 px, 0.25 etc
                const IMG_SCALE = 1 / Math.ceil(Math.sqrt((WIDTH * HEIGHT) / (500 * 500)))

                const NEW_WIDTH = Math.ceil(WIDTH * IMG_SCALE),
                    NEW_HEIGHT = Math.ceil(HEIGHT * IMG_SCALE)

                const WORLD3D_CROPPED_RESIZED =
                    (<tf.Tensor<tf.Rank.R3>>WORLD.slice([TOP, LEFT], [HEIGHT, WIDTH])
                        .expandDims(2)
                        .toInt()
                    )
                        .resizeNearestNeighbor([NEW_HEIGHT, NEW_WIDTH])

                return { WORLD3D: WORLD3D_CROPPED_RESIZED, NEW_WIDTH, NEW_HEIGHT, IMG_SCALE }

            }

            function colorWorld(WORLD3D: tf.Tensor<tf.Rank.R3>) {
                const COLOR = tf.tensor3d([[[255, 0, 255]]])
                return WORLD3D.tile([1,1,3]).mul(COLOR)
            }

            function tensorToDataArray(WORLD: tf.Tensor<tf.Rank>) {
                return new Uint8Array(WORLD.bufferSync().values)
            }

            function drawImage(DATA_ARRAY, WIDTH, HEIGHT, IMG_EL: HTMLImageElement) {
                return new Promise((resolve, reject) => {

                    // Function encode from fast-png 
                    const encoded = PNGencoder({
                        width: WIDTH,
                        height: HEIGHT,
                        data: DATA_ARRAY,
                        channels: 3
                    })

                    const b64 = btoa(String.fromCharCode(...encoded))
                    IMG_EL.src = `data:image/png;base64,${b64}`

                    // If we are watching the image onload event wait for it
                    if (IMG_LOAD) {
                        IMG_LOAD.subscribe(() => resolve())
                    } else {
                        resolve()
                    }

                })
            }

            function offsetImage(VISIBLE_SQUARE, IMG_SCALE, IMG_EL) {
                // If we are cutting the world from LEFT or TOP, the image in the DOM will be smaller and shift up or left
                // To adjust, translate the image relative to BOARD, and scale to compensate for downsampling
                return new Promise((resolve, reject) => {
                    const { TOP, LEFT, WIDTH, HEIGHT } = VISIBLE_SQUARE
                    IMG_EL.style.transform = `translate(${LEFT || 0}px, ${TOP || 0}px) scale(${1 / IMG_SCALE},${1 / IMG_SCALE})`
                    resolve()
                })
            }

        })
    }


}

