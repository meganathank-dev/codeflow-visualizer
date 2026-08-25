class SortingAlgorithms {
    static int[] bubbleSort(int[] values) {
        for (int boundary = values.length - 1; boundary > 0; boundary--) {
            boolean changed = false;

            for (int index = 0; index < boundary; index++) {
                if (values[index] > values[index + 1]) {
                    int previous = values[index];
                    values[index] = values[index + 1];
                    values[index + 1] = previous;
                    changed = true;
                }
            }

            if (!changed) {
                break;
            }
        }

        return values;
    }

    static int[] selectionSort(int[] values) {
        for (int start = 0; start < values.length - 1; start++) {
            int minimum = start;

            for (int index = start + 1; index < values.length; index++) {
                if (values[index] < values[minimum]) {
                    minimum = index;
                }
            }

            if (minimum != start) {
                int previous = values[start];
                values[start] = values[minimum];
                values[minimum] = previous;
            }
        }

        return values;
    }

    static int[] insertionSort(int[] values) {
        for (int index = 1; index < values.length; index++) {
            int key = values[index];
            int cursor = index - 1;

            while (cursor >= 0 && values[cursor] > key) {
                values[cursor + 1] = values[cursor];
                cursor--;
            }

            values[cursor + 1] = key;
        }

        return values;
    }
}
