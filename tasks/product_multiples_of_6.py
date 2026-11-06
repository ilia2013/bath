a, b = map(int, input().split())

start = min(a, b)
end = max(a, b)

dobutok = 1

for x in range(start, end + 1):
    if x > 0 and x % 6 == 0:
        dobutok *= x

print(dobutok)
