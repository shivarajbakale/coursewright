# Momentum: recent winners keep winning for a while

A factor portfolio needs a score to sort stocks by. One well-studied score asks how much each stock rose over the past year. If last year's winners keep beating last year's losers, a factor portfolio on that score earns the gap. What does the research find, and how exactly should you measure "rose most"?

## A ball that keeps rolling

Picture a ball rolling across a floor. A ball moving fast now is still moving a moment later, though it slows down. The ball stands for a stock's price, and its speed over the past year stands for the score. The picture stops holding in two places. First, a price has no physics behind it: the effect is a pattern measured in past data, and it can weaken or reverse. Second, the most recent push behaves differently, as the next section shows.

## What the research found

Jegadeesh and Titman (1993) studied US stocks. They sorted stocks by their return over the past 3 to 12 months. Over the next 3 to 12 months, the past winners did better than the past losers, on average. Asness, Moskowitz and Pedersen (2013) later found the same pattern in other countries and other kinds of assets.

There is a twist at the shortest scale. Jegadeesh (1990) and Lehmann (1990) found that returns over the most recent month or week tend to partly reverse. So a score that includes last month mixes 2 effects that point in opposite directions. Because of this, the classic score leaves out the latest month. It measures the return from 12 months ago to 1 month ago.

Momentum also has a known weakness. Daniel and Moskowitz (2016) documented rare, very large losses, which they named momentum crashes. These came after market falls, when the market rebounded fast and the past losers rose most.

## Four stocks, measured two ways

Here are 13 month-end prices for 4 stocks, all illustrative. Stock C was flat for 11 months, then jumped from 41 to 48 in the latest month. Stock D rose all year, then fell from 42 to 36 in the latest month.

```python
import pandas as pd
months = pd.date_range("2023-01-31", periods=13, freq="ME")
prices = pd.DataFrame({
    "A": [50, 51, 52, 54, 55, 56, 58, 59, 61, 62, 64, 65, 66],
    "B": [80, 78, 77, 75, 74, 72, 71, 70, 68, 67, 66, 64, 63],
    "C": [40, 40, 41, 40, 41, 40, 41, 41, 40, 41, 40, 41, 48],
    "D": [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42, 36],
}, index=months, dtype=float)
mom = prices.shift(1) / prices.shift(12) - 1     # 12 months back to 1 month back
last_12 = prices / prices.shift(12) - 1          # includes the latest month
print(pd.DataFrame({"12-1 momentum": mom.iloc[-1], "plain 12-month": last_12.iloc[-1]}).round(3))
```

```
   12-1 momentum  plain 12-month
A          0.300           0.320
B         -0.200          -0.213
C          0.025           0.200
D          0.400           0.200
```

Walk through the last row:

1. `prices.shift(12)` gives the price 12 months back, and `prices.shift(1)` the price 1 month back.
2. For D, the score is 42 / 30 - 1 = 0.40, a 40% rise. D ranks first.
3. For C, the score is 41 / 40 - 1 = 0.025, a 2.5% rise. C ranks third, ahead of only B, which fell 20%.
4. The plain 12-month return gives C 48 / 40 - 1 = 0.20 and D the same 0.20. The latest month's jump lifts C into a tie for first place.

The two scores disagree about C and D only because of one month, which the classic score ignores on purpose.

```inkling
title "The 12-1 momentum window"
layout timeline
- Year ago: lookback starts
- Month ago: lookback ends
- Today: latest month skipped
- Next month: hold the groups
span year-ago..month-ago "11 months of returns"
highlight today
steps auto
```

As with look-ahead bias, the order matters. You compute the scores at the end of this month, from prices already known. Then you form the groups and hold them during the next month.

## Naming it

**Momentum** is a pattern in past returns. Assets with the highest returns over the past 3 to 12 months kept beating the lowest for 3 to 12 more months, on average. The **lookback** is the window of past data a score reads, here 12 months. The **skip month** is the latest month, left out of the lookback because short-term returns tend to reverse within 1 month.

> **Key idea:** The classic momentum score is the return from 12 months ago to 1 month ago; long the top group and short the bottom group on that score is a momentum factor portfolio.

## What you have now

Momentum is one factor, built from cross-sectional ranking and a factor portfolio. A real portfolio can hold 2, 3 or more factors and the market at once. Each one has its own expected return and volatility, and they move together by different amounts. How much money should go into each?
