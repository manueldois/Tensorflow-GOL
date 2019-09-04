import * as tf from '@tensorflow/tfjs-core'
import { add } from '@tensorflow/tfjs-core';

interface ITensorObject {
    [id: string]: tf.Tensor
}

function printVectors(tensors: ITensorObject) {
    for (let name in tensors) {
        const tensor = tensors[name]
        console.log(name, tensor.toString(),
            "Rank: ", tensors[name].rank,
            "Shape: ", tensors[name].shape,
            "Type: ", tensor.dtype
        )
    }
}

class Logger {
    constructor() {
        // setInterval(() => {
        //     this.printLogToConsole()
        // },500)
    }

    Log = new Map()
    CONSOLE_EL = <HTMLElement>document.getElementById('console')

    log(name, value) {
        this.Log.set(name, value)
    }

    time(name, time) {
        this.Log.set(name + ' ms', Math.round(time))
        if (time > 100) console.log(name + ' : ' + time)
    }

    printLogToConsole() {
        const LOG_EL = this.CONSOLE_EL.getElementsByClassName('log').item(0)
        if (!LOG_EL) return
        LOG_EL.innerHTML = ''
        for (let keyVal of this.Log) {
            let value = keyVal[1]
            if (!value) continue

            const labelNode = document.createElement('div')
            const keyNode = document.createElement('span')
            const valueNode = document.createElement('span')

            keyNode.innerHTML = keyVal[0].toString()
            valueNode.innerHTML = value.toString()

            labelNode.append(keyNode, valueNode)
            labelNode.className = 'entry'
            LOG_EL.append(labelNode)

        }
    }
}

class Timeline {
    TIMES = new Map()
    START_TIME = Date.now()
    PREVIOUS_TIME = Date.now()
    END_TIME: number | undefined
    RUN_DURATION: number = 0

    constructor(public NAME: string, public LOG_TO_CONSOLE_THRESHOLD?: number) {

    }

    mark(LABEL: string) {
        this.TIMES.set(LABEL, Date.now() - this.PREVIOUS_TIME)
        this.RUN_DURATION += Date.now() - this.PREVIOUS_TIME
        this.PREVIOUS_TIME = Date.now()
    }

    get(LABEL: string) {
        const TIME = this.TIMES.get(LABEL)
        return TIME || ''
    }

    end() {
        this.END_TIME = Date.now()
        this.RUN_DURATION = this.END_TIME - this.START_TIME
        this.TIMES.set('TOTAL', this.RUN_DURATION)

        if (this.LOG_TO_CONSOLE_THRESHOLD && this.RUN_DURATION > this.LOG_TO_CONSOLE_THRESHOLD) {
            console.log(this.TIMES.entries())
        }
    }
}

function hexToRGB(hex: string) {
    if(hex[0] === '#') hex = hex.slice(1)
    var bigint = parseInt(hex, 16);
    var r = (bigint >> 16) & 255;
    var g = (bigint >> 8) & 255;
    var b = bigint & 255;

    return [r,g,b];
}


const LOGGER = new Logger()
export { printVectors, LOGGER, Timeline, hexToRGB }