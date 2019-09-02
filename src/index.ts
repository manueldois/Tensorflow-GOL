import './style.scss'
import * as tf from '@tensorflow/tfjs-core'
import GOLVis from './GOLVis'
import GOLCompute from './GOLCompute'
import GOLApp from './GOLApp'
import { printVectors, logger } from './util'
import { IAppState } from './interfaces'
import GOLDraw from './GOLDraw';

let WORLD: tf.Variable<tf.Rank.R2>

const Compute = new GOLCompute()
const Vis = new GOLVis()
const Draw = new GOLDraw(Vis)
const App = new GOLApp(Compute, Vis, Draw)

App.start()
App.randomizeWorld()

let LoopTimer: number
