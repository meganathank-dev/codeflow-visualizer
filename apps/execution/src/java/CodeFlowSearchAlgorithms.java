/** Deterministic educational search helpers available to CodeFlow programs. */
class SearchAlgorithms {
    static int linearSearch(int[] values, int target) {
        if (values == null) {
            throw new IllegalArgumentException("Searching requires an integer array.");
        }

        for (int index = 0; index < values.length; index++) {
            if (values[index] == target) {
                return index;
            }
        }

        return -1;
    }

    static int binarySearch(int[] values, int target) {
        if (values == null) {
            throw new IllegalArgumentException("Searching requires an integer array.");
        }

        for (int index = 1; index < values.length; index++) {
            if (values[index - 1] > values[index]) {
                throw new IllegalArgumentException(
                    "Binary search requires an array sorted in ascending order."
                );
            }
        }

        int low = 0;
        int high = values.length - 1;

        while (low <= high) {
            int middle = low + (high - low) / 2;

            if (values[middle] == target) {
                return middle;
            }

            if (values[middle] < target) {
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }

        return -1;
    }
}
