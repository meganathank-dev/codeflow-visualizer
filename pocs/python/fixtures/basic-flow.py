import json


def double_value(value):
    return value * 2


numbers = [2, 4, 6]
total = 0

for index in range(len(numbers)):
    current_value = numbers[index]
    doubled_value = double_value(current_value)

    numbers[index] = doubled_value
    total += doubled_value

if total > 20:
    print("Total is greater than 20.")
else:
    print("Total is 20 or less.")

print(
    json.dumps(
        {
            "numbers": numbers,
            "total": total,
        },
        separators=(",", ":"),
    )
)