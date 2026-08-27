final class DynamicProgramming {
    private DynamicProgramming() {
    }

    static int fibonacciMemo(int n) {
        validateIndex(n, "fibonacciMemo input");
        Integer[] memo = new Integer[n + 1];
        return fibonacciMemo(n, memo);
    }

    private static int fibonacciMemo(int n, Integer[] memo) {
        if (memo[n] != null) {
            return memo[n];
        }

        int value = n <= 1
            ? n
            : fibonacciMemo(n - 1, memo) + fibonacciMemo(n - 2, memo);
        memo[n] = value;
        return value;
    }

    static int fibonacciTabulation(int n) {
        validateIndex(n, "fibonacciTabulation input");
        int[] table = new int[n + 1];

        if (n >= 1) {
            table[1] = 1;
        }

        for (int index = 2; index <= n; index += 1) {
            table[index] = table[index - 1] + table[index - 2];
        }

        return table[n];
    }

    static int knapsack01(int[] weights, int[] values, int capacity) {
        if (weights == null || values == null || weights.length == 0
            || weights.length != values.length) {
            throw new IllegalArgumentException(
                "knapsack01 requires equal non-empty weight and value arrays."
            );
        }

        validateIndex(capacity, "knapsack01 capacity");
        int[][] table = new int[weights.length + 1][capacity + 1];

        for (int item = 1; item <= weights.length; item += 1) {
            if (weights[item - 1] <= 0) {
                throw new IllegalArgumentException("knapsack01 weights must be positive.");
            }

            for (int currentCapacity = 1;
                 currentCapacity <= capacity;
                 currentCapacity += 1) {
                int exclude = table[item - 1][currentCapacity];
                int include = weights[item - 1] <= currentCapacity
                    ? values[item - 1]
                        + table[item - 1][currentCapacity - weights[item - 1]]
                    : Integer.MIN_VALUE;
                table[item][currentCapacity] = Math.max(exclude, include);
            }
        }

        return table[weights.length][capacity];
    }

    private static void validateIndex(int value, String name) {
        if (value < 0 || value > 40) {
            throw new IllegalArgumentException(
                name + " must be an integer between 0 and 40."
            );
        }
    }
}
