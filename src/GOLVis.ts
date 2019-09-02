import { ISize, IVector, ITransform, IRect, IVisibleSquare } from './interfaces'
import * as tf from '@tensorflow/tfjs-core'
import panzoom, { PanZoom } from 'panzoom'
import { encode } from 'fast-png'
import { printVectors } from './util'
import * as rxjs from 'rxjs'

/** Provides rendering, panning, and zooming for GOL  */
export default class GOLVis {
    constructor() {
        const VIEWPORT_EL = document.getElementById('viewport')
        const BOARD_EL = document.getElementById('board')
        const IMG_EL = document.getElementById('world')
        // const GRID_EL = document.getElementById('grid')
        if (!VIEWPORT_EL) throw new Error('Got no viewport element')
        if (!BOARD_EL) throw new Error('Got no board element')
        if (!IMG_EL) throw new Error('Got no image element')
        // if (!GRID_EL) throw new Error('Got no grid element')

        this.VIEWPORT_EL = VIEWPORT_EL
        this.BOARD_EL = BOARD_EL
        this.IMG_EL = <HTMLImageElement>IMG_EL
        // this.GRID_EL = <HTMLCanvasElement>GRID_EL

        this.PANZOOM = panzoom(this.BOARD_EL)

        this.updateViewport()
        this.attachEventListeners()
    }

    // VIEWPORT contains BOARD contains IMG
    // 1 cell = 1 px in IMG.
    // Zoom and pan is controlled by panzoom library, using transform: translate and scale 

    // A ref to the WORLD used thought the app
    WORLD: tf.Variable<tf.Rank.R2> | null = null
    WORLD_SIZE: number | null = null
    // Viewport has just height and width from DOM, in px
    // Changes on window resize
    VIEWPORT: ISize = {} as ISize
    VIEWPORT_EL: HTMLElement
    // Board floats in Viewport using panzoom. Includes zoom. in px
    // Changes on pan or zoom
    BOARD: IRect = {} as IRect
    BOARD_EL: HTMLElement
    // IMG is where the WORLD is rendered,
    // It's offset from the board to make rendering only part of the grid possible
    IMG: IRect = {} as IRect
    IMG_EL: HTMLImageElement
    IMG_LOAD: rxjs.Observable<Event> | null = null
    // GRID is the canvas grid above the image, just to render the grid lines (fixed)
    // GRID_EL: HTMLCanvasElement
    // VISIBLE_SQUARE stores the coordenates of the part of the world that is visible by the user
    // Changes when BOARD or VIEWPORT change
    VISIBLE_SQUARE: IVisibleSquare = {} as IVisibleSquare

    PANZOOM: PanZoom
    SCALE = 1

    LOG: any = {}


    useWorld(WORLD: tf.Variable<tf.Rank.R2>) {
        const WORLD_SIZE = WORLD.shape[0]
        if (WORLD_SIZE < 0) throw new Error('WORLD_SIZE must be greater than zero')
        if (WORLD_SIZE % 1 !== 0) throw new Error('WORLD_SIZE must be an integer')

        this.WORLD_SIZE = WORLD_SIZE
        this.WORLD = WORLD
        this.updateBoard()
        this.centerView()
    }

