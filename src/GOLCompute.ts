import * as tf from '@tensorflow/tfjs-core'

/** Computes and mutates a GOL world using tensorflow
 * this.WORLD is a reference to the world used throught the app
 */
export default class GOLCompute {
    WORLD: tf.Variable<tf.Rank.R2> | null = null
    
    useWorld(WORLD: tf.Variable<tf.Rank.R2>) {
        this.WORLD = WORLD
    }

    /** Take the WORLD TF variable stored in the instance, compute the next GOL state, and assign
     * the result back to the WORLD TF variable
     */
    nextState() {
        if (!this.WORLD) throw new Error('Got no WORLD')
        const WORLD = this.WORLD
        const WORLD_SIZE = WORLD.shape[1]
        if (!WORLD_SIZE) throw new Error('Invalid WORLD_SIZE')

        tf.tidy(() => {

            // To count the number of neighbors around a cell,
            // I am using a convolution with tensorflow
            // This operation is usualy used in ConvNets for
            // image recognition, but does the same math as what is
            // needed here in Game of Life

            // Tensorflow wants the input as 3D tensors of shape [batch, width, height, channel]
            // We'v only one image to compute so batch is 1, and one channel (cell on or off)
            const SHAPE3D: any = [WORLD_SIZE, WORLD_SIZE, 1]
            const WORLD3D = <tf.Tensor<tf.Rank.R3>>WORLD.reshape(SHAPE3D)
            const FILTER = <tf.Tensor<tf.Rank.R4>>tf.tensor(
                [
                    [[[1]], [[1]], [[1]]],
                    [[[1]], [[0]], [[1]]],
                    [[[1]], [[1]], [[1]]]
                ]
            )

            // Do the convolution and squeeze the 3D result back to a 2D tensor
            const N_NEIGHBORS = <tf.Tensor<tf.Rank.R2>>tf.conv2d(WORLD3D.toInt(), FILTER, [1, 1], 'same').squeeze()

            /*
            The Rules
            For a space that is 'populated':
            A    Each cell with one or no neighbors dies, as if by solitude.
            B    Each cell with four or more neighbors dies, as if by overpopulation.
            C    Each cell with two or three neighbors survives.
            For a space that is 'empty' or 'unpopulated'
            D    Each cell with three neighbors becomes populated.
            */

            // Next world is initialized with zeros => all dead cells
            // The only rules that matter is where a cell is born (D) or stays alive (C)   
            // For the result do (D or C)

            // C  Is 'populated' && two or three neighbors
            const RULE_C = WORLD
                .logicalAnd(
                    N_NEIGHBORS.equal(2)
                        .logicalOr(
                            N_NEIGHBORS.equal(3)
                        )
                )

            // D  Is 'empty' && three neighbors
            const RULE_D = WORLD
                .logicalNot()
                .logicalAnd(
                    N_NEIGHBORS.equal(3)
                )

            const NEXT_WORLD = <tf.Tensor<tf.Rank.R2>>tf.logicalOr(RULE_C, RULE_D)

            WORLD.assign(NEXT_WORLD)
        })

        return
    }
}


