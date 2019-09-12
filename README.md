# TensorflowGOL
Conway's Game of Life on the browser with WebGL support using Tensorflow core

Live at https://manueldois.github.io/TensorflowGOL/

This algorithm uses 2D Tensor of all cell spaces (fixed world size) and a convolution to count the number of neighbors.

On non-chaotic patterns, this aproach severely underperforms other algorithms like Hashlife or Quicklife, that use memoization and quadtree data structure.
