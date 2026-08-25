"""Local-trusted Python execution worker for CodeFlow Visualizer.

This process is isolated from Express, but it is not a production security
sandbox. Do not expose it to untrusted public code execution.
"""

import ast
import json
import math
import sys
import traceback
import types


SOURCE_FILENAME = "codeflow-user-program.py"
MAXIMUM_INPUT_BYTES = 64 * 1024

FORBIDDEN_NAMES = {
    "__import__",
    "breakpoint",
    "compile",
    "delattr",
    "eval",
    "exec",
    "exit",
    "getattr",
    "globals",
    "help",
    "input",
    "locals",
    "open",
    "quit",
    "setattr",
    "vars",
}

FORBIDDEN_NODE_TYPES = (
    ast.Import,
    ast.ImportFrom,
    ast.Global,
    ast.Nonlocal,
    ast.With,
    ast.AsyncWith,
    ast.AsyncFor,
    ast.AsyncFunctionDef,
    ast.Await,
    ast.Yield,
    ast.YieldFrom,
    ast.Lambda,
    ast.ClassDef,
)


class SourcePolicyError(Exception):
    def __init__(self, message, line=None):
        super().__init__(message)
        self.line = line


class TraceLimitError(Exception):
    pass


class OutputLimitError(Exception):
    pass


class CodeFlowSearchAlgorithms:
    def __init__(self):
        self.search_number = 0
        self.last_steps = []

    def run(self, algorithm, values, target):
        if not isinstance(values, list):
            raise TypeError("SearchAlgorithms requires a list as its first argument.")

        if algorithm == "binary" and any(
            values[index - 1] > values[index]
            for index in range(1, len(values))
        ):
            raise ValueError("Binary search requires a list sorted in ascending order.")

        self.search_number += 1
        search_id = f"search:{self.search_number}"
        compared_indices = []
        low = 0
        high = len(values) - 1
        middle = (low + high) // 2 if algorithm == "binary" and high >= 0 else None
        self.last_steps = []

        def append_step(event_type, **extra):
            self.last_steps.append((event_type, {
                "searchId": search_id,
                "algorithm": algorithm,
                "values": json_safe(values),
                "target": json_safe(target),
                "low": low,
                "high": high,
                "middle": middle,
                "comparedIndices": list(compared_indices),
                "eliminatedIndices": [
                    index for index in range(len(values))
                    if index < low or index > high
                ],
                "comparisonCount": len(compared_indices),
                **extra,
            }))

        append_step("SEARCH_START")

        while low <= high:
            index = (low + high) // 2 if algorithm == "binary" else low
            middle = index if algorithm == "binary" else None
            compared_indices.append(index)
            matches = values[index] == target

            append_step(
                "SEARCH_COMPARE",
                index=index,
                value=json_safe(values[index]),
                match=matches,
            )

            if matches:
                append_step("SEARCH_FOUND", index=index, foundIndex=index, found=True)
                append_step("SEARCH_END", index=index, foundIndex=index, found=True)
                return index

            previous_low = low
            previous_high = high
            direction = "left" if algorithm == "binary" and values[index] > target else "right"

            if direction == "left":
                high = index - 1
            else:
                low = index + 1

            middle = (
                (low + high) // 2
                if algorithm == "binary" and low <= high
                else None
            )

            append_step(
                "SEARCH_RANGE_UPDATE",
                previousLow=previous_low,
                previousHigh=previous_high,
                direction=direction,
            )

        append_step("SEARCH_NOT_FOUND", foundIndex=-1, found=False)
        append_step("SEARCH_END", foundIndex=-1, found=False)
        return -1

    def linear_search(self, values, target):
        return self.run("linear", values, target)

    def binary_search(self, values, target):
        return self.run("binary", values, target)


