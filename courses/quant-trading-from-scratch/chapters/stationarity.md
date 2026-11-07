# Stationarity: a series that keeps returning to the same level

Correlation told you whether two stocks' daily returns agree. It did not tell you whether a price, or a gap between two prices, comes back to where it was. A mean reversion strategy needs exactly that. It bets that a value far from its usual level will move back. When is that bet reasonable, and how do you test for it?

## A ball on a table and a ball in a bowl

Put a ball on a flat table and tap it in a random direction once a second. Nothing pulls it back. After a minute it can be anywhere, and it does not return to the start on purpose. Now put the ball in a round bowl and tap it the same way. Each tap pushes it off centre, and the slope rolls it back. It stays near the bottom.

The ball's position stands for the value of a series on each day. The taps stand for each day's random news. The bowl's slope stands for a force that pulls the value back toward its mean. The picture stops holding in one place: a bowl keeps its shape forever. In a market, the force can weaken or vanish, and past data cannot promise it will last.

The ball on the table is a **random walk**: each day's value is yesterday's value plus a random step. It has no level to return to. Its typical distance from the start grows with the square root of time, as you saw with annualising. After 100 days it is about √100 = 10 times as far as after 1 day.

The ball in the bowl is **stationary**. A stationary series has a mean and a spread that stay the same over time. Because of this, a value far from the mean is likely to move back toward it.

```inkling
title "What a stationary series does"
layout cycle
center "the mean"
above: circle "Above\nthe mean"
down: circle "Pulled\ndown"
below: circle "Below\nthe mean"
up: circle "Pulled\nup"
cycle above, down, below, up
note above "a random walk has no pull: no cycle"
step 1: above "Random news pushes the value above its mean"
step 2: down "The pull moves it back down"
step 3: below "News can push it below the mean"
step 4: up "The pull moves it back up again"
```

## Two series from the same news

The code below builds two series from the same 500 random daily steps:

1. The walk adds each step to yesterday's value.
2. The pulled series keeps 90% of yesterday's distance from 0, then adds the step.

```python
import numpy as np
import pandas as pd
from statsmodels.tsa.stattools import adfuller

rng = np.random.default_rng(7)
steps = rng.normal(0, 1, 500)            # 500 random daily steps

walk = pd.Series(steps).cumsum()          # each day adds a step to yesterday
pulled = pd.Series(0.0, index=range(500))
for t in range(1, 500):                   # each day keeps 90% of the gap from 0
    pulled[t] = 0.9 * pulled[t - 1] + steps[t]

for name, s in [("walk", walk), ("pulled", pulled)]:
    p = adfuller(s)[1]
    print(f"{name:7s} mean first half {s[:250].mean():6.2f}  "
          f"second half {s[250:].mean():6.2f}  p-value {p:.4f}")
```

```
walk    mean first half -20.95  second half -43.35  p-value 0.8279
pulled  mean first half  -1.42  second half  -1.02  p-value 0.0000
```

The walk's mean moved from −20.95 to −43.35 between the two halves. It has no fixed level. The pulled series stayed near 0 in both halves.

`adfuller` runs the **ADF test** (augmented Dickey-Fuller test). It starts from the hypothesis "this series is a random walk". It returns a **p-value**. Suppose the series really were a random walk. The p-value is the chance of a test result at least this far from what a random walk gives. Read it the right way round:

- A small p-value, below 0.05, rejects the random walk. The series looks stationary. The pulled series gives 0.0000, which means below 0.00005.
- A large p-value means the test cannot tell the series from a random walk. The walk gives 0.8279. This does not prove it is a random walk; it means you have no evidence of a pull.

> **Key idea:** A stationary series keeps the same mean and spread over time, so a value far from the mean is likely to move back; the ADF test's small p-value is evidence of this.

Stock prices behave much like a random walk. If you run `adfuller` on a price series, expect a large p-value.

## What you have now

You can now tell a series that returns to a level from one that wanders, and test it with `adfuller`. Prices wander, so a single price is a poor candidate for mean reversion. Could two wandering prices still have a gap between them that does not wander?
