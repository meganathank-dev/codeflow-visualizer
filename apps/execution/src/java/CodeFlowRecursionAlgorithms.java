final class RecursionAlgorithms {
    private RecursionAlgorithms() {
    }

    static int towerOfHanoi(int diskCount) {
        if (diskCount < 1 || diskCount > 8) {
            throw new IllegalArgumentException(
                "towerOfHanoi disk count must be between 1 and 8."
            );
        }

        return solve(diskCount, 'A', 'C', 'B');
    }

    private static int solve(
        int diskCount,
        char source,
        char target,
        char auxiliary
    ) {
        if (diskCount == 1) {
            return 1;
        }

        return solve(diskCount - 1, source, auxiliary, target)
            + 1
            + solve(diskCount - 1, auxiliary, target, source);
    }
}
