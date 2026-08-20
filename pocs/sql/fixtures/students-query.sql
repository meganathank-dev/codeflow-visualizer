CREATE TABLE students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    marks INTEGER NOT NULL,
    department TEXT NOT NULL
);

INSERT INTO students (id, name, marks, department) VALUES
    (1, 'Arjun', 75, 'CSE'),
    (2, 'Divya', 92, 'ECE'),
    (3, 'Kavin', 84, 'CSE'),
    (4, 'Meera', 68, 'IT'),
    (5, 'Nila', 88, 'CSE');

SELECT name, marks
FROM students
WHERE marks > 80
ORDER BY marks DESC;