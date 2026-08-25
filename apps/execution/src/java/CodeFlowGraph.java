import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Small deterministic educational graph exposed to the local Java visualizer. */
class Graph {
    private final Map<String, List<String>> adjacency = new LinkedHashMap<>();

    boolean addNode(String value) {
        if (value == null) {
            throw new IllegalArgumentException("Graph node values cannot be null.");
        }

        if (adjacency.containsKey(value)) {
            return false;
        }

        adjacency.put(value, new ArrayList<>());
        return true;
    }

    boolean addEdge(String source, String target) {
        addNode(source);
        addNode(target);

        if (adjacency.get(source).contains(target)) {
            return false;
        }

        adjacency.get(source).add(target);

        if (!source.equals(target)) {
            adjacency.get(target).add(source);
        }

        return true;
    }

    String[] bfs(String start) {
        return traverse(start, false);
    }

    String[] dfs(String start) {
        return traverse(start, true);
    }

    private String[] traverse(String start, boolean depthFirst) {
        if (!adjacency.containsKey(start)) {
            throw new IllegalArgumentException("Graph does not contain starting node " + start + ".");
        }

        Deque<String> pending = new ArrayDeque<>();
        Set<String> queued = new LinkedHashSet<>();
        Set<String> visited = new LinkedHashSet<>();
        pending.addLast(start);
        queued.add(start);

        while (!pending.isEmpty()) {
            String current = depthFirst ? pending.removeLast() : pending.removeFirst();

            if (!visited.add(current)) {
                continue;
            }

            List<String> neighbors = adjacency.get(current);

            if (depthFirst) {
                for (int index = neighbors.size() - 1; index >= 0; index--) {
                    String neighbor = neighbors.get(index);

                    if (!visited.contains(neighbor) && queued.add(neighbor)) {
                        pending.addLast(neighbor);
                    }
                }
            } else {
                for (String neighbor : neighbors) {
                    if (!visited.contains(neighbor) && queued.add(neighbor)) {
                        pending.addLast(neighbor);
                    }
                }
            }
        }

        return visited.toArray(new String[0]);
    }
}
