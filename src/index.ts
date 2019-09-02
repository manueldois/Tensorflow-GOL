import './style.scss'
import * as tf from '@tensorflow/tfjs-core'
import GOLVis from './GOLVis'
import GOLCompute from './GOLCompute'
import GOLApp from './GOLApp'
import { printVectors, logger } from './util'
import { IAppState } from './interfaces'
import GOLDraw from './GOLDraw';

let WORLD: tf.Variable<tf.Rank.R2>


const VIEWPORT_EL = document.getElementById('viewport')
const BOARD_EL = document.getElementById('board')
const IMG_EL = document.getElementById('world')

if(!VIEWPORT_EL || !BOARD_EL || !IMG_EL) throw "Can't find elements for GOLVis"

const Compute = new GOLCompute()
const Vis = new GOLVis(VIEWPORT_EL, BOARD_EL, <HTMLImageElement> IMG_EL)
const Draw = new GOLDraw(Vis)
const App = new GOLApp(Compute, Vis, Draw)

App.start()
Vis.render()
App.randomizeWorld()

let LoopTimer: number
