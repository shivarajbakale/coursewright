# Delta: how much an option moves per $1 of stock

You can now price the call at $10.45 with the stock at $100. A second later the stock trades at $101. You do not want to rerun the whole formula in your head each time. How much does the call's value change for each $1 the stock moves?

## A rate of change, like speed

Think of the speedometer in a car. It tells you how many kilometres you cover per hour at this moment, not over the whole trip. Here the distance stands for the option's value, and time stands for the stock price. The picture stops holding on one point. A car's speed changes because the driver presses a pedal. The option's rate changes on its own as the stock price moves.

**Delta** is the change in an option's value for a small change in the stock price, per $1. A delta of 0.6368 means the option gains about $0.64 when the stock rises $1. It loses about $0.64 when the stock falls $1.

## Finding delta two ways

The first way needs no new formula. Price the call with the stock $1 higher and $1 lower, and take half the difference:

1. With the stock at $101, the call is worth $11.09671.
2. With the stock at $99, the call is worth $9.82322.
3. The change over $2 is 11.09671 − 9.82322 = 1.27349, so the bump estimate is 1.27349 / 2 = 0.6367.

The second way is exact. For a call, delta equals N(d1), the same number inside the Black-Scholes formula. In the running example d1 is 0.35, and N(0.35) = 0.6368. As you saw with the formula, S × N(d1) is the share part of the copy. So delta is also the number of shares in the copy: 0.6368 shares per call.

For a put, delta is N(d1) − 1, which is always negative. The put on the same stock has delta 0.6368 − 1 = −0.3632. A put gains when the stock falls, so its value moves against the stock.

```python
import numpy as np
from scipy.stats import norm
from bs import black_scholes                   # the function from the last lesson, saved in bs.py

def delta(S, K, T, r, sigma, kind="call"):
    d1 = (np.log(S / K) + (r + sigma**2 / 2) * T) / (sigma * np.sqrt(T))
    return norm.cdf(d1) if kind == "call" else norm.cdf(d1) - 1

up, down = black_scholes(101, 100, 1, 0.05, 0.2), black_scholes(99, 100, 1, 0.05, 0.2)
print("bump estimate:", round((up - down) / 2, 4))
for S in (80, 90, 100, 110, 120):
    print(S, round(delta(S, 100, 1, 0.05, 0.2), 4), round(delta(S, 100, 1, 0.05, 0.2, "put"), 4))
```

```
bump estimate: 0.6367
80 0.2219 -0.7781
90 0.4298 -0.5702
100 0.6368 -0.3632
110 0.7958 -0.2042
120 0.8965 -0.1035
```

The bump estimate, 0.6367, differs from 0.6368 only in the last digit. That gap is the error of using a $1 step instead of a tiny one.

## Delta rises with the stock price

Read the call column from top to bottom. Delta rises as the stock rises:

1. At $80 the call is far below the strike, and delta is 0.2219. A $1 move changes little, because the call will probably pay nothing.
2. At $100 delta is 0.6368.
3. At $120 delta is 0.8965. The call will almost surely pay, so it moves nearly like one share.

A call's delta always lies between 0 and 1. A put's delta always lies between −1 and 0. This matters for the copy of the option. When the stock moves, delta moves, so the copy needs a new number of shares.

```inkling
title "Call delta rises with the stock"
layout timeline
- 80: Stock $80, delta 0.22
- 90: Stock $90, delta 0.43
- 100: Stock $100, delta 0.64
- 110: Stock $110, delta 0.80
- 120: Stock $120, delta 0.90
span 80..90 "moves less than a share"
span 110..120 "moves almost like a share"
steps auto
```

Delta is one of the **Greeks**. The Greeks are the rates at which an option's value changes when one input changes and the others stay fixed. Most are named after Greek letters, and each measures one input.

> **Key idea:** Delta is the change in an option's value per $1 change in the stock price, equal to N(d1) for a call, and it rises from 0 toward 1 as the stock price rises.

## What you have now

Delta tells you how many shares behave like one option right now. An option seller faces losses when the stock moves. Could the seller hold delta shares to cancel that risk, and what would it cost to keep the number right?
