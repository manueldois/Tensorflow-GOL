import { ISize, IVector, ITransform, IRect, IVisibleSquare } from './interfaces'
import * as tf from '@tensorflow/tfjs-core'
import panzoom, { PanZoom } from 'panzoom'
import { encode as PNGencoder } from 'fast-png'
import { printVectors, logger, Timeline } from './util'
import * as rxjs from 'rxjs'
import GOLCompute from './GOLCompute';
import { reject } from 'async';

/** Provides rendering, panning, and zooming for GOL.
 * @param VIEWPORT_EL HTML Element where to render GOL. Any size.
 * @param BOARD_EL 
 * HTML Element where to render the GOL World. 
 * Floats in VIEWPORT_EL with the panzoom library.
 * BOARD in DOM is the same size in px as the world in cells.
 * Its DOM size is set by this class.
 * @param IMG_EL HTML Image where to render the GOL Cells. Ignores Cells out of view.
 * 
 * @description
 * Viewport contains Board contains Img.
 * In the DOM, 1px = 1cell. Zooming is achieved by using the view layer (css tranform)
*/
export default class GOLVis {
    constructor(public VIEWPORT_EL: HTMLElement,
        public BOARD_EL: HTMLElement,
        public IMG_EL: HTMLImageElement,
    ) {
        if (!VIEWPORT_EL) throw new Error('Got no viewport element')
        if (!BOARD_EL) throw new Error('Got no board element')
        if (!IMG_EL) throw new Error('Got no image element')

        this.PANZOOM = panzoom(this.BOARD_EL)

        this.updateViewport()
        this.attachEventListeners()
    }

    /** A ref to the WORLD Variable used thought the app */ 
    WORLD: tf.Variable<tf.Rank.R2> | null = null

    WORLD_SIZE: number | null = null
    
    /** Viewport height and width from DOM, in px.
     *  Changes on window resize
     */
    VIEWPORT: ISize = {} as ISize

    /** Board position and size inside Viewport, in px.
     *  Changes on pan or zoom
     */
    BOARD: IRect = {} as IRect

    /** Observable from the onload event in the IMG_EL */
    $IMG_LOAD: rxjs.Observable<Event> | undefined = undefined

    /** Stores the rectangle bounding the Cells of the part of the world that is visible by the user.
     *  Changes when BOARD or VIEWPORT change
    */
    VISIBLE_SQUARE: IVisibleSquare = {} as IVisibleSquare

    /** Panzoom instance. Panzoom is a library that provides pan and zoom to a DOM element.
     *  Here used to pan and zoom the BOARD
     */
    PANZOOM: PanZoom

    /** Stores the same scale as Panzoom */
    SCALE = 1

    /** Binds an external WORLD variable this instance */
    useWorld(WORLD: tf.Variable<tf.Rank.R2>) {
        const WORLD_SIZE = WORLD.shape[0]
        if (WORLD_SIZE < 0) throw new Error('WORLD size must be greater than zero')
        if (WORLD_SIZE % 1 !== 0) throw new Error('WORLD size must be an integer')

        this.WORLD_SIZE = WORLD_SIZE
        this.WORLD = WORLD
        this.updateBoard()
        this.centerView()
    }

    /** Attach functions to react to window resize, image load, panzoom panend and panzoom zoom Events */
    attachEventListeners() {
        window.addEventListener('resize', () => { this.updateViewport() })

        this.$IMG_LOAD = rxjs.fromEvent(this.IMG_EL, 'load')

        this.PANZOOM.on('panend', (e: any) => {
            this.updateBoard()
        })

        this.PANZOOM.on('zoom', (e: any) => {
            const transform = e.getTransform()
            this.SCALE = transform.scale
            this.updateBoard()
        })

    }

    /** Gets the Viewport size from DOM and propagates changes downward */
    updateViewport() {
        this.VIEWPORT = {
            H: this.VIEWPORT_EL.getBoundingClientRect().height,
            W: this.VIEWPORT_EL.getBoundingClientRect().width
        }
        this.updateBoard()
    }

    /** Sets the DOM size of BOARD_EL according to WORLD.
     * Gets the BOARD rendered position and size from PANZOOM
     */
    updateBoard() {
        if (this.WORLD_SIZE !== null) {
            this.BOARD_EL.style.width = this.BOARD_EL.style.height = `${this.WORLD_SIZE}px`
            const transform = this.PANZOOM.getTransform()
            // BOARD in DOM is the same size in px as the world in cells
            this.BOARD = {
                X: <number>transform.x, // 1px = 1cell
                Y: <number>transform.y, // 1px = 1cell
                H: <number>transform.scale * this.WORLD_SIZE, // 1px = 1cell
                W: <number>transform.scale * this.WORLD_SIZE, // 1px = 1cell
            }
            this.updateVisibleSquare()
        }
    }

