# Covariance: how two returns move together

Standard deviation tells you how much one stock's returns swing. Now you hold two stocks. On the days stock A goes up, does stock B go up too? Or does it fall? Or does it do whatever it likes? One number from one series cannot answer that. You need a number that looks at both series on the same day.

## Same day, same direction

Picture two friends who walk to work. Each morning you note whether each one arrived earlier or later than their own typical time. If both are late on rainy days and both are early on clear days, their lateness moves together. If one is late whenever the other is early, it moves in opposite directions.

Here each friend stands for one stock. "Their own typical time" stands for the mean return of that stock. "Late" and "early" stand for a return above or below that mean. The picture stops holding in one place: a friend is late or early, but a return also has a size. A day 3% above the mean must count for more than a day 0.1% above it.

So the recipe uses the size as well as the direction:

1. For each stock, subtract its mean return from each day's return. The result is that day's deviation.
2. On each day, multiply A's deviation by B's deviation.
3. Average those products.

Step 2 is the heart of it. If both deviations have the same sign, the product is positive. If they have opposite signs, the product is negative. A large move in both makes a large product.

```inkling
title "Covariance in three steps"
layout flow
ret: box "Daily returns\nA and B"
dev: box "Subtract\neach mean"
prod: box "Multiply A × B\nday by day"
avg: box "Average the\nproducts" yellow
sign: diamond "Sign?"
ret -> dev -> prod -> avg -> sign
note prod "same sign: positive\nopposite sign: negative"
highlight prod
step 1: ret "Start with both stocks' returns on the same days"
step 2: dev "Each return becomes a distance from its own mean"
step 3: prod "Multiply the two distances on each day"
step 4: avg, sign "The average says if they move together or apart"
```

## Five days by hand

Here are five days of illustrative returns, in percent.

| Day | A | B | A deviation | B deviation | Product |
| --- | --- | --- | --- | --- | --- |
| 1 | 2 | 1 | 1.4 | 0.8 | 1.12 |
| 2 | −1 | −1 | −1.6 | −1.2 | 1.92 |
| 3 | 3 | 2 | 2.4 | 1.8 | 4.32 |
| 4 | −2 | −1 | −2.6 | −1.2 | 3.12 |
| 5 | 1 | 0 | 0.4 | −0.2 | −0.08 |

The mean of A is 0.6% and the mean of B is 0.2%. On four of the five days, both deviations have the same sign. Because of this, four products are positive. Only day 5 gives a small negative product.

The products add up to 1.12 + 1.92 + 4.32 + 3.12 − 0.08 = 10.4. Divide by 4, one less than the 5 days. pandas makes the same choice when it computes a variance. So 10.4 / 4 = 2.6. The covariance of A and B is 2.6, a positive number. So A and B move together.

pandas gives the same number:

```python
import pandas as pd

r = pd.DataFrame({"A": [2.0, -1.0, 3.0, -2.0, 1.0],
                  "B": [1.0, -1.0, 2.0, -1.0, 0.0]})  # daily returns in %
print(r["A"].cov(r["B"]))   # 2.6
print(r.cov())              # the covariance of every pair
```

`r.cov()` prints a small table. Its diagonal holds A with A, which is 4.3, the variance of A. Covariance of a series with itself is its variance.

Now flip B's signs, so B falls whenever A rises. Every product changes sign, and the covariance becomes −2.6.

> **Key idea:** Covariance is the average of the products of two series' deviations from their means: positive when they move in the same direction, negative when they move in opposite directions.

The unit is awkward. With returns in percent, the covariance is in "percent squared". Write the same returns as decimals (0.02 instead of 2%), and the covariance becomes 0.00026. The co-movement did not change, but the number shrank by 10,000 times.

## What you have now

Covariance builds on the mean and variance from standard deviation. It tells you the direction two returns move in together. Its size, though, depends on the units and on how much each stock swings. So how do you compare two pairs of stocks, one calm and one wild, on the same scale?
