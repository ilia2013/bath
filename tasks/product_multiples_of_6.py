a, b = map(int, input().split())
p = 1
for x in range(a, b + 1):
    if x > 0 and x % 6 == 0:
        p *= x
print(p)
