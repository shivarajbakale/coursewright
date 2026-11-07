# Is the Sharpe real: how many trades a result needs

Your sizing and risk limits all assume the edge is real. The evidence for that edge is one number from a backtest, for example a Sharpe ratio of 1. But a backtest is one run of history. With a different history, the same strategy would show a different Sharpe ratio. How far could that number be from the truth?

## One survey, many possible answers

Picture asking 20 people in a street whether they like a new film. If 15 say yes, you guess 75% of everyone likes it. Ask another 20 people and you might get 11. The 20 people stand for the days in your backtest, and the share who say yes stands for the Sharpe ratio. Asking more people makes the guess steadier. The picture stops holding in one place. Market days can depend on each other, and then each day tells you less.

You can measure that spread directly. Make a strategy whose true Sharpe ratio is exactly 1 a year. Run 10,000 different one-year backtests of it, and look at what each one reports:

```python
import numpy as np

rng = np.random.default_rng(3)
true_sharpe = 1.0                                      # per year
daily = rng.normal(true_sharpe * 0.10 / 252, 0.10 / np.sqrt(252), size=(10_000, 252))
est = daily.mean(axis=1) / daily.std(axis=1, ddof=1) * np.sqrt(252)
print(f"spread of estimates: {est.std():.2f}")
print(f"share below 0: {(est < 0).mean():.1%}, share above 2: {(est > 2).mean():.1%}")
```

```
spread of estimates: 1.01
share below 0: 16.6%, share above 2: 15.7%
```

The estimates swing by about 1.0. In 16.6% of the years the strategy looked like a loser. In 15.7% it looked twice as good as it is.

## Putting a number on the error

The standard error of an estimate is the standard deviation of that estimate across all the samples you could have drawn. For a Sharpe ratio S, measured per period over n periods, it is about √((1 + S² / 2) / n). Andrew Lo published this in 2002. It assumes the periods are independent and free of extreme jumps.

Work it through for one year of daily returns with a yearly Sharpe ratio of 1.

1. The daily Sharpe ratio is 1 divided by √252, the square root of 252 trading days, which is 0.063.
2. The daily standard error is √((1 + 0.063² / 2) / 252) = 0.0630.
3. Annualise it the same way as the Sharpe ratio: 0.0630 × 15.87 = 1.00, where 15.87 is √252.

The formula agrees with the simulation: the error is as large as the Sharpe ratio itself.

The t-statistic is the estimate divided by its standard error. It says how many standard errors the result sits above 0. A strategy with no edge reaches a t-statistic above 2 by luck in about 2.3% of tests, so 2 is a common bar. One year gives 1.0 / 1.00 = 1.0, which fails. The error shrinks with the square root of the length, so 4 years give an error of 0.50 and a t-statistic of 1.0 / 0.50 = 2.0.

```inkling
title "More years, smaller error"
layout timeline
- 1 year: error 1.00, t 1.0
- 2 years: error 0.71, t 1.4
- 4 years: error 0.50, t 2.0
- 10 years: error 0.32, t 3.2
steps auto
```

## Counting trades

The same formula works per trade. Say each trade earns 0.2% on average with a standard deviation of 2%. The Sharpe ratio per trade is 0.2 / 2 = 0.1. After 100 trades the t-statistic is about 1.0. After 400 trades the standard error is √((1 + 0.1² / 2) / 400) = 0.0501, so t = 0.1 / 0.0501 = 2.0.

The trades must be independent. A position held for 30 days is one bet, not 30. And the bar of 2 holds for one test only. As you saw with multiple testing, the best of many variants passes it far more often by luck.

> **Key idea:** A Sharpe ratio has a standard error of about √((1 + S² / 2) / n), so a result is believable only when its t-statistic, the estimate divided by that error, is well above 2.

## What you have now

You can now say how sure a Sharpe ratio is, using the Sharpe ratio, annualising and the square root of the sample size. A Sharpe ratio of 1 needs about 4 years, or a few hundred independent trades. But a high t-statistic only says the result is unlikely to be luck under the backtest's own assumptions. What if the assumptions about costs or timing are wrong?
