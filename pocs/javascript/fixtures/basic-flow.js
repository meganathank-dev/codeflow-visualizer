function doubleValue(value) {
  return value * 2;
}

const numbers = [2, 4, 6];
let total = 0;

for (let index = 0; index < numbers.length; index += 1) {
  const currentValue = numbers[index];
  const doubledValue = doubleValue(currentValue);

  numbers[index] = doubledValue;
  total += doubledValue;
}

if (total > 20) {
  console.log("Total is greater than 20.");
} else {
  console.log("Total is 20 or less.");
}

console.log(JSON.stringify({ numbers, total }));