def accumulate(n, step):
    total = 0
    for i in range(n):
        total = total + step
    return total

print(accumulate(8, 1))
