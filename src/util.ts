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
    constructor(){
        // setInterval(() => {
        //     this.printLogToConsole()
        // },500)
    }

    Log = new Map()
    Console_El = <HTMLElement> document.getElementById('console')

    log(name, value){
        this.Log.set(name, value)
    }

    time(name, time){
        this.Log.set(name + ' ms', Math.round(time) )
        if(time > 100) console.log(name + ' : ' + time)
    }

    printLogToConsole(){
        this.Console_El.innerHTML = ''
        for(let keyVal of this.Log){
            let value = keyVal[1]

            const labelNode = document.createElement('div')
            const keyNode = document.createElement('span')
            const valueNode = document.createElement('span')
            
            keyNode.innerHTML = keyVal[0].toString()
            valueNode.innerHTML = value.toString()

            labelNode.append(keyNode, valueNode)
            this.Console_El.append(labelNode)

        }
    }
}

class Timeline {
    TIMES = new Map()
    START_TIME = Date.now()
    PREVIOUS_TIME = Date.now()
    END_TIME: number | undefined
    RUN_DURATION: number | undefined

    constructor(public NAME: string){

    }

    mark(LABEL: string){
        this.TIMES.set(LABEL, Date.now() - this.PREVIOUS_TIME)
        this.PREVIOUS_TIME = Date.now()
    }

    end(){
        this.END_TIME = Date.now()
        this.RUN_DURATION = this.END_TIME - this.START_TIME
        this.TIMES.set('TOTAL', this.RUN_DURATION)

        if(this.RUN_DURATION > 100){
            console.log(this.TIMES.entries())
        }
    }
}

const logger = new Logger() 
export { printVectors, logger, Timeline }