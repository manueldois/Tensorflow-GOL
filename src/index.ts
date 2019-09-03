import './style.scss'
import * as tf from '@tensorflow/tfjs-core'
import GOLVis from './GOLVis'
import GOLCompute from './GOLCompute'
import GOLApp from './GOLApp'
import { printVectors, logger } from './util'
import { IAppState } from './interfaces'
import GOLDraw from './GOLDraw';

const VIEWPORT_EL = document.getElementById('viewport')
const BOARD_EL = document.getElementById('board')
const IMG_EL = document.getElementById('world')

if (!VIEWPORT_EL || !BOARD_EL || !IMG_EL) throw "Can't find elements for GOLVis"

const Compute = new GOLCompute()
const Vis = new GOLVis(VIEWPORT_EL, BOARD_EL, <HTMLImageElement> IMG_EL, Compute)
const Draw = new GOLDraw(Vis)
const App = new GOLApp(Compute, Vis, Draw)

App.start()
App.randomizeWorld()

// let WORLD = tf.variable(
//     tf.tensor2d([
//         [1, 1, 0],
//         [0, 1, 2],
//         [0, 0, 0]
//     ], undefined, 'int32'
//     ))

// printVectors({ WORLD })
// Compute.useWorld(WORLD)
// console.log('----- NEXT -----')
// Compute.nextState()
// printVectors({ WORLD })
// console.log('----- NEXT -----')
// Compute.nextState()
// printVectors({ WORLD })
// console.log('----- NEXT -----')
// Compute.nextState()
// printVectors({ WORLD })