class CodeFlowSortingAlgorithms:
    def __init__(self):
        self.sort_number = 0
        self.last_steps = []

    def run(self, algorithm, values):
        if not isinstance(values, list) or any(
            isinstance(value, bool) or not isinstance(value, (int, float))
            for value in values
        ):
            raise TypeError("SortingAlgorithms requires a list containing numbers.")

        self.sort_number += 1
        sort_id = f"sort:{self.sort_number}"
        initial_values = list(values)
        sorted_indices = set()
        comparison_count = 0
        swap_count = 0
        write_count = 0
        current_pass = 0
        self.last_steps = []

        def append_step(event_type, **extra):
            self.last_steps.append((event_type, {
                "sortId": sort_id,
                "algorithm": algorithm,
                "values": json_safe(values),
                "initialValues": json_safe(initial_values),
                "comparisonCount": comparison_count,
                "swapCount": swap_count,
                "writeCount": write_count,
                "pass": current_pass,
                "sortedIndices": sorted(sorted_indices),
                "compareIndices": [],
                "swapIndices": [],
                "activeIndex": None,
                "minIndex": None,
                "keyIndex": None,
                "rangeStart": 0,
                "rangeEnd": len(values) - 1,
                "middle": None,
                "depth": 0,
                "pivotIndex": None,
                "pivotValue": None,
                "leftRange": None,
                "rightRange": None,
                "partitionIndex": None,
                "phase": "start",
                **extra,
            }))

        append_step("SORT_START")

        if algorithm == "bubble":
            for boundary in range(len(values) - 1, 0, -1):
                current_pass += 1
                changed = False

                for index in range(boundary):
                    comparison_count += 1
                    append_step(
                        "SORT_COMPARE",
                        compareIndices=[index, index + 1],
                        activeIndex=index + 1,
                        leftValue=values[index],
                        rightValue=values[index + 1],
                    )

                    if values[index] > values[index + 1]:
                        values[index], values[index + 1] = values[index + 1], values[index]
                        swap_count += 1
                        changed = True
                        append_step(
                            "SORT_SWAP",
                            compareIndices=[index, index + 1],
                            swapIndices=[index, index + 1],
                            activeIndex=index + 1,
                        )

                sorted_indices.add(boundary)
                append_step("SORT_MARK_SORTED", activeIndex=boundary)
                append_step("SORT_PASS", boundary=boundary, changed=changed)

                if not changed:
                    break

        elif algorithm == "selection":
            for start in range(len(values) - 1):
                current_pass += 1
                minimum = start

                for index in range(start + 1, len(values)):
                    comparison_count += 1
                    append_step(
                        "SORT_COMPARE",
                        compareIndices=[minimum, index],
                        activeIndex=index,
                        minIndex=minimum,
                        leftValue=values[minimum],
                        rightValue=values[index],
                    )

                    if values[index] < values[minimum]:
                        minimum = index
                        append_step(
                            "SORT_COMPARE",
                            compareIndices=[start, index],
                            activeIndex=index,
                            minIndex=minimum,
                            candidateChanged=True,
                        )

                if minimum != start:
                    values[start], values[minimum] = values[minimum], values[start]
                    swap_count += 1
                    append_step(
                        "SORT_SWAP",
                        compareIndices=[start, minimum],
                        swapIndices=[start, minimum],
                        activeIndex=minimum,
                        minIndex=minimum,
                    )

                sorted_indices.add(start)
                append_step("SORT_MARK_SORTED", activeIndex=start)
                append_step("SORT_PASS", boundary=start, minIndex=minimum)

        elif algorithm == "insertion":
            if values:
                sorted_indices.add(0)

            for index in range(1, len(values)):
                current_pass += 1
                key = values[index]
                cursor = index - 1

                while cursor >= 0:
                    comparison_count += 1
                    append_step(
                        "SORT_COMPARE",
                        compareIndices=[cursor, cursor + 1],
                        activeIndex=cursor,
                        keyIndex=cursor + 1,
                        key=key,
                        leftValue=values[cursor],
                        rightValue=key,
                    )

                    if values[cursor] <= key:
                        break

                    values[cursor + 1] = values[cursor]
                    write_count += 1
                    append_step(
                        "SORT_WRITE",
                        compareIndices=[cursor, cursor + 1],
                        activeIndex=cursor + 1,
                        keyIndex=cursor + 1,
                        writeIndex=cursor + 1,
                        value=values[cursor],
                        key=key,
                        action="shift",
                    )
                    cursor -= 1

                values[cursor + 1] = key
                write_count += 1
                append_step(
                    "SORT_WRITE",
                    activeIndex=cursor + 1,
                    keyIndex=cursor + 1,
                    writeIndex=cursor + 1,
                    value=key,
                    key=key,
                    action="insert",
                )
                sorted_indices.update(range(index + 1))
                append_step("SORT_MARK_SORTED", activeIndex=index, keyIndex=cursor + 1)
                append_step("SORT_PASS", boundary=index)

        elif algorithm == "merge":
            def merge_range(start, end, depth):
                nonlocal comparison_count, write_count, current_pass

                if start >= end:
                    return

                middle = (start + end) // 2
                split_context = {
                    "rangeStart": start,
                    "rangeEnd": end,
                    "middle": middle,
                    "depth": depth,
                    "leftRange": [start, middle],
                    "rightRange": [middle + 1, end],
                    "phase": "split",
                }
                append_step("SORT_SPLIT", **split_context)
                merge_range(start, middle, depth + 1)
                merge_range(middle + 1, end, depth + 1)

                left = values[start:middle + 1]
                right = values[middle + 1:end + 1]
                left_index = 0
                right_index = 0
                cursor = start
                merge_context = {**split_context, "phase": "merge"}

                while left_index < len(left) and right_index < len(right):
                    comparison_count += 1
                    append_step(
                        "SORT_COMPARE",
                        **merge_context,
                        compareIndices=[start + left_index, middle + 1 + right_index],
                        activeIndex=cursor,
                        leftValue=left[left_index],
                        rightValue=right[right_index],
                    )

                    if left[left_index] <= right[right_index]:
                        next_value = left[left_index]
                        left_index += 1
                    else:
                        next_value = right[right_index]
                        right_index += 1

                    values[cursor] = next_value
                    write_count += 1
                    append_step(
                        "SORT_WRITE",
                        **merge_context,
                        activeIndex=cursor,
                        writeIndex=cursor,
                        value=next_value,
                        action="merge",
                    )
                    cursor += 1

                while left_index < len(left):
                    values[cursor] = left[left_index]
                    write_count += 1
                    append_step(
                        "SORT_WRITE",
                        **merge_context,
                        activeIndex=cursor,
                        writeIndex=cursor,
                        value=left[left_index],
                        action="merge",
                    )
                    left_index += 1
                    cursor += 1

                while right_index < len(right):
                    values[cursor] = right[right_index]
                    write_count += 1
                    append_step(
                        "SORT_WRITE",
                        **merge_context,
                        activeIndex=cursor,
                        writeIndex=cursor,
                        value=right[right_index],
                        action="merge",
                    )
                    right_index += 1
                    cursor += 1

                current_pass += 1
                append_step("SORT_MERGE", **merge_context, activeIndex=end)
                append_step("SORT_PASS", **merge_context, boundary=end)

            merge_range(0, len(values) - 1, 0)

        elif algorithm == "quick":
            def quick_range(start, end, depth):
                nonlocal comparison_count, swap_count, current_pass

                if start > end:
                    return

                if start == end:
                    sorted_indices.add(start)
                    append_step(
                        "SORT_MARK_SORTED",
                        rangeStart=start,
                        rangeEnd=end,
                        depth=depth,
                        activeIndex=start,
                        phase="base",
                    )
                    return

                pivot_value = values[end]
                context = {
                    "rangeStart": start,
                    "rangeEnd": end,
                    "depth": depth,
                    "pivotIndex": end,
                    "pivotValue": pivot_value,
                    "phase": "partition",
                }
                append_step("SORT_PIVOT", **context, activeIndex=end)

                boundary = start
                for index in range(start, end):
                    comparison_count += 1
                    append_step(
                        "SORT_COMPARE",
                        **context,
                        compareIndices=[index, end],
                        activeIndex=index,
                        leftValue=values[index],
                        rightValue=pivot_value,
                    )

                    if values[index] < pivot_value:
                        if index != boundary:
                            values[index], values[boundary] = values[boundary], values[index]
                            swap_count += 1
                            append_step(
                                "SORT_SWAP",
                                **context,
                                compareIndices=[index, boundary],
                                swapIndices=[index, boundary],
                                activeIndex=boundary,
                            )
                        boundary += 1

                if boundary != end:
                    values[boundary], values[end] = values[end], values[boundary]
                    swap_count += 1
                    append_step(
                        "SORT_SWAP",
                        **{**context, "pivotIndex": boundary},
                        compareIndices=[boundary, end],
                        swapIndices=[boundary, end],
                        activeIndex=boundary,
                    )

                sorted_indices.add(boundary)
                partition_context = {
                    **context,
                    "pivotIndex": boundary,
                    "partitionIndex": boundary,
                    "phase": "partitioned",
                    "leftRange": [start, boundary - 1] if boundary > start else None,
                    "rightRange": [boundary + 1, end] if boundary < end else None,
                }
                append_step("SORT_PARTITION", **partition_context)
                append_step("SORT_MARK_SORTED", **partition_context, activeIndex=boundary)
                current_pass += 1
                append_step("SORT_PASS", **partition_context, boundary=boundary)

                quick_range(start, boundary - 1, depth + 1)
                quick_range(boundary + 1, end, depth + 1)

            quick_range(0, len(values) - 1, 0)

        sorted_indices.update(range(len(values)))
        append_step("SORT_END", finished=True)
        return values

    def bubble_sort(self, values):
        return self.run("bubble", values)

    def selection_sort(self, values):
        return self.run("selection", values)

    def insertion_sort(self, values):
        return self.run("insertion", values)

    def merge_sort(self, values):
        return self.run("merge", values)

    def quick_sort(self, values):
        return self.run("quick", values)


class LinkedListNode:
    def __init__(self, identifier, value):
        self.id = identifier
        self.value = value
        self.next = None


class CodeFlowLinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
        self.length = 0
        self.next_node_number = 0

    def append(self, value):
        return self.insert(self.length, value)

    def prepend(self, value):
        return self.insert(0, value)

    def insert(self, index, value):
        if not isinstance(index, int) or index < 0 or index > self.length:
            raise IndexError("Linked-list insertion index is out of bounds.")

        self.next_node_number += 1
        node = LinkedListNode(f"node:{self.next_node_number}", value)

        if index == 0:
            node.next = self.head
            self.head = node
        else:
            previous = self.head

            for _ in range(index - 1):
                previous = previous.next

            node.next = previous.next
            previous.next = node

        if node.next is None:
            self.tail = node

        self.length += 1
        return value

    def remove_at(self, index):
        if not isinstance(index, int) or index < 0 or index >= self.length:
            raise IndexError("Linked-list removal index is out of bounds.")

        if index == 0:
            removed = self.head
            self.head = removed.next
        else:
            previous = self.head

            for _ in range(index - 1):
                previous = previous.next

            removed = previous.next
            previous.next = removed.next

        self.length -= 1

        if self.length == 0:
            self.tail = None
        elif removed is self.tail:
            current = self.head

            while current.next is not None:
                current = current.next

            self.tail = current

        return removed.value

    def get(self, index):
        if not isinstance(index, int) or index < 0 or index >= self.length:
            raise IndexError("Linked-list access index is out of bounds.")

        current = self.head

        for _ in range(index):
            current = current.next

        return current.value

    def to_list(self):
        values = []
        current = self.head

        while current is not None:
            values.append(current.value)
            current = current.next

        return values

    def snapshot(self):
        nodes = []
        current = self.head

        while current is not None:
            nodes.append({
                "id": current.id,
                "value": json_safe(current.value),
                "nextId": current.next.id if current.next is not None else None,
            })
            current = current.next

        return nodes


class CodeFlowGraph:
    def __init__(self):
        self.directed = False
        self.nodes = []
        self.edges = []
        self.adjacency = {}
        self.last_added_node_id = None
        self.last_added_edge_id = None
        self.last_traversal_steps = []
        self.last_traversal_ids = []

    def key(self, value):
        if not isinstance(value, (str, int, float)) or isinstance(value, bool):
            raise TypeError("Graph nodes must be strings or finite numbers.")

        if isinstance(value, float) and not math.isfinite(value):
            raise TypeError("Graph node numbers must be finite.")

        return f"{type(value).__name__}:{value}"

    def add_node(self, value):
        key = self.key(value)
        existing = next((node for node in self.nodes if node["key"] == key), None)

        if existing is not None:
            self.last_added_node_id = existing["id"]
            return False

        node = {"id": f"graph-node:{len(self.nodes) + 1}", "key": key, "value": value}
        self.nodes.append(node)
        self.adjacency[key] = []
        self.last_added_node_id = node["id"]
        return True

    def add_edge(self, source, target):
        self.add_node(source)
        self.add_node(target)
        source_key = self.key(source)
        target_key = self.key(target)
        source_node = next(node for node in self.nodes if node["key"] == source_key)
        target_node = next(node for node in self.nodes if node["key"] == target_key)
        existing = next((edge for edge in self.edges if (
            (edge["sourceId"] == source_node["id"] and edge["targetId"] == target_node["id"])
            or (edge["sourceId"] == target_node["id"] and edge["targetId"] == source_node["id"])
        )), None)

        if existing is not None:
            self.last_added_edge_id = existing["id"]
            return False

        edge = {
            "id": f"graph-edge:{len(self.edges) + 1}",
            "sourceId": source_node["id"],
            "targetId": target_node["id"],
        }
        self.edges.append(edge)
        self.adjacency[source_key].append(target_key)

        if source_key != target_key:
            self.adjacency[target_key].append(source_key)

        self.last_added_edge_id = edge["id"]
        return True

    def traverse(self, start, traversal_type):
        start_key = self.key(start)

        if start_key not in self.adjacency:
            raise ValueError(f"Graph does not contain starting node {start}.")

        pending = [{"key": start_key, "fromKey": None}]
        queued = {start_key}
        visited = set()
        order = []
        self.last_traversal_steps = []

        while pending:
            current = pending.pop() if traversal_type == "dfs" else pending.pop(0)

            if current["key"] in visited:
                continue

            node = next(item for item in self.nodes if item["key"] == current["key"])

            if current["fromKey"] is not None:
                previous = next(item for item in self.nodes if item["key"] == current["fromKey"])
                edge = next((item for item in self.edges if (
                    (item["sourceId"] == previous["id"] and item["targetId"] == node["id"])
                    or (item["sourceId"] == node["id"] and item["targetId"] == previous["id"])
                )), None)

                if edge is not None:
                    self.last_traversal_steps.append({
                        "kind": "edge",
                        "edgeId": edge["id"],
                        "sourceId": previous["id"],
                        "targetId": node["id"],
                    })

            visited.add(current["key"])
            order.append(node["value"])
            visited_ids = [
                next(item["id"] for item in self.nodes if item["value"] == value)
                for value in order
            ]
            self.last_traversal_steps.append({
                "kind": "visit",
                "nodeId": node["id"],
                "value": node["value"],
                "visitedIds": visited_ids,
            })
            neighbors = self.adjacency[current["key"]]
            candidates = list(reversed(neighbors)) if traversal_type == "dfs" else neighbors

            for neighbor in candidates:
                if neighbor not in visited and neighbor not in queued:
                    pending.append({"key": neighbor, "fromKey": current["key"]})
                    queued.add(neighbor)

        self.last_traversal_ids = [
            step["nodeId"] for step in self.last_traversal_steps if step["kind"] == "visit"
        ]
        return order

    def bfs(self, start):
        return self.traverse(start, "bfs")

    def dfs(self, start):
        return self.traverse(start, "dfs")

    def snapshot(self):
        return {
            "directed": self.directed,
            "nodes": [{"id": node["id"], "value": json_safe(node["value"])} for node in self.nodes],
            "edges": [dict(edge) for edge in self.edges],
        }

    def to_adjacency_object(self):
        return {
            str(node["value"]): [
                next(item["value"] for item in self.nodes if item["key"] == key)
                for key in self.adjacency[node["key"]]
            ]
            for node in self.nodes
        }


class BinarySearchTreeNode:
    def __init__(self, identifier, value, parent=None):
        self.id = identifier
        self.value = value
        self.left = None
        self.right = None
        self.parent = parent


class CodeFlowBinarySearchTree:
    def __init__(self):
        self.root = None
        self.next_node_number = 0
        self.last_visited_ids = []
        self.last_inserted_node_id = None
        self.last_found_node_id = None
        self.last_traversal_ids = []
        self.last_requested_value = None

    def validate_value(self, value):
        if not isinstance(value, (int, float, str)) or isinstance(value, bool):
            raise TypeError("The current BinarySearchTree visualizer supports number or string values only.")

        if self.root is not None and type(value) is not type(self.root.value):
            raise TypeError("All BinarySearchTree values must use the same primitive type.")

    def insert(self, value):
        self.validate_value(value)
        self.last_requested_value = value
        self.last_visited_ids = []
        self.last_inserted_node_id = None
        self.next_node_number += 1
        node = BinarySearchTreeNode(f"tree-node:{self.next_node_number}", value)

        if self.root is None:
            self.root = node
            self.last_visited_ids.append(node.id)
            self.last_inserted_node_id = node.id
            return True

        current = self.root

        while current is not None:
            self.last_visited_ids.append(current.id)

            if value == current.value:
                self.next_node_number -= 1
                return False

            direction = "left" if value < current.value else "right"
            next_node = getattr(current, direction)

            if next_node is None:
                node.parent = current
                setattr(current, direction, node)
                self.last_visited_ids.append(node.id)
                self.last_inserted_node_id = node.id
                return True

            current = next_node

        return False

    def search(self, value):
        self.validate_value(value)
        self.last_requested_value = value
        self.last_visited_ids = []
        self.last_found_node_id = None
        current = self.root

        while current is not None:
            self.last_visited_ids.append(current.id)

            if value == current.value:
                self.last_found_node_id = current.id
                return True

            current = current.left if value < current.value else current.right

        return False

    def inorder_values(self):
        values = []

        def visit(node):
            if node is None:
                return

            visit(node.left)
            values.append(node.value)
            visit(node.right)

        visit(self.root)
        return values

    def inorder(self):
        values = []
        identifiers = []

        def visit(node):
            if node is None:
                return

            visit(node.left)
            identifiers.append(node.id)
            values.append(node.value)
            visit(node.right)

        visit(self.root)
        self.last_traversal_ids = identifiers
        return values

    def snapshot(self):
        nodes = []

        def visit(node):
            if node is None:
                return

            nodes.append({
                "id": node.id,
                "value": json_safe(node.value),
                "leftId": node.left.id if node.left is not None else None,
                "rightId": node.right.id if node.right is not None else None,
                "parentId": node.parent.id if node.parent is not None else None,
            })
            visit(node.left)
            visit(node.right)

        visit(self.root)
        return nodes


