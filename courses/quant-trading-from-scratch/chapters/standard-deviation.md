# Standard deviation: how far numbers typically sit from their average

You can now turn prices into a list of returns, one for each day. Two shares can have the same average daily return and still feel very different to own. One moves a little each day. The other jumps up and down. How do you put one number on how much a list of numbers jumps around?

## Two routes to work

Picture two routes to work. You time each route on 5 mornings. Both take 30 minutes on average. Route A always takes between 28 and 32 minutes. Route B takes anything from 20 to 45 minutes. The average is the same, but you can plan around route A and you cannot plan around route B.

In this picture, a commute time stands for one number in a list, for example one day's return. The spread of the times stands for how much the numbers jump around. The picture stops holding in one place: a commute time is never negative, but a return can be negative.

## Measuring the spread step by step

Here are the times in minutes. Route A: 28, 31, 30, 32, 29. Route B: 20, 45, 25, 40, 20.

1. Find the average. The **mean** is the sum of the numbers divided by how many there are. For route A, (28 + 31 + 30 + 32 + 29) / 5 = 30 minutes. Route B also has a mean of 30.
2. Find each number's distance from the mean. For route A the distances are −2, 1, 0, 2 and −1.
3. Square each distance. For route A this gives 4, 1, 0, 4 and 1.
4. Take the mean of the squares. For route A, (4 + 1 + 0 + 4 + 1) / 5 = 2. This mean of squared distances is the **variance**.
5. Take the square root of the variance. For route A, √2 = 1.41 minutes.

For route B the distances are −10, 15, −5, 10 and −10. Their squares are 100, 225, 25, 100 and 100. The variance is 550 / 5 = 110, and the square root is 10.49 minutes.

```inkling
title "From a list of numbers to one spread"
layout down
nums: box "Route A times\n28 31 30 32 29"
mean: box "Mean\n30 minutes"
dist: box "Distances\n-2 1 0 2 -1"
sq: box "Squares\n4 1 0 4 1"
var: box "Variance\nmean of squares = 2" yellow
sd: round "Standard deviation\n1.41 minutes" green
nums -> mean -> dist -> sq -> var -> sd
circle sd
step 1: nums, mean "Find the average of the numbers"
step 2: dist "Measure how far each number is from it"
step 3: sq "Square each distance so none cancel"
step 4: var "Average the squares to get the variance"
step 5: sd "Take the square root to return to minutes"
```

Why square the distances? The plain distances always add up to 0, because the numbers above the mean balance the numbers below it. Squaring makes every distance positive, so they cannot cancel. Squaring also makes a big distance count more than a small one. The square root at the end puts the result back in the original unit, minutes, instead of minutes squared.

The same steps in Python, with numpy:

```python
import numpy as np

route_a = np.array([28, 31, 30, 32, 29])
route_b = np.array([20, 45, 25, 40, 20])

for times in (route_a, route_b):
    mean = times.mean()
    variance = ((times - mean) ** 2).mean()
    print(mean, variance, round(np.sqrt(variance), 2))

print(round(route_b.std(), 2), round(route_b.std(ddof=1), 2))
```

```
30.0 2.0 1.41
30.0 110.0 10.49
10.49 11.73
```

The last line shows a detail you will meet in libraries. When you have only a sample of the numbers, the usual formula divides the sum of squares by one less than the count. For route B, 550 / 4 = 137.5, and its square root is 11.73. This is the **sample standard deviation**. By default, numpy divides by the count, and `ddof=1` changes that. By default, pandas divides by one less than the count. With 5 numbers, the two answers differ by about 12% here. With 1,000 numbers the difference is about 0.05%.

## Name it

The **standard deviation** is the square root of the variance. It tells you how far the numbers in a list typically sit from their mean, in the same unit as the numbers.

> **Key idea:** The standard deviation squares each distance from the mean, averages the squares, and takes the square root, so one number describes how widely a list spreads.

## What you have now

You can describe any list with two numbers: its mean, and its standard deviation. A list of returns, as you saw with a return, is a list of numbers like any other. The next question is what the standard deviation of daily returns tells you about owning a share.
