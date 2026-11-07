# The normal distribution: the bell curve of many small effects

To price an option, you need to know how likely each final stock price is. A stock's yearly log return is the sum of about 252 daily log returns. Each day adds its own small push up or down. What shape does a sum of hundreds of small random pushes take?

## Many small pushes make a bell

Think of a crowded corridor where each person bumps you a little left or right. After 252 bumps, you are rarely far from where you started, because most bumps cancel. Ending far to one side needs most bumps to go the same way, and that is rare. The bumps stand for daily returns, and your final place stands for the yearly return. The picture stops holding when the bumps are not independent, for example when a crowd surges together.

Plot where 10,000 such walkers end, and the counts form a bell shape. This shape is the normal distribution. Two numbers fix it:

1. The mean sets where the centre of the bell is.
2. The standard deviation sets how wide the bell is.

For any normal distribution, 68.27% of outcomes fall within 1 standard deviation of the mean. 95.45% fall within 2 standard deviations. These shares are the same whatever the mean and the standard deviation are.

## Checking it with 10,000 simulated years

The code below builds yearly log returns from daily moves that are not bell-shaped at all. Each day's move is spread evenly between −2.18% and +2.18%. That spread gives each day a standard deviation of 1.26%. Over 252 days, this is a volatility of 20% a year, as you saw with annualising.

```python
import numpy as np
from scipy.stats import norm

rng = np.random.default_rng(0)
a = 0.20 / np.sqrt(252) * np.sqrt(3)           # daily moves spread evenly in [-a, a]
days = rng.uniform(-a, a, size=(10_000, 252))  # no day looks like a bell
years = days.sum(axis=1)                       # 10,000 yearly log returns

print("mean", round(years.mean(), 4), "sd", round(years.std(), 4))
print("within 1 sd:", np.mean(np.abs(years) <= 0.20), round(norm.cdf(1) - norm.cdf(-1), 4))
print("below -20%:", np.mean(years < -0.20), round(norm.cdf(-1), 4))
```

```
mean 0.0013 sd 0.2008
within 1 sd: 0.6836 0.6827
below -20%: 0.1564 0.1587
```

Read the output line by line:

1. The 10,000 yearly returns have a mean near 0 and a standard deviation of 20.08%.
2. 68.36% of the years land within 20% of the mean. The normal distribution predicts 68.27%.
3. 15.64% of the years lose more than 20%. The normal distribution predicts 15.87%.

The days were flat-shaped, yet their sum is bell-shaped. This result holds for sums of many small independent effects, whatever the shape of each one. That is why the normal distribution appears in so many places.

```inkling
title "From small pushes to a bell"
layout down
day: box "One day's move\nflat, up to 2.18%"
sum: box "Add 252 days"
year: box "One yearly log return"
bell: cloud "10,000 years form a bell" yellow
fix: sticky "Mean and standard\ndeviation fix it"
day -> sum -> year -> bell
bell -> fix
circle bell
step 1: day "Each day adds a small random push"
step 2: sum, year "252 pushes add up to one year's log return"
step 3: bell "Many years together form the bell shape"
step 4: fix "Two numbers describe the whole bell"
```

## Density and the share below a point

The height of the bell at a point is the **probability density**. It is not a probability itself. The area under the curve between two points is the probability of landing between them. The total area is 1.

In Python, `norm.pdf(x)` gives the density at x, and `norm.cdf(x)` gives the area to the left of x. Formulas write this area as N(x): the probability that a standard normal outcome is below x. A standard normal has mean 0 and standard deviation 1. For example, N(−1) = 0.1587, the chance of ending more than 1 standard deviation below the mean.

The normal distribution fits log returns better than plain returns. A log return can go far below zero, but the price it implies never does. A plain return below −100% is impossible, and a bell would allow it.

> **Key idea:** The normal distribution is the bell shape that sums of many small independent effects take, fixed by a mean and a standard deviation, and N(x) gives the probability of an outcome below x.

## What you have now

You can now describe a year of log returns as a bell with a mean and a volatility. You can read off the chance of any range with N(x). Next comes the price of an option itself. Is there a way to price it without guessing what investors expect the stock to do?
