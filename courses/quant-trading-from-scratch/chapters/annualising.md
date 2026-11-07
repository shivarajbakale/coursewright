# Annualising: scaling daily numbers up to a year

You can now measure a share's mean daily return and its daily volatility. But people quote investments per year: "this fund returned 8% last year". To compare your daily numbers with yearly ones, you need to scale them. Does a year's volatility equal a day's volatility times the number of days?

## Steps that partly cancel

Picture a game with a coin. Each flip, you take one step forward for heads and one step back for tails. After 100 flips, how far from the start are you? Not 100 steps. The forward and back steps partly cancel. The standard deviation of where you end up is 10 steps, which is the square root of 100.

In this picture, each flip stands for one day's return, and your final place stands for the year's return. The picture stops holding in two places. First, real daily returns are not all the same size. Second, the rule needs each day to be independent of the one before. Real markets break this rule at times, for example after a crash, when large moves follow large moves.

## The two rules

A year has about 252 **trading days**: the days an exchange is open. For US exchanges, 365 days minus 104 weekend days minus about 9 holidays gives 365 − 104 − 9 = 252. This is the usual convention.

Take a made-up share with a mean daily return of 0.04% and a daily volatility of 1.2%.

1. **The mean scales with time.** Every day adds its mean return, so the year's mean is 0.04% × 252 = 10.08%.
2. **The variance also scales with time.** The daily variance is 1.2 × 1.2 = 1.44, in percent squared. For independent days the variances add, so the year's variance is 1.44 × 252 = 362.88.
3. **So volatility scales with the square root of time.** The year's volatility is the square root of 362.88, which is 19.05%. The same result comes from 1.2% × √252, because √252 = 15.87.

If you multiplied the volatility by 252, you would get 1.2% × 252 = 302.4%. That is wrong by a factor of 15.87, because it ignores how up and down days cancel.

A simulation checks the square-root rule. It makes up 10,000 years of 252 daily returns, each with mean 0.04% and standard deviation 1.2%. Then it adds up the days of each year. As you saw with log returns, adding is exact for log returns. For small daily returns like these, plain returns are close enough.

```python
import numpy as np

rng = np.random.default_rng(0)
# 10,000 made-up years, each of 252 daily returns in %
daily = rng.normal(0.04, 1.2, size=(10_000, 252))

yearly = daily.sum(axis=1)          # add the days of each year
print(round(daily.std(), 2), round(yearly.std(), 2))
print(round(1.2 * np.sqrt(252), 2), round(1.2 * 252, 1))
```

```
1.2 18.92
19.05 302.4
```

The simulated yearly volatility is 18.92%. The square-root rule predicts 19.05%. The gap comes from using 10,000 made-up years instead of an endless number. Multiplying by 252 predicts 302.4%, which is nowhere near.

```inkling
title "Mean and volatility grow at different speeds"
layout compare
columns "Mean return", "Volatility"
row "One day": "0.04%", "1.2%"
row "One month": "0.84%", "5.50%"
row "One year": "10.08%", "19.05%"
row "Grows with": "days", "square root of days"!
step 1: one-day "One day: the numbers you measured"
step 2: one-month "21 days: the mean grows 21 times, volatility only 4.58 times"
step 3: one-year "252 days: the mean grows 252 times, volatility 15.87 times"
step 4: grows-with "The mean scales with time, volatility with its square root"
```

One more detail. The 10.08% is the simple yearly mean. With compounding, a gain of 0.04% each day for 252 days gives a growth factor of 1.0004²⁵² = 1.1060, a gain of 10.60%. People quote the simple version when they annualise a mean, so say which one you use.

## Name it

**Annualising** turns a daily number into a yearly one. Multiply a mean daily return by 252. Multiply a daily volatility by √252, which is about 15.87.

> **Key idea:** Average returns scale with time, and volatility scales with the square root of time, because up and down days partly cancel.

## What you have now

You can turn daily returns and daily volatility into yearly numbers that compare with any quoted figure. Volatility tells you how widely returns swing. It does not tell you how deep a loss you sat through before the price recovered.
