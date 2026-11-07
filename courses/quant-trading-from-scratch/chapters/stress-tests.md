# Stress tests: changing assumptions to find what breaks

A t-statistic of 2 says a result is unlikely to be luck, under the backtest's own assumptions. Those assumptions include a cost per trade, the day each fill happens, and the exact days in your data. Each one is a guess. If a guess is a little wrong, does the edge survive, or does it vanish?

## Shaking the bridge before you drive on it

Picture engineers testing a new bridge. They do not only drive one car across it. They load it with twice the expected weight, add wind, and take out a support to see what happens. The bridge stands for your backtest result. The extra weight stands for higher costs, the wind for worse timing, and the missing support for losing your best days. The picture stops holding in one place: a bridge's loads follow physics, but a market can find a weakness no test of yours imagined.

A stress test reruns the backtest with one assumption made worse, and compares the result with the original. Here are four, each answering a question:

1. **Double the costs.** Is the edge larger than any error in your cost estimate?
2. **Trade one day later.** Does the edge depend on acting at one exact moment?
3. **Remove the best 10 days.** Does the profit come from a handful of lucky days?
4. **Split by year.** Does the strategy earn in most years, or in two good ones?

```inkling
title "One result, four ways to break it"
layout mindmap
- Base Sharpe 0.89
  - Costs doubled: 0.58
  - One day later: -0.68
  - Best 10 days removed: 0.54
  - Each year: 2 of 5 lose
steps auto
```

## Stressing one strategy

The code below makes an illustrative asset whose daily return repeats 8% of the day before. A strategy goes long after an up day and short after a down day. Each flip trades 2 units, and each unit traded costs 0.02%.

```python
import numpy as np, pandas as pd

rng = np.random.default_rng(11)
move = rng.normal(0, 0.01, 1260)                 # 5 illustrative years of daily returns
for t in range(1, len(move)):
    move[t] += 0.08 * move[t - 1]                # each day repeats 8% of yesterday's move
asset = pd.Series(move)

def sharpe(r):
    return r.mean() / r.std() * np.sqrt(252)

def run(delay=1, cost=0.0002):
    position = np.sign(asset).shift(delay)       # long after an up day, short after a down day
    traded = position.diff().abs()               # 2 units each time it flips
    return (position * asset - traded * cost).dropna()

base = run()
print(f"base                 {sharpe(base):5.2f}")
print(f"costs doubled        {sharpe(run(cost=0.0004)):5.2f}")
print(f"trade one day later  {sharpe(run(delay=2)):5.2f}")
print(f"best 10 days removed {sharpe(base.drop(base.nlargest(10).index)):5.2f}")
print("each year:", " ".join(f"{sharpe(y):.2f}" for y in np.array_split(base, 5)))
```

```
base                  0.89
costs doubled         0.58
trade one day later  -0.68
best 10 days removed  0.54
each year: 2.08 -0.21 -0.61 1.18 2.14
```

Read the results one at a time.

1. The base Sharpe ratio is 0.89 over 5 years. Its t-statistic is 0.89 × 2.236 = 1.99, where 2.236 is √5. It sits right at the bar of 2.
2. Doubled costs cut it to 0.58. The strategy trades about 1 unit a day on average, so an error in the cost estimate counts on almost every day.
3. One day late, it turns negative, −0.68. The whole edge lives in the next day's move. A real order that fills a day late destroys it.
4. Without its best 10 days out of 1,258, the Sharpe ratio falls to 0.54. Those 10 days are 0.8% of the days, yet they earn 41% of the total profit.
5. Two of the 5 years lose money. A trader who started in year 2 would have lost money for 2 years in a row.

This strategy has a real edge, because the code built one in. Yet it fails two of the four tests badly. That is the point: a result that passes a t-statistic bar can still break under small, realistic changes.

> **Key idea:** A stress test reruns a backtest with one assumption made worse, such as higher costs, later trades or fewer lucky days, to see how far the result can fall.

## What you have now

You can now test a result's size with the t-statistic and its fragility with stress tests, building on slippage and transaction costs. Each stress test is another variant you ran, and so is each idea you tried before it. As you saw with multiple testing, every extra try makes luck look more like skill. How do you keep count of everything you tried?