class CodeFlowMinHeap:
    def __init__(self):
        self.values = []
        self.last_requested_value = None
        self.last_extracted_value = None
        self.last_peeked_value = None
        self.last_steps = []

    def validate_value(self, value):
        if not isinstance(value, (int, float, str)) or isinstance(value, bool):
            raise TypeError("The current MinHeap visualizer supports number or string values only.")

        if self.values and type(value) is not type(self.values[0]):
            raise TypeError("All MinHeap values must use the same primitive type.")

    def insert(self, value):
        self.validate_value(value)
        self.last_requested_value = value
        self.last_steps = []
        self.values.append(value)
        index = len(self.values) - 1
        self.last_steps.append({"kind": "insert", "index": index, "values": self.to_array()})

        while index > 0:
            parent_index = (index - 1) // 2

            if self.values[parent_index] <= self.values[index]:
                break

            self.values[parent_index], self.values[index] = (
                self.values[index],
                self.values[parent_index],
            )
            self.last_steps.append({
                "kind": "swap",
                "fromIndex": index,
                "toIndex": parent_index,
                "values": self.to_array(),
            })
            index = parent_index

        return len(self.values)

    def peek(self):
        self.last_peeked_value = self.values[0] if self.values else None
        self.last_steps = []
        return self.last_peeked_value

    def extract(self):
        self.last_steps = []

        if not self.values:
            self.last_extracted_value = None
            return None

        minimum = self.values[0]
        last = self.values.pop()

        if self.values:
            self.values[0] = last

        self.last_extracted_value = minimum
        self.last_steps.append({"kind": "extract", "index": 0, "values": self.to_array()})
        index = 0

        while index < len(self.values):
            left_index = index * 2 + 1
            right_index = index * 2 + 2
            smallest_index = index

            if left_index < len(self.values) and self.values[left_index] < self.values[smallest_index]:
                smallest_index = left_index

            if right_index < len(self.values) and self.values[right_index] < self.values[smallest_index]:
                smallest_index = right_index

            if smallest_index == index:
                break

            self.values[index], self.values[smallest_index] = (
                self.values[smallest_index],
                self.values[index],
            )
            self.last_steps.append({
                "kind": "swap",
                "fromIndex": index,
                "toIndex": smallest_index,
                "values": self.to_array(),
            })
            index = smallest_index

        return minimum

    def to_array(self):
        return list(self.values)


def json_safe(value, depth=0, ancestors=None):
    if depth > 12:
        return {"$type": type(value).__name__, "display": "<maximum depth reached>"}

    if value is None or isinstance(value, (bool, int, str)):
        return value

    if isinstance(value, CodeFlowLinkedList):
        return [json_safe(item, depth + 1, ancestors) for item in value.to_list()]

    if isinstance(value, CodeFlowBinarySearchTree):
        return [json_safe(item, depth + 1, ancestors) for item in value.inorder_values()]

    if isinstance(value, CodeFlowMinHeap):
        return [json_safe(item, depth + 1, ancestors) for item in value.to_array()]

    if isinstance(value, CodeFlowGraph):
        return json_safe(value.to_adjacency_object(), depth + 1, ancestors)

    if isinstance(value, float):
        if math.isfinite(value):
            return value

        return {"$type": "float", "display": repr(value)}

    if ancestors is None:
        ancestors = set()

    if isinstance(value, (list, tuple, dict, set)):
        identity = id(value)

        if identity in ancestors:
            return {"$type": type(value).__name__, "display": "<circular reference>"}

        ancestors.add(identity)

        try:
            if isinstance(value, list):
                return [json_safe(item, depth + 1, ancestors) for item in value]

            if isinstance(value, tuple):
                return {
                    "$type": "tuple",
                    "items": [json_safe(item, depth + 1, ancestors) for item in value],
                }

            if isinstance(value, set):
                items = [json_safe(item, depth + 1, ancestors) for item in value]

                return {
                    "$type": "set",
                    "items": sorted(items, key=lambda item: json.dumps(item, sort_keys=True)),
                }

            return {
                str(key): json_safe(item, depth + 1, ancestors)
                for key, item in value.items()
            }
        finally:
            ancestors.remove(identity)

    return {"$type": type(value).__name__, "display": repr(value)}


def get_value_type(value):
    if value is None:
        return "null"

    if isinstance(value, bool):
        return "boolean"

    if isinstance(value, int):
        return "integer"

    if isinstance(value, float):
        return "float"

    if isinstance(value, str):
        return "string"

    if isinstance(value, list):
        return "array"

    if isinstance(value, CodeFlowLinkedList):
        return "linked-list"

    if isinstance(value, CodeFlowBinarySearchTree):
        return "binary-search-tree"

    if isinstance(value, CodeFlowMinHeap):
        return "min-heap"

    if isinstance(value, CodeFlowGraph):
        return "graph"

    if isinstance(value, tuple):
        return "tuple"

    if isinstance(value, dict):
        return "dictionary"

    if isinstance(value, set):
        return "set"

    return type(value).__name__


def snapshot_locals(local_variables):
    snapshot = {}

    for name, value in local_variables.items():
        if name.startswith("_") or callable(value) or isinstance(value, types.ModuleType):
            continue

        snapshot[name] = {
            "value": json_safe(value),
            "valueType": get_value_type(value),
        }

    return snapshot


def validate_source_policy(tree):
    for node in ast.walk(tree):
        line = getattr(node, "lineno", None)

        if isinstance(node, FORBIDDEN_NODE_TYPES):
            raise SourcePolicyError(
                f"{type(node).__name__} is not supported in local Python execution.",
                line,
            )

        if isinstance(node, ast.Name):
            if node.id in FORBIDDEN_NAMES or node.id.startswith("__codeflow_"):
                raise SourcePolicyError(f'Access to "{node.id}" is not permitted.', line)

        if isinstance(node, ast.Attribute) and node.attr.startswith("_"):
            raise SourcePolicyError(
                f'Access to attribute "{node.attr}" is not permitted.',
                line,
            )


