# A benchmark: what doing nothing clever would have earned

You can now describe a result with its return, its volatility and its maximum drawdown. Suppose a strategy gained 8% this year. Is that good? You cannot tell from the 8% alone. You need something to measure it against.

## The main road

Picture a new shortcut to work through side streets. It takes 25 minutes. Is it a good shortcut? Only if the main road takes longer. If the main road takes 20 minutes, your clever route loses 5 minutes every day.

In this picture, your shortcut stands for a trading strategy. The main road stands for the plain choice that needs no cleverness. The picture stops holding in one place. Both roads cost the same to drive. In a market, every trade pays the bid-ask spread, so a strategy that trades often pays far more than one that trades once.

## The plainest choice

The plainest choice for a share is **buy and hold**: buy it once at the start, do nothing, and sell at the end. A strategy that trades one share should beat buying and holding that same share. If it cannot, you would have done better doing nothing.

Here is a made-up example over 5 months. The first list is the share's closing price at each month end. The second is the account value of a strategy that traded the same share, after its costs.

```python
import pandas as pd

close = pd.Series([50, 52, 49, 53, 55, 56])          # made-up month-end closes
strategy = pd.Series([100, 101, 103, 104, 106, 108])  # strategy account value

def total_return(s):
    return s.iloc[-1] / s.iloc[0] - 1

def max_drawdown(s):
    return (s / s.cummax() - 1).min()

for name, s in (("buy and hold", close), ("strategy", strategy)):
    print(name, round(total_return(s) * 100, 2), round(max_drawdown(s) * 100, 2))
```

```
buy and hold 12.0 -5.77
strategy 8.0 0.0
```

Walk through it:

1. Buy and hold returns 56 / 50 − 1 = 0.12, a gain of 12%.
2. The strategy returns 108 / 100 − 1 = 0.08, a gain of 8%.
3. On return, the strategy is 4 percentage points behind buy and hold.
4. On drawdown, the strategy is ahead. Buy and hold fell from 52 to 49, a drawdown of −5.77%. The strategy never fell.

So the 8% that looked fine on its own is 4 points worse than doing nothing. The strategy did take less risk on the way. Whether less risk is worth 4 points of return is a fair question, and you need a way to weigh the two together.

```inkling
title "Did the strategy beat doing nothing"
layout down
strat: box "Strategy\n+8% after costs"
hold: box "Buy and hold\n+12%"
cmp: diamond "Higher return\nfor the risk?"
yes: round "Keep it" green
no: round "Holding was better" red
strat -> cmp
hold -> cmp
cmp -> yes : "yes"
cmp -> no : "no"
note hold "pays the spread about once"
step 1: strat "Start from the strategy's return after costs"
step 2: hold "Put next to it what buying and holding earned"
step 3: cmp "Compare return and risk together"
step 4: yes, no "Only a strategy that wins after costs earns its place"
circle cmp
```

## Costs make the gap wider

Compare costs with the bid-ask spread in mind. Say a round trip, one buy and one sell, costs 0.05% of the price in spread. A strategy that makes 40 round trips keeps a growth factor of 0.9995⁴⁰ = 0.9802 from its costs. That is a loss of 1.98% a year before it earns anything. Buy and hold makes one round trip and loses 0.05%. Because of this, always compare a strategy after its costs with buy and hold after its costs.

## Name it

A **benchmark** is the result you compare a strategy against. For a strategy on one share, the usual benchmark is buy and hold on that same share, over the same dates. Change the dates and the benchmark changes too, so always use the same dates for both.

> **Key idea:** A strategy is only worth running if it beats buying and holding the same thing, over the same dates, after costs.

## What you have now

You can judge a return against what doing nothing clever would have earned. Buy and hold still takes the risk of owning the share. What does money earn if you take almost no risk at all?
