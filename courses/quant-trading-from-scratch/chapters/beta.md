# Beta: how much an asset moves with the market

Linear regression gives you a slope: how much y moves when x moves by 1. Now put the whole market on the x axis and one stock on the y axis. On a day when the market falls 2%, how much should you expect this stock to fall? And when the stock made money, how much of that was the market and how much was the stock itself?

## A boat on the tide

Picture a boat in a harbour. When the tide rises, every boat rises. The tide stands for the market: the move that lifts or sinks most stocks on the same day. One boat swings twice as far as the tide. Another swings half as far. On top of the tide, each boat also bobs on its own small waves. Those waves stand for news about that one company.

The picture stops holding in one place. A boat follows the tide exactly, every time. A stock follows the market only on average, so its link to the market must be measured from many days.

## Six days, worked through

For the market, use a benchmark: the daily return of an index that holds a broad basket of shares. Here are 6 illustrative days, in percent.

```python
import pandas as pd
import statsmodels.api as sm
market = pd.Series([1.0, -0.5, 2.0, -1.0, 0.5, -1.5])  # daily returns, %
stock = pd.Series([1.6, -0.6, 3.1, -1.4, 1.0, -2.1])   # daily returns, %
model = sm.OLS(stock, sm.add_constant(market)).fit()
alpha, beta = model.params
print(f"beta {beta:.2f}, alpha {alpha:.2f}% a day")
```

```
beta 1.49, alpha 0.14% a day
```

`sm.OLS` runs the least-squares fit from linear regression. `add_constant` asks it to fit an intercept too. Walk through what the numbers mean:

1. The covariance of the two series is 2.60 and the variance of the market is 1.74. The slope is 2.60 / 1.74 = 1.49.
2. So when the market moves 1%, this stock moves 1.49% on average, in the same direction.
3. The intercept is 0.14% a day. It is what the stock earns, on average, on a day the market is flat.
4. On a day the market rises 1%, the line forecasts 0.14 + 1.49 × 1 = 1.63% for the stock.
5. On a day the market falls 2%, the market part of the forecast is 1.49 × -2 = -2.98%.

```inkling
title "Splitting one stock's return"
layout mindmap
- Daily stock return
  - Market part
  - Alpha
  - Residual
note market-part "beta × market return"
note alpha "the same every day"
note residual "the company's own news"
highlight market-part
step 1: daily-stock-return "One day's return for the stock"
step 2: market-part "Beta times the market's move"
step 3: alpha "A constant left over on average"
step 4: residual "What is specific to that day"
```

Treat these numbers with care. Six days is far too few. The standard error of each estimate is large, so the true beta could be well away from 1.49. In practice, people fit beta on a year or more of daily returns, which is 252 trading days or more. Beta also changes over time as a company changes.

There is one more detail. Strictly, both series should be excess returns: the return minus the risk-free rate. At a risk-free rate of 4% a year, that is 4% / 252 = 0.016% a day. For a daily beta, that difference is small.

## Naming it

**Beta** is the slope of an asset's returns regressed on the market's returns. It measures the market risk the asset carries. A beta of 1 moves with the market one for one. A beta of 1.49 swings harder than the market. A beta of 0.5 swings half as much. A beta near 0 hardly follows the market at all.

**Alpha** is the intercept of that regression: the average return left over after you remove the market part. Positive alpha is what an investor hopes for, because it is return the market did not provide. The residuals are each day's own news, and they average to 0.

> **Key idea:** Beta is the slope of a stock's returns against the market's returns; it splits each return into a market part, beta times the market's move, plus alpha and the residual.

## What you have now

You can measure how much of a stock's movement is the market and how much is its own. This leads to a practical question. If you own a stock with beta 1.49 and you only want its own part, can you hold something else that cancels the market part?