class SourceInstrumenter(ast.NodeTransformer):
    def __init__(self, source):
        self.source = source

    def expression_text(self, node):
        return ast.get_source_segment(self.source, node) or ast.unparse(node)

    def hook_call(self, hook_name, arguments, original_node):
        call = ast.Call(
            func=ast.Name(id=hook_name, ctx=ast.Load()),
            args=arguments,
            keywords=[],
        )

        return ast.copy_location(call, original_node)

    def hook_statement(self, hook_name, arguments, original_node):
        statement = ast.Expr(value=self.hook_call(hook_name, arguments, original_node))
        return ast.copy_location(statement, original_node)

    def visit_If(self, node):
        original_test = node.test
        expression = self.expression_text(original_test)

        self.generic_visit(node)

        node.test = self.hook_call(
            "__codeflow_condition__",
            [ast.Constant(node.lineno), ast.Constant(expression), node.test],
            original_test,
        )

        node.body.insert(
            0,
            self.hook_statement(
                "__codeflow_branch__",
                [ast.Constant(node.lineno), ast.Constant("if")],
                node,
            ),
        )

        if node.orelse:
            node.orelse.insert(
                0,
                self.hook_statement(
                    "__codeflow_branch__",
                    [ast.Constant(node.lineno), ast.Constant("else")],
                    node,
                ),
            )

        return node

    def visit_For(self, node):
        original_iterator = node.iter
        expression = self.expression_text(original_iterator)

        self.generic_visit(node)

        node.iter = self.hook_call(
            "__codeflow_iterate__",
            [ast.Constant(node.lineno), ast.Constant(expression), node.iter],
            original_iterator,
        )

        return node

    def visit_While(self, node):
        original_test = node.test
        expression = self.expression_text(original_test)

        self.generic_visit(node)

        node.test = self.hook_call(
            "__codeflow_while_condition__",
            [ast.Constant(node.lineno), ast.Constant(expression), node.test],
            original_test,
        )

        node.body.insert(
            0,
            self.hook_statement(
                "__codeflow_loop_iteration__",
                [ast.Constant(node.lineno)],
                node,
            ),
        )

        return [
            self.hook_statement(
                "__codeflow_loop_start__",
                [ast.Constant(node.lineno), ast.Constant("while")],
                node,
            ),
            node,
            self.hook_statement(
                "__codeflow_loop_end__",
                [ast.Constant(node.lineno)],
                node,
            ),
        ]

    def visit_Subscript(self, node):
        self.generic_visit(node)

        if not isinstance(node.ctx, ast.Load) or not isinstance(node.value, ast.Name):
            return node

        return self.hook_call(
            "__codeflow_array_access__",
            [
                ast.Constant(node.value.id),
                node.value,
                node.slice,
                ast.Constant(node.lineno),
            ],
            node,
        )

    def visit_Call(self, node):
        self.generic_visit(node)

        if not isinstance(node.func, ast.Attribute):
            return node

        if not isinstance(node.func.value, ast.Name):
            return node

        if node.func.attr not in {
            "append", "pop", "insert", "remove", "extend", "clear",
            "prepend", "remove_at", "get", "to_list", "update", "setdefault",
            "search", "inorder", "peek", "extract", "to_array",
            "add_node", "add_edge", "bfs", "dfs",
            "linear_search", "binary_search",
            "bubble_sort", "selection_sort", "insertion_sort",
            "merge_sort", "quick_sort"
        }:
            return node

        rewritten = ast.Call(
            func=ast.Name(id="__codeflow_method__", ctx=ast.Load()),
            args=[
                ast.Constant(node.lineno),
                ast.Constant(node.func.value.id),
                node.func.value,
                ast.Constant(node.func.attr),
                *node.args,
            ],
            keywords=node.keywords,
        )

        return ast.copy_location(rewritten, node)


