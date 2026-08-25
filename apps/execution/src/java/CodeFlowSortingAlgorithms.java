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

    static int[] mergeSort(int[] values) {
        mergeRange(values, 0, values.length - 1);
        return values;
    }

    private static void mergeRange(int[] values, int start, int end) {
        if (start >= end) {
            return;
        }

        int middle = (start + end) / 2;
        mergeRange(values, start, middle);
        mergeRange(values, middle + 1, end);

        int[] merged = new int[end - start + 1];
        int left = start;
        int right = middle + 1;
        int cursor = 0;

        while (left <= middle && right <= end) {
            if (values[left] <= values[right]) {
                merged[cursor++] = values[left++];
            } else {
                merged[cursor++] = values[right++];
            }
        }

        while (left <= middle) {
            merged[cursor++] = values[left++];
        }

        while (right <= end) {
            merged[cursor++] = values[right++];
        }

        System.arraycopy(merged, 0, values, start, merged.length);
    }

    static int[] quickSort(int[] values) {
        quickRange(values, 0, values.length - 1);
        return values;
    }

    private static void quickRange(int[] values, int start, int end) {
        if (start >= end) {
            return;
        }

        int pivot = values[end];
        int boundary = start;

        for (int index = start; index < end; index++) {
            if (values[index] < pivot) {
                swap(values, index, boundary);
                boundary++;
            }
        }

        swap(values, boundary, end);
        quickRange(values, start, boundary - 1);
        quickRange(values, boundary + 1, end);
    }

    private static void swap(int[] values, int left, int right) {
        int previous = values[left];
        values[left] = values[right];
        values[right] = previous;
    }
}
