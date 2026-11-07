# The Sharpe ratio: excess return for each unit of volatility

You can now split a return into the risk-free rate and the excess return earned by taking risk. You can also measure that risk as volatility. Strategy A earns more than strategy B, but it also swings much more. Which one is better? You need one number that weighs the reward against the risk.

## Distance for each litre

Picture two cars. One drives 600 km on a full tank of 50 litres. The other drives 400 km on a tank of 25 litres. The first goes further, but the second gets more from each litre: 400 / 25 = 16 km per litre against 600 / 50 = 12. To compare cars of different sizes, you divide the distance by the fuel used.

In this picture, distance stands for excess return and fuel stands for volatility. The picture stops holding in two places. A car's fuel use is steady and well known. A strategy's volatility is measured on past days and can change. Also, a car really burns fuel, while volatility counts rises as well as falls.

## Two strategies

Take two made-up strategies over the same year, with a risk-free rate of 4%:

1. Strategy A returns 12% with a yearly volatility of 20%. Its excess return is 12% − 4% = 8%. Divide by volatility: 8 / 20 = 0.4.
2. Strategy B returns 8% with a yearly volatility of 8%. Its excess return is 8% − 4% = 4%. Divide by volatility: 4 / 8 = 0.5.

Strategy B earns 0.5 points of excess return for each point of volatility. Strategy A earns only 0.4. So B uses its risk better, even though A earned more in total.

```inkling
title "Reward for each unit of risk"
layout compare
columns "Strategy A", "Strategy B"
row "Return": "12%", "8%"
row "Excess return": "8%", "4%"
row "Volatility": "20%", "8%"
row "Excess per volatility": "0.4", "0.5"!
step 1: return "A earns more in total"
step 2: excess-return "Subtract the 4% risk-free rate from each"
step 3: volatility "A also swings far more"
step 4: excess-per-volatility "Divide: B earns more for each unit of risk"
```

## From daily returns

With daily returns, you compute the same ratio in three steps:

1. Subtract the daily risk-free rate from each day's return.
2. Divide the mean of these daily excess returns by their standard deviation.
3. Multiply by √252, which is 15.87.

Why √252? As you saw with annualising, the yearly mean is the daily mean times 252. The yearly volatility is the daily volatility times √252. Divide one by the other and the result is the daily ratio times 252 / √252, which equals √252.

```python
import numpy as np
import pandas as pd

daily = pd.Series([0.8, -0.7, 0.3, 1.1, -1.2, 0.4, -0.3, 0.6, -0.6, 0.1]) / 100
excess = daily - 0.04 / 252                  # illustrative 4% risk-free rate

sharpe = excess.mean() / excess.std() * np.sqrt(252)

downside = np.sqrt((excess.clip(upper=0) ** 2).mean())
sortino = excess.mean() / downside * np.sqrt(252)

print(round(excess.mean() * 252 * 100, 2), round(excess.std() * np.sqrt(252) * 100, 2))
print(round(sharpe, 2), round(sortino, 2))
```

```
8.6 11.62
0.74 1.09
```

The yearly excess return is 8.6% and the yearly volatility is 11.62%. Their ratio is 8.6 / 11.62 = 0.74. Ten days of data is far too few to trust this number. It only shows the steps.

## Counting only the bad days

The ratio above treats a big rise as risk, the same as a big fall. The **Sortino ratio** changes only the bottom of the fraction. It replaces the volatility with the downside deviation. To get the downside deviation, set every positive excess return to 0, square what is left, take the mean, and take the square root. In the code, `clip(upper=0)` does the first step. Here the Sortino ratio is 1.09, higher than 0.74, because the large up days no longer count against the strategy.

## Name it

The **Sharpe ratio** is the yearly excess return divided by the yearly volatility. It tells you how much reward above the risk-free rate a strategy earned for each unit of risk. A higher number is better, and a negative number means the strategy did worse than safe bills.

> **Key idea:** The Sharpe ratio divides excess return by volatility, so strategies that take very different amounts of risk can be compared on one scale.

## What you have now

You can rank strategies by return per unit of risk, using the risk-free rate, volatility and annualising together. A high ratio over a few months can still be luck. What makes a strategy earn a good ratio again and again, year after year?