class PythonExecutionTracer:
    def __init__(self, maximum_events, maximum_output_bytes):
        self.maximum_events = maximum_events
        self.maximum_output_bytes = maximum_output_bytes
        self.events = []
        self.frame_states = {}
        self.loop_iterations = {}
        self.output_bytes = 0
        self.frame_number = 0
        self.last_line = 1
        self.search_algorithms = CodeFlowSearchAlgorithms()
        self.sorting_algorithms = CodeFlowSortingAlgorithms()

    def record(self, event_type, line, payload=None, scope_id=None):
        if len(self.events) >= self.maximum_events - 2:
            raise TraceLimitError(
                f"Python execution exceeded the maximum of {self.maximum_events} events."
            )

        normalized_line = line if isinstance(line, int) and line > 0 else self.last_line
        self.last_line = normalized_line

        self.events.append({
            "type": event_type,
            "line": normalized_line,
            "scopeId": scope_id,
            "payload": json_safe(payload or {}),
        })

    def caller_scope(self):
        frame = sys._getframe(1)

        while frame is not None:
            if frame.f_code.co_filename == SOURCE_FILENAME:
                return self.frame_states.get(id(frame), {}).get("scopeId")

            frame = frame.f_back

        return None

    def declare_variable(self, name, variable, line, scope_id):
        value = variable["value"]

        if variable["valueType"] == "linked-list":
            self.record(
                "LINKED_LIST_CREATE",
                line,
                {
                    "name": name,
                    "listName": name,
                    "nodes": [],
                    "headId": None,
                    "tailId": None,
                    "length": 0,
                },
                scope_id,
            )

        if variable["valueType"] == "dictionary":
            self.record(
                "HASHMAP_CREATE",
                line,
                {
                    "name": name,
                    "mapName": name,
                    "entries": [
                        {"key": key, "value": item}
                        for key, item in value.items()
                    ],
                    "size": len(value),
                },
                scope_id,
            )

        if variable["valueType"] == "binary-search-tree":
            self.record(
                "TREE_CREATE",
                line,
                {
                    "name": name,
                    "treeName": name,
                    "nodes": [],
                    "rootId": None,
                },
                scope_id,
            )

        if variable["valueType"] == "min-heap":
            self.record(
                "HEAP_CREATE",
                line,
                {
                    "name": name,
                    "heapName": name,
                    "heapType": "min",
                    "values": value,
                },
                scope_id,
            )

        if variable["valueType"] == "graph":
            self.record(
                "GRAPH_CREATE",
                line,
                {"name": name, "graphName": name, "directed": False, "nodes": [], "edges": []},
                scope_id,
            )

        if variable["valueType"] == "array":
            self.record(
                "ARRAY_CREATE",
                line,
                {"name": name, "arrayName": name, "values": value, "length": len(value)},
                scope_id,
            )

        self.record(
            "VARIABLE_DECLARE",
            line,
            {"name": name, "value": value, "valueType": variable["valueType"]},
            scope_id,
        )

        if variable["valueType"] == "array" and "stack" in name.lower():
            self.record("STACK_CREATE", line, {"name": name, "values": value}, scope_id)

        if variable["valueType"] == "array" and "queue" in name.lower():
            self.record("QUEUE_CREATE", line, {"name": name, "values": value}, scope_id)

    def update_variable(self, name, previous, current, line, scope_id):
        previous_value = previous["value"]
        new_value = current["value"]

        if previous["valueType"] == "array" and current["valueType"] == "array":
            if len(previous_value) == len(new_value):
                for index, (old_item, new_item) in enumerate(zip(previous_value, new_value)):
                    if old_item != new_item:
                        self.record(
                            "ARRAY_UPDATE",
                            line,
                            {
                                "name": name,
                                "arrayName": name,
                                "index": index,
                                "previousValue": old_item,
                                "value": new_item,
                                "newValue": new_item,
                                "values": new_value,
                            },
                            scope_id,
                        )

        if previous["valueType"] == "dictionary" and current["valueType"] == "dictionary":
            for key, value in new_value.items():
                if key not in previous_value or previous_value[key] != value:
                    self.record(
                        "HASHMAP_SET",
                        line,
                        {
                            "name": name,
                            "mapName": name,
                            "key": key,
                            "value": value,
                            "previousValue": previous_value.get(key),
                            "updated": key in previous_value,
                            "entries": [
                                {"key": item_key, "value": item_value}
                                for item_key, item_value in new_value.items()
                            ],
                            "size": len(new_value),
                        },
                        scope_id,
                    )

            for key, value in previous_value.items():
                if key not in new_value:
                    self.record(
                        "HASHMAP_DELETE",
                        line,
                        {
                            "name": name,
                            "mapName": name,
                            "key": key,
                            "value": value,
                            "entries": [
                                {"key": item_key, "value": item_value}
                                for item_key, item_value in new_value.items()
                            ],
                            "size": len(new_value),
                        },
                        scope_id,
                    )

        self.record(
            "VARIABLE_UPDATE",
            line,
            {
                "name": name,
                "previousValue": previous_value,
                "value": new_value,
                "newValue": new_value,
                "valueType": current["valueType"],
            },
            scope_id,
        )

    def flush_variable_changes(self, frame, line):
        frame_state = self.frame_states.get(id(frame))

        if frame_state is None:
            return

        previous_locals = frame_state["locals"]
        current_locals = snapshot_locals(frame.f_locals)
        scope_id = frame_state["scopeId"]

        for name, current_variable in current_locals.items():
            previous_variable = previous_locals.get(name)

            if previous_variable is None:
                self.declare_variable(name, current_variable, line, scope_id)
            elif previous_variable != current_variable:
                self.update_variable(name, previous_variable, current_variable, line, scope_id)

        frame_state["locals"] = current_locals

    def trace_function(self, frame, event, argument):
        if frame.f_code.co_filename != SOURCE_FILENAME:
            return None

        frame_id = id(frame)
        function_name = frame.f_code.co_name

        if event == "call":
            current_locals = snapshot_locals(frame.f_locals)
            scope_id = None

            if function_name != "<module>":
                self.frame_number += 1
                scope_id = f"{function_name}:{self.frame_number}"

            self.frame_states[frame_id] = {
                "locals": current_locals,
                "lastLine": None,
                "scopeId": scope_id,
            }

            if function_name != "<module>":
                caller_line = frame.f_back.f_lineno if frame.f_back else frame.f_code.co_firstlineno

                self.record(
                    "FUNCTION_CALL",
                    caller_line,
                    {
                        "name": function_name,
                        "functionName": function_name,
                        "arguments": [item["value"] for item in current_locals.values()],
                    },
                    self.frame_states.get(id(frame.f_back), {}).get("scopeId"),
                )

                parameters = {
                    name: item["value"]
                    for name, item in current_locals.items()
                }

                self.record(
                    "FUNCTION_ENTER",
                    frame.f_code.co_firstlineno,
                    {
                        "name": function_name,
                        "functionName": function_name,
                        "frameId": scope_id,
                        "parameters": parameters,
                    },
                    scope_id,
                )

                for name, variable in current_locals.items():
                    self.declare_variable(name, variable, frame.f_code.co_firstlineno, scope_id)

            return self.trace_function

        frame_state = self.frame_states.get(frame_id)

        if frame_state is None:
            return self.trace_function

        scope_id = frame_state["scopeId"]

        if event == "line":
            previous_line = frame_state["lastLine"]

            if previous_line is not None:
                self.flush_variable_changes(frame, previous_line)

            self.record(
                "STATEMENT_EXECUTE",
                frame.f_lineno,
                {"functionName": function_name, "statementKind": "python-line"},
                scope_id,
            )

            frame_state["lastLine"] = frame.f_lineno
            return self.trace_function

        if event == "return":
            last_line = frame_state["lastLine"] or frame.f_code.co_firstlineno
            self.flush_variable_changes(frame, last_line)

            if function_name != "<module>":
                self.record(
                    "FUNCTION_RETURN",
                    last_line,
                    {
                        "name": function_name,
                        "functionName": function_name,
                        "value": json_safe(argument),
                        "returnValue": json_safe(argument),
                    },
                    scope_id,
                )

            self.frame_states.pop(frame_id, None)

        return self.trace_function

    def trace_condition(self, line, expression, result):
        self.record(
            "CONDITION_EVALUATE",
            line,
            {"expression": expression, "result": bool(result)},
            self.caller_scope(),
        )

        return result

    def trace_branch(self, line, branch):
        self.record(
            "BRANCH_ENTER",
            line,
            {"branch": branch, "reason": f"{branch} branch selected."},
            self.caller_scope(),
        )

    def start_loop(self, line, loop_type):
        self.loop_iterations[line] = 0

        self.record(
            "LOOP_START",
            line,
            {"loopId": f"line:{line}", "loopType": loop_type},
            self.caller_scope(),
        )

    def record_loop_iteration(self, line):
        iteration = self.loop_iterations.get(line, 0) + 1
        self.loop_iterations[line] = iteration

        self.record(
            "LOOP_ITERATION",
            line,
            {"loopId": f"line:{line}", "iteration": iteration},
            self.caller_scope(),
        )

    def end_loop(self, line):
        iterations = self.loop_iterations.pop(line, 0)

        self.record(
            "LOOP_END",
            line,
            {"loopId": f"line:{line}", "iterations": iterations},
            self.caller_scope(),
        )

    def trace_iterator(self, line, expression, iterable):
        self.start_loop(line, "for")

        for item in iterable:
            self.record(
                "LOOP_CONDITION",
                line,
                {"loopId": f"line:{line}", "expression": expression, "result": True},
                self.caller_scope(),
            )

            self.record_loop_iteration(line)
            yield item

        self.record(
            "LOOP_CONDITION",
            line,
            {"loopId": f"line:{line}", "expression": expression, "result": False},
            self.caller_scope(),
        )

        self.end_loop(line)

    def trace_while_condition(self, line, expression, result):
        self.record(
            "LOOP_CONDITION",
            line,
            {"loopId": f"line:{line}", "expression": expression, "result": bool(result)},
            self.caller_scope(),
        )

        return result

    def trace_array_access(self, name, collection, index, line):
        value = collection[index]

        if isinstance(collection, dict):
            self.record(
                "HASHMAP_GET",
                line,
                {
                    "name": name,
                    "mapName": name,
                    "key": json_safe(index),
                    "value": json_safe(value),
                    "entries": [
                        {"key": json_safe(key), "value": json_safe(item)}
                        for key, item in collection.items()
                    ],
                    "size": len(collection),
                },
                self.caller_scope(),
            )

        if isinstance(collection, list):
            self.record(
                "ARRAY_ACCESS",
                line,
                {
                    "name": name,
                    "arrayName": name,
                    "index": json_safe(index),
                    "value": json_safe(value),
                },
                self.caller_scope(),
            )

            if "queue" in name.lower() and index == 0:
                self.record(
                    "QUEUE_PEEK",
                    line,
                    {"name": name, "value": json_safe(value), "values": json_safe(collection)},
                    self.caller_scope(),
                )

        return value

    def trace_method(self, line, name, collection, method_name, *args, **kwargs):
        method = getattr(collection, method_name)

        if isinstance(collection, (CodeFlowSearchAlgorithms, CodeFlowSortingAlgorithms)):
            result = method(*args, **kwargs)
            caller = sys._getframe(1)
            array_name = next(
                (variable_name for variable_name, value in caller.f_locals.items()
                 if args and value is args[0]),
                "values",
            )

            for event_type, payload in collection.last_steps:
                self.record(
                    event_type,
                    line,
                    {**payload, "arrayName": array_name},
                    self.caller_scope(),
                )

            return result

        if isinstance(collection, dict):
            result = method(*args, **kwargs)

            if method_name == "get":
                self.record(
                    "HASHMAP_GET",
                    line,
                    {
                        "name": name,
                        "mapName": name,
                        "key": json_safe(args[0]),
                        "value": json_safe(result),
                        "entries": [
                            {"key": json_safe(key), "value": json_safe(item)}
                            for key, item in collection.items()
                        ],
                        "size": len(collection),
                    },
                    self.caller_scope(),
                )

            return result

        if isinstance(collection, CodeFlowLinkedList):
            before = collection.snapshot()
            result = method(*args, **kwargs)
            after = collection.snapshot()
            scope_id = self.caller_scope()
            payload = {
                "name": name,
                "listName": name,
                "nodes": after,
                "headId": after[0]["id"] if after else None,
                "tailId": after[-1]["id"] if after else None,
                "length": len(after),
            }

            inserted = next(
                (node for node in after if not any(item["id"] == node["id"] for item in before)),
                None,
            )
            removed = next(
                (node for node in before if not any(item["id"] == node["id"] for item in after)),
                None,
            )

            if inserted is not None:
                index = next(position for position, node in enumerate(after) if node["id"] == inserted["id"])

                self.record(
                    "NODE_CREATE",
                    line,
                    {**payload, "nodeId": inserted["id"], "value": inserted["value"], "nextId": inserted["nextId"]},
                    scope_id,
                )
                self.record(
                    "REFERENCE_UPDATE",
                    line,
                    {
                        **payload,
                        "reference": "head" if index == 0 else "next",
                        "fromNodeId": None if index == 0 else after[index - 1]["id"],
                        "previousTargetId": (before[0]["id"] if before else None) if index == 0 else before[index - 1]["nextId"],
                        "targetNodeId": inserted["id"],
                    },
                    scope_id,
                )
                self.record(
                    "NODE_INSERT",
                    line,
                    {**payload, "nodeId": inserted["id"], "value": inserted["value"], "index": index},
                    scope_id,
                )
            elif removed is not None:
                index = next(position for position, node in enumerate(before) if node["id"] == removed["id"])

                self.record(
                    "REFERENCE_UPDATE",
                    line,
                    {
                        **payload,
                        "reference": "head" if index == 0 else "next",
                        "fromNodeId": None if index == 0 else before[index - 1]["id"],
                        "previousTargetId": removed["id"],
                        "targetNodeId": after[index]["id"] if index < len(after) else None,
                    },
                    scope_id,
                )
                self.record(
                    "NODE_DELETE",
                    line,
                    {**payload, "nodeId": removed["id"], "value": removed["value"], "index": index},
                    scope_id,
                )
            elif method_name == "get":
                index = int(args[0])
                node = after[index]

                self.record(
                    "NODE_VISIT",
                    line,
                    {**payload, "nodeId": node["id"], "value": node["value"], "index": index},
                    scope_id,
                )

            return result

        if isinstance(collection, CodeFlowGraph):
            result = method(*args, **kwargs)
            scope_id = self.caller_scope()
            payload = {"name": name, "graphName": name, **collection.snapshot()}

            if method_name == "add_node":
                node = next(item for item in collection.nodes if item["id"] == collection.last_added_node_id)
                self.record("GRAPH_NODE_ADD", line, {
                    **payload,
                    "nodeId": node["id"],
                    "value": json_safe(node["value"]),
                    "inserted": bool(result),
                }, scope_id)
            elif method_name == "add_edge":
                edge = next(item for item in collection.edges if item["id"] == collection.last_added_edge_id)
                self.record("GRAPH_EDGE_ADD", line, {
                    **payload,
                    "edgeId": edge["id"],
                    "sourceId": edge["sourceId"],
                    "targetId": edge["targetId"],
                    "inserted": bool(result),
                }, scope_id)
            elif method_name in {"bfs", "dfs"}:
                for step in collection.last_traversal_steps:
                    self.record(
                        "GRAPH_EDGE_TRAVERSE" if step["kind"] == "edge" else "GRAPH_VISIT",
                        line,
                        {**payload, **json_safe(step), "traversalType": method_name},
                        scope_id,
                    )

                self.record("GRAPH_TRAVERSE", line, {
                    **payload,
                    "traversalType": method_name,
                    "visitedIds": collection.last_traversal_ids,
                    "order": json_safe(result),
                }, scope_id)

            return result

        if isinstance(collection, CodeFlowBinarySearchTree):
            result = method(*args, **kwargs)
            nodes = collection.snapshot()
            scope_id = self.caller_scope()
            payload = {
                "name": name,
                "treeName": name,
                "nodes": nodes,
                "rootId": collection.root.id if collection.root is not None else None,
            }

            if method_name == "insert":
                self.record(
                    "TREE_INSERT",
                    line,
                    {
                        **payload,
                        "value": json_safe(collection.last_requested_value),
                        "inserted": bool(result),
                        "insertedNodeId": collection.last_inserted_node_id,
                        "path": collection.last_visited_ids,
                    },
                    scope_id,
                )
            elif method_name == "search":
                self.record(
                    "TREE_SEARCH",
                    line,
                    {
                        **payload,
                        "target": json_safe(collection.last_requested_value),
                        "found": bool(result),
                        "foundNodeId": collection.last_found_node_id,
                        "path": collection.last_visited_ids,
                    },
                    scope_id,
                )
            elif method_name == "inorder":
                self.record(
                    "TREE_TRAVERSE",
                    line,
                    {
                        **payload,
                        "traversalType": "inorder",
                        "visitedIds": collection.last_traversal_ids,
                        "order": json_safe(result),
                    },
                    scope_id,
                )

            return result

        if isinstance(collection, CodeFlowMinHeap):
            result = method(*args, **kwargs)
            scope_id = self.caller_scope()
            base_payload = {
                "name": name,
                "heapName": name,
                "heapType": "min",
            }

            if method_name == "insert":
                insert_step = collection.last_steps[0] if collection.last_steps else {
                    "index": len(collection.values) - 1,
                    "values": collection.to_array(),
                }
                self.record(
                    "HEAP_INSERT",
                    line,
                    {
                        **base_payload,
                        "value": json_safe(collection.last_requested_value),
                        "index": insert_step["index"],
                        "values": json_safe(insert_step["values"]),
                    },
                    scope_id,
                )

                for step in collection.last_steps[1:]:
                    self.record(
                        "HEAP_SWAP",
                        line,
                        {
                            **base_payload,
                            "fromIndex": step["fromIndex"],
                            "toIndex": step["toIndex"],
                            "values": json_safe(step["values"]),
                            "reason": "bubble-up",
                        },
                        scope_id,
                    )
            elif method_name == "peek":
                self.record(
                    "HEAP_PEEK",
                    line,
                    {
                        **base_payload,
                        "value": json_safe(result),
                        "values": json_safe(collection.to_array()),
                        "activeIndices": [0] if collection.values else [],
                    },
                    scope_id,
                )
            elif method_name == "extract":
                extract_step = collection.last_steps[0] if collection.last_steps else {
                    "values": collection.to_array(),
                }
                self.record(
                    "HEAP_EXTRACT",
                    line,
                    {
                        **base_payload,
                        "value": json_safe(result),
                        "values": json_safe(extract_step["values"]),
                        "activeIndices": [0] if extract_step["values"] else [],
                    },
                    scope_id,
                )

                for step in collection.last_steps[1:]:
                    self.record(
                        "HEAP_SWAP",
                        line,
                        {
                            **base_payload,
                            "fromIndex": step["fromIndex"],
                            "toIndex": step["toIndex"],
                            "values": json_safe(step["values"]),
                            "reason": "bubble-down",
                        },
                        scope_id,
                    )

            return result

        if not isinstance(collection, list):
            return method(*args, **kwargs)

        before = json_safe(collection)
        result = method(*args, **kwargs)
        after = json_safe(collection)
        scope_id = self.caller_scope()

        if len(after) > len(before):
            if method_name == "insert":
                indexes = [max(0, min(int(args[0]), len(after) - 1))]
            else:
                indexes = list(range(len(before), len(after)))

            for index in indexes:
                value = after[index]

                self.record(
                    "ARRAY_INSERT",
                    line,
                    {"name": name, "arrayName": name, "index": index, "value": value},
                    scope_id,
                )

                if "stack" in name.lower():
                    self.record("STACK_PUSH", line, {"name": name, "value": value}, scope_id)

                if "queue" in name.lower():
                    self.record("QUEUE_ENQUEUE", line, {"name": name, "value": value}, scope_id)

        elif len(after) < len(before):
            if method_name == "pop":
                index = int(args[0]) if args else len(before) - 1

                if index < 0:
                    index += len(before)
            elif method_name == "remove":
                index = before.index(json_safe(args[0]))
            else:
                index = 0

            removed = before[index]

            self.record(
                "ARRAY_DELETE",
                line,
                {"name": name, "arrayName": name, "index": index, "value": removed},
                scope_id,
            )

            if "stack" in name.lower():
                self.record("STACK_POP", line, {"name": name, "value": removed}, scope_id)

            if "queue" in name.lower() and index == 0:
                self.record("QUEUE_DEQUEUE", line, {"name": name, "value": removed}, scope_id)

        return result

    def traced_print(self, *values, sep=" ", end="\n", **kwargs):
        if kwargs:
            raise ValueError("print() file and flush arguments are not supported.")

        rendered = str(sep).join(str(value) for value in values)
        output_bytes = len((rendered + str(end)).encode("utf-8"))

        if self.output_bytes + output_bytes > self.maximum_output_bytes:
            raise OutputLimitError("Python execution exceeded the maximum console output size.")

        self.output_bytes += output_bytes
        caller = sys._getframe(1)

        self.record(
            "OUTPUT",
            caller.f_lineno,
            {"channel": "stdout", "text": rendered, "end": str(end)},
            self.frame_states.get(id(caller), {}).get("scopeId"),
        )

    def safe_builtins(self):
        return {
            "abs": abs,
            "all": all,
            "any": any,
            "bool": bool,
            "dict": dict,
            "enumerate": enumerate,
            "Exception": Exception,
            "float": float,
            "int": int,
            "isinstance": isinstance,
            "len": len,
            "list": list,
            "LinkedList": CodeFlowLinkedList,
            "BinarySearchTree": CodeFlowBinarySearchTree,
            "MinHeap": CodeFlowMinHeap,
            "Graph": CodeFlowGraph,
            "SearchAlgorithms": self.search_algorithms,
            "SortingAlgorithms": self.sorting_algorithms,
            "max": max,
            "min": min,
            "print": self.traced_print,
            "range": range,
            "reversed": reversed,
            "round": round,
            "set": set,
            "sorted": sorted,
            "str": str,
            "sum": sum,
            "tuple": tuple,
            "TypeError": TypeError,
            "ValueError": ValueError,
            "zip": zip,
        }

    def execution_globals(self):
        return {
            "__name__": "__main__",
            "__builtins__": self.safe_builtins(),
            "__codeflow_condition__": self.trace_condition,
            "__codeflow_branch__": self.trace_branch,
            "__codeflow_iterate__": self.trace_iterator,
            "__codeflow_loop_start__": self.start_loop,
            "__codeflow_loop_iteration__": self.record_loop_iteration,
            "__codeflow_loop_end__": self.end_loop,
            "__codeflow_while_condition__": self.trace_while_condition,
            "__codeflow_array_access__": self.trace_array_access,
            "__codeflow_method__": self.trace_method,
        }

    def find_error_line(self, error):
        if isinstance(error, SyntaxError) and error.lineno:
            return error.lineno

        for frame in reversed(traceback.extract_tb(error.__traceback__)):
            if frame.filename == SOURCE_FILENAME:
                return frame.lineno

        return self.last_line

    def run(self, source):
        try:
            tree = ast.parse(source, filename=SOURCE_FILENAME, mode="exec")
            validate_source_policy(tree)
        except SourcePolicyError:
            raise
        except Exception as error:
            return {
                "status": "ok",
                "executionStatus": "failed",
                "events": [{
                    "type": "ERROR",
                    "line": self.find_error_line(error),
                    "scopeId": None,
                    "payload": {
                        "name": type(error).__name__,
                        "errorType": type(error).__name__,
                        "message": str(error),
                    },
                }],
            }

        instrumented = SourceInstrumenter(source).visit(tree)
        ast.fix_missing_locations(instrumented)
        compiled = compile(instrumented, SOURCE_FILENAME, "exec")
        globals_dictionary = self.execution_globals()

        try:
            sys.settrace(self.trace_function)
            exec(compiled, globals_dictionary, globals_dictionary)
        except Exception as error:
            sys.settrace(None)

            self.events.append({
                "type": "ERROR",
                "line": self.find_error_line(error),
                "scopeId": None,
                "payload": {
                    "name": type(error).__name__,
                    "errorType": type(error).__name__,
                    "message": str(error),
                },
            })

            return {
                "status": "ok",
                "executionStatus": "failed",
                "events": self.events,
            }
        finally:
            sys.settrace(None)

        return {
            "status": "ok",
            "executionStatus": "completed",
            "events": self.events,
        }


