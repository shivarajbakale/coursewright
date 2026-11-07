# Drawdown: the fall from a peak to a later low

Volatility tells you how widely returns swing on a typical day. It does not tell you the worst stretch you lived through. An account can end the year up 8% and still have lost a quarter of its value along the way. How do you measure that worst stretch?

## Height below the highest point so far

Picture a hike along a ridge. At every moment you can ask: how far am I below the highest point I have reached so far? At a new summit the answer is zero. After a long descent into a valley, the answer is large. The deepest valley on the whole walk is the hike's worst moment.

In this picture, your height stands for the value of your account. The highest point so far stands for the account's best value up to that day. The picture stops holding in one place. A hiker can see the next summit on the map. An account cannot see the future, so on the way down you do not know if it will ever climb back.

## A small account, step by step

An **equity curve** is the value of an account at each point in time, drawn as a line. Here is a made-up one over 7 days: 100, 110, 99, 105, 120, 90, 108.

1. Track the peak: the highest value so far. It runs 100, 110, 110, 110, 120, 120, 120.
2. Divide each value by the peak so far, and subtract 1. This is the drawdown on that day.
3. On day 2, 99 / 110 − 1 = −0.10, a drawdown of −10%.
4. On day 5, 90 / 120 − 1 = −0.25, a drawdown of −25%.
5. Take the most negative drawdown of all days. Here it is −25%.

The **maximum drawdown** is that most negative value: the deepest fall from a peak to a later low. For this account it is −25%, from 120 down to 90.

```inkling
title "The deepest fall from a peak"
layout timeline
- 0: Start at 100
- 1: Peak at 110
- 2: Down to 99
- 4: New peak at 120
- 5: Low of 90
- 6: Back to 108
span 4..5 "maximum drawdown -25%"
step 1: 0, 1 "The account starts at 100 and reaches a peak of 110"
step 2: 2 "It falls to 99, a drawdown of -10%"
step 3: 4 "A new peak at 120 resets the drawdown to 0"
step 4: 5 "The fall to 90 is the deepest, -25%"
step 5: 6 "At 108 it is still 10% below its peak"
circle 5
```

In pandas, `cummax()` gives the highest value so far, which does most of the work:

```python
import pandas as pd

equity = pd.Series([100, 110, 99, 105, 120, 90, 108])   # account value each day

peak = equity.cummax()                  # highest value so far
drawdown = equity / peak - 1            # fall from that peak

print(peak.tolist())
print((drawdown * 100).round(2).tolist())
print(round(drawdown.min() * 100, 2))
```

```
[100, 110, 110, 110, 120, 120, 120]
[0.0, 0.0, -10.0, -4.55, 0.0, -25.0, -10.0]
-25.0
```

Over the whole week, the account went from 100 to 108, a gain of 8%. Its maximum drawdown was −25%. Both numbers are true, and they describe different experiences.

## Why depth matters more than it looks

As you saw with compounding, a loss needs a bigger gain to recover. From the low of 90, getting back to 120 needs 120 / 90 − 1 = 0.333, a gain of 33.3%. The deeper the fall, the faster this grows:

- A −10% drawdown needs a gain of 11.1% to recover.
- A −25% drawdown needs a gain of 33.3%.
- A −50% drawdown needs a gain of 100%.

A deep drawdown also tests the person running the account. A person who watches the account fall 25% may stop the strategy before it recovers. Because of this, a strategy you cannot sit through is a strategy you will not keep.

## Name it

The **drawdown** on a day is how far the account sits below its highest value so far, as a fraction of that peak. It is 0 at a new high and below 0 whenever the account is under its peak.

> **Key idea:** Drawdown measures the fall from the best value so far, and the maximum drawdown is the worst such fall over the whole equity curve.

## What you have now

You have three ways to describe a result: its return, its volatility, and its maximum drawdown. Each is a number about one account. None of them tells you whether the result was good. A gain of 8% could be excellent or poor. What should you compare it with?
