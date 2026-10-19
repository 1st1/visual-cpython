# Breadth-first search on an unweighted graph.
def shortest_path(graph, start, goal):
    queue = [start]
    paths = {start: [start]}
    while queue:
        node = queue[0]
        queue = queue[1:]
        if node == goal:
            return paths[node]
        for neighbor in graph[node]:
            if neighbor not in paths:
                paths[neighbor] = paths[node] + [neighbor]
                queue = queue + [neighbor]
    return None

# Two routes reach node 5; BFS finds a shortest one.
graph = [[1, 2], [3], [3, 4], [5], [5], []]
print(shortest_path(graph, 0, 5))
