# Добуток додатних чисел, кратних 6, на проміжку [a, b].
a, b = map(int, input().split())
if a > b:
    a, b = b, a

start = max(a, 1)
start += (-start) % 6  # перше додатне число >= start, кратне 6

p = 1
for x in range(start, b + 1, 6):
    p *= x

print(p)
