import * as tf from '@tensorflow/tfjs-core'

// State

interface IAppState {
    WORLD_SIZE: number,
    FRAMES_PER_SECOND: number,
    STEPS_PER_FRAME: number,
    RUNNING: boolean
    PAUSED: boolean,
    BACKEND: string
}

// Geometry
interface ISize {
    W: number,
    H: number
}

interface IVector {
    X: number,
    Y: number
}

interface IRect extends ISize, IVector {}
interface IViewport extends IRect {
    CELL_SIZE: number
}

interface ITransform extends IVector {
    SCALE: number    
}

interface IVisibleSquare {
    TOP: number,
    BOTTOM: number,
    LEFT: number,
    RIGHT: number,
    WIDTH: number,
    HEIGHT: number,
    PADDING: number
}



export {IAppState, ISize, IRect, IVector, ITransform, IViewport, IVisibleSquare}