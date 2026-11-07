# Walk-forward testing: fit on the past, test on the next period

Overfitting showed how far an in-sample score can drift from the truth. Out-of-sample testing catches the drift, but it gives one verdict, from one stretch of history, and you can use it once. A real strategy also does not choose its parameters once and keep them forever. It refits them as new data arrives. How do you test the rule the way it will really run?

## Learning to drive one week at a time

Picture a learner driver who practises on the roads of one week and then takes a test drive the next week. After each test, the instructor adds that week to the practice and books the next test. Every test is on roads the driver has not practised on. The practice weeks stand for the fit window. Each test drive stands for a test period. The picture stops holding in one way: a driver remembers every week, while a rolling fit forgets the oldest data on purpose.

## The smallest example

A **rolling window** is a fixed-length stretch of time that moves forward step by step: 2018-2019, then 2019-2020, and so on. Walk-forward testing repeats one step for each test year:

1. Fit: choose the best moving-average length on the 2 years before the test year.
2. Test: trade that length for the test year, which the fit never saw.
3. Roll: move both windows forward 1 year and repeat.
4. Join the test years into one record and judge only that.

These are the same made-up prices as in out-of-sample testing, with the same 5 lengths.

```python
import numpy as np, pandas as pd

rng = np.random.default_rng(5)
days = pd.bdate_range("2018-01-01", "2023-12-29")
close = pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.01, len(days)))), index=days)
ret = close.pct_change()
# Daily returns of each rule; each position uses only closes up to yesterday
rule = pd.DataFrame({n: (close > close.rolling(n).mean()).astype(int).shift(1) * ret
                     for n in [5, 10, 20, 50, 100]})
sharpe = lambda r: r.mean() / r.std() * np.sqrt(252)

tested = []
for year in [2020, 2021, 2022, 2023]:
    fit = rule[str(year - 2):str(year - 1)]     # the 2 years before the test year
    best = sharpe(fit).idxmax()
    test = rule.loc[str(year), best]             # the test year, never seen by the fit
    print(year, "length", best, "fit", round(sharpe(fit)[best], 2), "test", round(sharpe(test), 2))
    tested.append(test)

print("walk-forward Sharpe:", round(sharpe(pd.concat(tested)), 2))
print("buy and hold, same years:", round(sharpe(ret["2020":]), 2))
```

```
2020 length 50 fit 0.65 test 1.16
2021 length 50 fit 1.04 test 1.33
2022 length 50 fit 1.25 test 0.51
2023 length 5 fit 1.45 test -1.39
walk-forward Sharpe: 0.38
buy and hold, same years: 0.62
```

```inkling
title "Two windows rolling forward"
layout timeline
- 2018: fit
- 2019: fit
- 2020: test 1
- 2021: test 2
- 2022: test 3
- 2023: test 4
span 2018..2019 "first fit window"
step 1: 2018, 2019 "Fit on the first 2 years"
step 2: 2020 "Test the chosen length on the next year"
step 3: 2021 "Roll forward: fit on 2019-2020, test 2021"
step 4: 2022, 2023 "Repeat until the data runs out"
```

Read the four rows:

1. For 2020 the fit window is 2018-2019. The 50-day rule scored 0.65 there, and 1.16 in 2020.
2. Each later row drops the oldest year and adds the newest. The fit picked 50 days three times.
3. For 2023 the fit picked 5 days, with the highest fit score of all, 1.45. In the test year it scored -1.39.
4. The four fit scores average 1.10. The joined test years score 0.38, which is the honest estimate.
5. Holding the share over the same 4 years scored 0.62. Measured against that benchmark, the rule added nothing.

The method has a cost. Every test year is out-of-sample, but you get each verdict only once. If you change the rule after reading the walk-forward result, it has become in-sample data, as with any hold-out.

The fit window need not roll. An **expanding window** keeps its start fixed and grows each year. It uses more data, but reacts more slowly when markets change.

> **Key idea:** Walk-forward testing fits a rule on a rolling window of the past, tests it on the next period, rolls forward and joins the test periods, so every result comes from data the fit never saw.

## What you have now

Your backtest now pays transaction costs and slippage, and reads only the past. It uses adjusted prices and a survivor-free universe. It counts its tries and is judged walk-forward. That gives an honest estimate of how a rule would have done. It does not say how much money to put behind it. How large should each bet be, given how unsure the estimate is?