    /** Calculates and sets the VISIBLE_SQUARE */
    updateVisibleSquare() {
        const { BOARD, VIEWPORT, SCALE, WORLD_SIZE } = this

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

    /** Tells PANZOOM to move and zoom so as to have the BOARD centered in the VIEWPORT */
    centerView() {
        if (this.WORLD_SIZE !== null) {
            const NEW_SCALE = this.VIEWPORT.W / this.WORLD_SIZE * 0.7;
            this.PANZOOM.zoomAbs(0, 0, NEW_SCALE);
            this.PANZOOM.moveTo((this.VIEWPORT.W - this.WORLD_SIZE * NEW_SCALE) / 2, (this.VIEWPORT.H - this.WORLD_SIZE * NEW_SCALE) / 2);
            this.SCALE = NEW_SCALE;
        }
    }

    /** Takes the WORLD Variable assigned in useWorld and renders it as a PNG in IMG_EL. 
     * @description
     * Slices and downsamples the WORLD to the current VIEWPORT, then
     * colors it, converts it to a base64 string, and assigns it to IMG_EL.src.
     * Returns a promise that resolves when the browser has finished rendering 
     * the image.
    */
    render(): Promise<void> {
        const { WORLD, $IMG_LOAD, VISIBLE_SQUARE, IMG_EL } = this

        return new Promise((resolve, reject) => {
            try {
                if (!WORLD) {
                    throw new Error('No world to render')
                }
                if (VISIBLE_SQUARE.WIDTH <= 0 || VISIBLE_SQUARE.HEIGHT <= 0) {
                    // Nothing is visible
                    resolve()
                    return
                }

                let timeline = new Timeline('Render', 1000)

                let NEW_WIDTH, NEW_HEIGHT, IMG_SCALE, IMG_DATA
                // This is sync. Updates the vars above
                tf.tidy('Render', () => {
                    const WORLD_3D = <tf.Tensor<tf.Rank.R3>>WORLD.expandDims(2) // Shape [WORLS_SIZE, WORLD_SIZE, 1] 

                    const WORLD_RGB = colorWorld(WORLD_3D)
                    timeline.mark('color');

                    const CROP_RESULT = cropAndResizeWorld(WORLD_RGB, VISIBLE_SQUARE)
                    CROP_RESULT.WORLD_RGB_CROPPED_RESIZED.arraySync()
                    timeline.mark('cutAndResize');

                    NEW_HEIGHT = CROP_RESULT.WORLD_RGB_CROPPED_RESIZED.shape[0]
                    NEW_WIDTH = CROP_RESULT.WORLD_RGB_CROPPED_RESIZED.shape[1]
                    IMG_SCALE = CROP_RESULT.IMG_SCALE

                    IMG_DATA = tensorToUInt8Array(CROP_RESULT.WORLD_RGB_CROPPED_RESIZED)
                    timeline.mark('tensorToDataArray');
                })

                drawImage(IMG_EL, IMG_DATA, NEW_WIDTH, NEW_HEIGHT, $IMG_LOAD)
                    .then(() => {
                        timeline.mark('drawImage');
                        offsetImage(IMG_EL, VISIBLE_SQUARE, IMG_SCALE)
                        timeline.mark('offsetImage');
                        timeline.end()
                        resolve()
                    })


                /** Crops and downsamples a 3D RGB World to its visible size.
                 *  @param WORLD_RGB Tensor Shape [H, W, 3]
                 *  @param VISIBLE_SQUARE The square to cut by
                 *  @returns WORLD_RGB_CROPPED_RESIZED: Tensor Shape [H, W, 3]
                 *  @returns IMG_SCALE: number The ratio between the old and the resized World size 
                */
                function cropAndResizeWorld(WORLD_RGB: tf.Tensor<tf.Rank.R3>, VISIBLE_SQUARE: IVisibleSquare) {
                    const WORLD_HEIGHT = WORLD_RGB.shape[0] // H
                    const WORLD_WIDTH = WORLD_RGB.shape[1] // W

                    const { TOP, LEFT, BOTTOM, RIGHT, WIDTH, HEIGHT } = VISIBLE_SQUARE

                    const IMG_SCALE = 1 / Math.ceil(Math.sqrt((WIDTH * HEIGHT) / (500 * 500))) // 1, 1/2, 1/4...

                    const NEW_WIDTH = Math.ceil(WIDTH * IMG_SCALE),
                        NEW_HEIGHT = Math.ceil(HEIGHT * IMG_SCALE)

                    const WORLD_4D = <tf.Tensor<tf.Rank.R4>>
                        WORLD_RGB
                            .toFloat()
                            .reshape([1, WORLD_RGB.shape[0], WORLD_RGB.shape[1], 3]) // Shape [1,H, W, 3]

                    const BOXES = tf.tensor2d(
                        [
                            [TOP / WORLD_HEIGHT, LEFT / WORLD_WIDTH, BOTTOM / WORLD_HEIGHT, RIGHT / WORLD_WIDTH]
                        ]
                    )
                    const WORLD_RGB_CROPPED_RESIZED = <tf.Tensor<tf.Rank.R3>>
                        tf.image.cropAndResize(WORLD_4D, BOXES, [0], [NEW_HEIGHT, NEW_WIDTH], 'nearest')
                            .squeeze([0])

                    return { WORLD_RGB_CROPPED_RESIZED, IMG_SCALE }
                }

                /**
                 * Takes a 3D Age World and colors it
                 * @param WORLD_3D The World to render, optionaly with cell ages Shape [H, W, 1]
                 * @returns The colored 3D RGB World Shape [H, W, 3]
                 */
                function colorWorld(WORLD_3D: tf.Tensor<tf.Rank.R3>) {
                    const WORLD_3D_BOOL = WORLD_3D.toBool()

                    const COLOR_A = tf.tensor1d([1, 0, 1]) // Shape [3]
                    const COLOR_B = tf.tensor1d([1, 1, 1])

                    const COLOR_A_RATIO = smoothNormalize(WORLD_3D.sub(1), 3).mul(WORLD_3D_BOOL) //  Shape [H, W, 1] 
                    const COLOR_B_RATIO = invertRatio(COLOR_A_RATIO).mul(WORLD_3D_BOOL)

                    const WORLD_RGB = <tf.Tensor<tf.Rank.R3>>tf.addN([
                        COLOR_A.mul(COLOR_A_RATIO), //  Shape [H, W, 3] 
                        COLOR_B.mul(COLOR_B_RATIO)
                    ]).mul(255)

                    return WORLD_RGB //  Shape [H, W, 3]


                    /** Scalar smoothing function
                     * @param X The Tensor to normalize any shape values [0 to +inf]
                     * @param A Smoothing factor [0 to +inf].
                     * @returns Tensor with values [0 to 1]
                     * @description
                     * f(X) = (1 + A)/(X + 1 + A).
                     * Bigger A -> Slower fall to zero.
                    */
                    function smoothNormalize(X: tf.Tensor<tf.Rank>, A: number = 0) {
                        // f(X) = (1 + A)/(X + 1 + A)
                        // f(X) = 1/(X + 1 + A) * (1 + A)
                        return X
                            .clipByValue(0, Infinity) // Assert X >= 0 
                            .add(1 + A)
                            .reciprocal()
                            .mul(1 + A)
                    }

                    /** For a Tensor X representing a ratio [0, 1], calculate 1 - X */
                    function invertRatio(X: tf.Tensor<tf.Rank>) {
                        return X.neg().add(1)
                    }

                }

                /** Convert a Tensor to a Uint8Array. Sync  */
                function tensorToUInt8Array(TENSOR: tf.Tensor<tf.Rank>) {
                    return new Uint8Array(TENSOR.bufferSync().values)
                }

                /**
                 * Draws a PNG image in IMG_EL with the pixels from DATA_ARRAY.
                 * The image is passed as a base64 encoded string in IMG_EL.src
                 * @param IMG_EL The DOM Element where to render
                 * @param DATA_ARRAY A Uint8Array with a sequence of RGB values
                 * @param WIDTH The width of the image
                 * @param HEIGHT The height of the image 
                 * @param $IMG_LOAD An observable that emits whenever the IMG_EL loads
                 * @returns Promise. Waits for IMG_LOAD_EVENT if it exists, otherwise resolves immidiatly
                 */
                function drawImage(IMG_EL: HTMLImageElement, DATA_ARRAY: Uint8Array, WIDTH: number, HEIGHT: number, $IMG_LOAD?: rxjs.Observable<Event>) {
                    return new Promise((resolve, reject) => {
                        // Function encode from fast-png 
                        const encoded = PNGencoder({
                            width: WIDTH,
                            height: HEIGHT,
                            data: DATA_ARRAY,
                            channels: 3
                        })

                        function arrayBufferToBase64(buffer) {
                            let binary = '';
                            let bytes = new Uint8Array(buffer);
                            let len = bytes.byteLength;
                            for (let i = 0; i < len; i++) {
                                binary += String.fromCharCode(bytes[i]);
                            }
                            return window.btoa(binary);
                        }

                        const b64 = arrayBufferToBase64(encoded.buffer)
                        IMG_EL.src = `data:image/png;base64,${b64}`

                        // If we are watching the image onload event wait for it
                        if ($IMG_LOAD) {
                            $IMG_LOAD.subscribe(() => resolve())
                        } else {
                            resolve()
                        }

                    })
                }

                /**
                 * Offset an image in the DOM so it stays fixed after it has been cut and resized
                 * @param IMG_EL The DOM Element where to render
                 * @param VISIBLE_SQUARE The square by which the image was cut
                 * @param IMG_SCALE The scale by which the image downsampled 
                 */
                function offsetImage(IMG_EL: HTMLImageElement, VISIBLE_SQUARE: IVisibleSquare, IMG_SCALE: number) {
                    // If we are cutting the world from LEFT or TOP, the image in the DOM will be smaller and shift up or left
                    // To adjust, translate the image relative to BOARD, and scale to compensate for downsampling
                    const { TOP, LEFT, WIDTH, HEIGHT } = VISIBLE_SQUARE
                    IMG_EL.style.transform = `translate(${LEFT || 0}px, ${TOP || 0}px) scale(${1 / IMG_SCALE},${1 / IMG_SCALE})`
                }

            } catch (error) {
                console.error('Failed to render.', error)
                reject(error)
            }
        })

    }


}