def main():
    raw_input = sys.stdin.buffer.read(MAXIMUM_INPUT_BYTES + 1)

    if not raw_input:
        raise ValueError("Python worker did not receive an execution payload.")

    if len(raw_input) > MAXIMUM_INPUT_BYTES:
        raise ValueError("Python worker input exceeded the maximum size.")

    payload = json.loads(raw_input.decode("utf-8"))

    source = payload.get("source")

    if not isinstance(source, str) or not source.strip():
        raise ValueError("Python source must be a non-empty string.")

    tracer = PythonExecutionTracer(
        maximum_events=int(payload.get("maximumTraceEvents", 1000)),
        maximum_output_bytes=int(payload.get("maximumOutputBytes", 16 * 1024)),
    )

    try:
        result = tracer.run(source)
    except SourcePolicyError as error:
        result = {
            "status": "error",
            "error": {
                "code": "SOURCE_POLICY_VIOLATION",
                "name": "SourcePolicyError",
                "message": str(error),
                "line": error.line,
            },
        }

    encoded = json.dumps(result, ensure_ascii=True, separators=(",", ":")).encode("utf-8")
    sys.stdout.buffer.write(encoded)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as error:
        sys.stderr.write(f"Python execution worker failed: {error}\n")
        raise SystemExit(1)
