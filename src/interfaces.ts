import * as tf from '@tensorflow/tfjs-core'



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



export {ISize, IRect, IVector, ITransform, IViewport, IVisibleSquare}