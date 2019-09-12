import './style.scss'
import * as tf from '@tensorflow/tfjs-core'
import GOLVis from './GOLVis'
import GOLCompute from './GOLCompute'
import GOLApp from './GOLApp'
import GOLDraw from './GOLDraw';

const VIEWPORT_EL = document.getElementById('viewport')
const BOARD_EL = document.getElementById('board')
const CANVAS_EL = document.getElementById('tf-canvas')

if (!VIEWPORT_EL || !BOARD_EL || !CANVAS_EL) throw "Can't find elements for GOLVis"

tf.enableProdMode() 

const Compute = new GOLCompute()
const Vis = new GOLVis(VIEWPORT_EL, BOARD_EL, <HTMLCanvasElement> CANVAS_EL)
const Draw = new GOLDraw(Vis)
const App = new GOLApp(Compute, Vis, Draw)

App.start()
