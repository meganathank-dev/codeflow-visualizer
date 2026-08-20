public final class BasicFlow {
    private BasicFlow() {
    }

    private static int doubleValue(int value) {
        return value * 2;
    }

    public static void main(String[] args) {
        int[] numbers = {2, 4, 6};
        int total = 0;

        for (int index = 0; index < numbers.length; index += 1) {
            int currentValue = numbers[index];
            int doubledValue = doubleValue(currentValue);

            numbers[index] = doubledValue;
            total += doubledValue;
        }

        if (total > 20) {
            System.out.println("Total is greater than 20.");
        } else {
            System.out.println("Total is 20 or less.");
        }

        System.out.println(
            "{\"numbers\":[" +
            numbers[0] + "," +
            numbers[1] + "," +
            numbers[2] +
            "],\"total\":" +
            total +
            "}"
        );
    }
}