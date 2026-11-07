# Signal decay: how fast a prediction stops being useful

Sizing from probability tells you how much to hold when the model speaks. It assumes you trade at once. In practice, you trade the next morning, or you hold a position for a week before you check again. Is a prediction made today still worth anything in 5 days?

## News goes stale

Think of a tip that a shop has a sale. If you go today, the shelves are full. Tomorrow, other shoppers have taken a part of the stock. After a week, the sale is over. The tip had value, but the value fell every day it waited.

Here, the tip is your signal and the shoppers are other traders who act on the same information. The picture stops holding in one place. A sale ends on a known date. A signal fades at a rate nobody tells you, so you have to measure it.

## Measuring the fade

To measure how useful a signal is, compare it with the returns that follow. As you saw with correlation, one number between −1 and 1 says how two series move together. Here you correlate ranks instead of raw values. A **rank correlation** replaces each number by its position in order (1st, 2nd, 3rd) and then correlates the positions. Because of this, one extreme day cannot dominate the result.

You repeat the measurement for the return 1 day after the signal, then 2 days after, and so on. This example uses a made-up signal that keeps 70% of its strength from one day to the next. The numbers are chosen so the pattern is easy to see.

```python
import numpy as np
import pandas as pd

rng = np.random.default_rng(1)
n = 20000                                   # made-up days
signal = np.zeros(n)
for t in range(1, n):                       # each day keeps 70% of yesterday's signal
    signal[t] = 0.7 * signal[t - 1] + rng.normal()
signal = pd.Series(signal)
ret = 0.002 * signal.shift(1) + 0.02 * pd.Series(rng.normal(size=n))  # day t+1 return

for h in [1, 2, 3, 5, 10]:
    ic = signal.corr(ret.shift(-h), method="spearman")   # signal on day t, return on day t+h
    print(f"day {h:2d}: IC = {ic:.3f}")
```

```
day  1: IC = 0.130
day  2: IC = 0.092
day  3: IC = 0.065
day  5: IC = 0.035
day 10: IC = 0.007
```

Read it in order:

1. On day 1, the rank correlation is 0.130. Higher signals come before higher returns.
2. On day 2, it is 0.092. That is 0.092 / 0.130 = 0.71 of the first day's value.
3. On day 3, it is 0.065: half of day 1.
4. By day 10, it is 0.007, which is close to zero. The signal says nothing about that day.

```inkling
title "One signal, measured on later days"
layout timeline
- 1: Day 1, IC 0.130
- 2: Day 2, IC 0.092
- 3: Day 3, IC 0.065
- 5: Day 5, IC 0.035
- 10: Day 10, IC 0.007
span 1..3 "most of the value"
step 1: 1 "The day after the signal carries the most information"
step 2: 2, 3 "Each day keeps about 70% of the day before"
step 3: 5, 10 "By day 10 almost nothing is left"
```

## Decay and costs pull in opposite directions

The decay sets how often you must trade. Here, trading one day late keeps 71% of the edge. If you rebalance once every 10 days, the last days of each holding period carry almost no edge.

Trading every day has its own price. Each trade pays transaction costs, and daily trading means high turnover. So a fast-decaying signal must earn more per day than its costs. A slow-decaying signal can be traded less often, and it pays less in costs. You choose the holding period where the edge that is left still beats the cost of the trades.

## Name it

The **information coefficient**, or IC, is the rank correlation between a signal on one day and the return that follows. Signal decay is the fall of the IC as the gap between signal and return grows.

> **Key idea:** Measure the information coefficient at each later day; how fast it falls tells you how quickly you must trade, and the costs tell you whether that speed pays.

## What you have now

You can now build point-in-time features, fix labels, train a classification model, test it with purged cross-validation, size from its probabilities and measure how fast its edge fades. Together with transaction costs, signal decay decides whether a model's prediction can become profitable trades.
