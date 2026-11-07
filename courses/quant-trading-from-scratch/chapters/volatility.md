# Volatility: how much returns swing from day to day

With the standard deviation you can measure how widely any list of numbers spreads. Now apply it to the list that matters here: a share's daily returns. Two shares can start at the same price and end at the same price. Why would you call one of them riskier?

## A boat on the water

Picture two boats crossing the same bay. Both leave the same dock and arrive at the same pier. One crosses on flat water. The other rocks hard the whole way. The trip is the same, but the second one is harder to sit through. If you had to get off halfway, you might be far below where you started.

In this picture, the dock and the pier stand for the first and last price. The rocking stands for the size of the daily returns. The picture stops holding in one place. A passenger dislikes every lurch, up or down. A share owner is glad of a rise. The measure you are about to meet still counts a big rise as risk, the same as a big fall.

## Two shares, same start and end

Here are 6 made-up closing prices for two shares. The close is the last price of each day's price bar.

- Calm share: 100, 101, 100.5, 101.5, 101, 102.
- Jumpy share: 100, 104, 98, 103, 97, 102.

Both start at 100 and end at 102, a return of 2% over the 5 days. Now follow the daily returns:

1. Turn the 6 closes into 5 daily returns. For the calm share the first one is 101 / 100 − 1 = 0.01, which is 1%.
2. For the jumpy share the first return is 104 / 100 − 1 = 0.04, which is 4%. The second is 98 / 104 − 1, which is −5.77%.
3. Take the standard deviation of each list of 5 returns.

The code does all three steps with pandas:

```python
import pandas as pd

calm = pd.Series([100, 101, 100.5, 101.5, 101, 102])
jumpy = pd.Series([100, 104, 98, 103, 97, 102])

for name, close in (("calm", calm), ("jumpy", jumpy)):
    returns = close.pct_change().dropna() * 100   # daily returns in %
    print(name, returns.round(2).tolist())
    print("  mean", round(returns.mean(), 2), "volatility", round(returns.std(), 2))
```

```
calm [1.0, -0.5, 1.0, -0.49, 0.99]
  mean 0.4 volatility 0.82
jumpy [4.0, -5.77, 5.1, -5.83, 5.15]
  mean 0.53 volatility 5.8
```

The method `pct_change()` divides each close by the one before and subtracts 1. The method `dropna()` removes the first row, which has no earlier close. The pandas `std()` divides by one less than the count, as you saw with the standard deviation.

Read the result. On a typical day, the calm share's return sits about 0.82 percentage points from its mean. The jumpy share's return sits about 5.8 percentage points away. That is about 7 times as wide. A **percentage point** is the plain difference between two percentages: from 1% to 3% is 2 percentage points.

Look also at the means. The jumpy share has the higher mean daily return, 0.53% against 0.4%, yet both end at 102. As you saw with compounding, a fall needs a bigger rise to recover. Because of this, big swings eat into growth, and the jumpy share needs a higher mean only to keep up.

```inkling
title "What volatility measures"
layout mindmap
- Volatility
  - Spread of daily returns
  - Counts rises and falls
  - Percent per period
  - Ignores the order of days
  - Measured on past days
step 1: volatility "Volatility is one number about one share"
step 2: spread-of-daily-returns "It is the standard deviation of its returns"
step 3: counts-rises-and-falls "A big rise counts as much as a big fall"
step 4: percent-per-period "It is a percentage, per period"
step 5: ignores-the-order-of-days, measured-on-past-days "It says nothing about order, and only describes the past"
circle volatility
```

## Name it

**Volatility** is the standard deviation of a share's returns over a period, here daily returns. It is the standard measure of risk: how far a typical day's return lands from the average day.

> **Key idea:** Volatility is the standard deviation of returns, so a share with volatility 5.8% a day swings about 7 times as widely as one with 0.82%.

Two limits matter. Volatility uses the past days you measured, and it can change next month. It also tells you the size of the swings, not their direction.

## What you have now

You can measure a share's risk as the standard deviation of its daily returns. Your measure is per day, but people compare investments per year. Can you multiply a daily volatility by the number of days in a year?