    attachEventListeners() {
        window.addEventListener('resize', () => { this.updateViewport() })

        this.IMG_LOAD = rxjs.fromEvent(this.IMG_EL, 'load')

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

    // renderGrid() {
    //     const { WORLD_SIZE } = this
    //     if (!WORLD_SIZE) return
    //     this.GRID_EL.width = WORLD_SIZE * 20
    //     this.GRID_EL.height = WORLD_SIZE * 20


    //     const CTX = <CanvasRenderingContext2D>this.GRID_EL.getContext('2d')
    //     CTX.strokeStyle = '#FFFFFF'
    //     CTX.lineWidth = 1

    //     // CTX.restore()

    //     const GRID_CELL_SIZE = 20
    //     console.log({ GRID_CELL_SIZE })

    //     for (let col = 1; col <= WORLD_SIZE; col++) {
    //         CTX.moveTo(col * GRID_CELL_SIZE, 0);
    //         CTX.lineTo(col * GRID_CELL_SIZE, WORLD_SIZE * GRID_CELL_SIZE)
    //     }

    //     for (let row = 1; row <= WORLD_SIZE; row++) {
    //         CTX.moveTo(0, row * GRID_CELL_SIZE);
    //         CTX.lineTo(WORLD_SIZE * GRID_CELL_SIZE, row * GRID_CELL_SIZE)
    //     }
    //     CTX.stroke();
    // }

    render() {
        const { WORLD, IMG_LOAD, VISIBLE_SQUARE, IMG_EL } = this
        if (!WORLD) {
            console.error('No world to render')
            return
        }
        return new Promise((resolve, reject) => {
            // Rendering is the slowest part of the app
            // Instead of rendering the whole world, 
            // it's much faster to cut the world with the viewport and render just that.
            // 0,0 is top-left

            let NEW_WIDTH, NEW_HEIGHT, IMG_SCALE, IMG_DATA

            tf.tidy('Render', () => {
                const CROP_OPERATION = cropAndResizeWorld(WORLD, VISIBLE_SQUARE);
                ({ NEW_WIDTH, NEW_HEIGHT, IMG_SCALE } = CROP_OPERATION);
                IMG_DATA = tensorToDataArray(CROP_OPERATION.WORLD_CROPPED_RESIZED.mul(255))
            })

            // console.log(IMG_DATA, NEW_WIDTH, NEW_HEIGHT)

            drawImage(IMG_DATA, NEW_WIDTH, NEW_HEIGHT, this.IMG_EL)
            offsetImage(VISIBLE_SQUARE, IMG_SCALE, this.IMG_EL)

            function cropAndResizeWorld(WORLD: tf.Tensor<tf.Rank.R2>, VISIBLE_SQUARE: IVisibleSquare) {
                // PNG encoder can draw a max of 500 * 500 px
                // Grid can be much larger
                // Cut and resize, then downscale using tensorflow

                const { TOP, LEFT, BOTTOM, RIGHT, WIDTH, HEIGHT } = VISIBLE_SQUARE

                // If size > 500 * 500 px, IMG_SCALE = 0.5, if > 500 * 500 * 2 px, 0.25 etc
                const IMG_SCALE = 1 / Math.ceil(Math.sqrt((WIDTH * HEIGHT) / (500 * 500)))

                const NEW_WIDTH = Math.ceil(WIDTH * IMG_SCALE),
                    NEW_HEIGHT = Math.ceil(HEIGHT * IMG_SCALE)

                const WORLD_CROPPED_RESIZED =
                    (<tf.Tensor<tf.Rank.R2>>
                        (<tf.Tensor<tf.Rank.R3>>WORLD.slice([TOP, LEFT], [HEIGHT, WIDTH])
                            .expandDims(2)
                            .toInt()
                        )
                            .resizeNearestNeighbor([NEW_HEIGHT, NEW_WIDTH])
                            .squeeze()
                    )

                return { WORLD_CROPPED_RESIZED, NEW_WIDTH, NEW_HEIGHT, IMG_SCALE }

            }

            function tensorToDataArray(WORLD: tf.Tensor<tf.Rank.R2>) {
                return new Uint8Array(WORLD.bufferSync().values)
            }

            function drawImage(DATA_ARRAY, WIDTH, HEIGHT, IMG_EL: HTMLImageElement) {
                return new Promise((resolve, reject) => {

                    // Using fast-png to encode the WORLD from a 2D array of one channel color
                    // to a Uint8Array with the PNG data

                    const encoded = encode({
                        width: WIDTH,
                        height: HEIGHT,
                        data: DATA_ARRAY,
                        channels: 1
                    })

                    const b64 = btoa(String.fromCharCode(...encoded))
                    IMG_EL.src = `data:image/png;base64,${b64}`

                    if (IMG_LOAD) {
                        IMG_LOAD.subscribe(() => resolve())
                    }

                })
            }

            function offsetImage(VISIBLE_SQUARE, IMG_SCALE, IMG_EL) {
                return new Promise((resolve, reject) => {

                    // If we are cutting the world from LEFT or TOP, the image in the DOM will be smaller and shift up or left
                    // To adjust, translate the image relative to BOARD, and scale to compensate for downsampling
                    const { TOP, LEFT, WIDTH, HEIGHT } = VISIBLE_SQUARE
                    IMG_EL.style.transform = `translate(${LEFT || 0}px, ${TOP || 0}px) scale(${1 / IMG_SCALE},${1 / IMG_SCALE})`
                    resolve()
                })
            }

            resolve()
        })
    }


}

