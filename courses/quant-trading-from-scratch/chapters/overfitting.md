# Overfitting: a rule that fits past noise

Multiple testing kept the best of many separate rules. A single rule can do the same on its own. Give it enough parameters, tune each one to the past, and it will match history almost perfectly. Does a rule that matches history that well know anything about the future?

## A suit cut for one moment

Picture a tailor who measures you for a suit while you stand with one arm raised and your weight on one foot. The suit fits that pose perfectly. When you stand normally, it pulls and pinches everywhere. The pose stands for the history you tuned the rule on. Standing normally stands for the future. The picture stops holding in one way: you know which pose you held. A backtest cannot tell you which parts of history were the pose.

Price moves contain two parts. One part may repeat, such as a trend or a risk premium. The other part is **noise**: the random part of price moves that does not repeat. A rule with few parameters cannot follow the noise, so it has to find the part that repeats, if there is one. A rule with many parameters can follow the noise as well. It then fits each random wiggle of the past, and those wiggles will not come back.

## The smallest example

Here is a rule with 60 parameters. It splits days into 60 groups, one for each month and weekday, such as "Tuesdays in March". For each group it chooses long or short from the group's average return in-sample. The returns are made-up random numbers, so no group has a real pattern.

```python
import numpy as np, pandas as pd

rng = np.random.default_rng(2)
days = pd.bdate_range("2018-01-01", "2023-12-29")
df = pd.DataFrame({"ret": rng.normal(0, 0.01, len(days))}, index=days)   # no pattern
df["cell"] = df.index.month * 10 + df.index.day_of_week   # 12 months x 5 weekdays = 60 cells
ins, oos = df[:"2021"], df["2022":]

# Tuned rule: long in each cell that rose on average in-sample, short in the rest
side = np.sign(ins.groupby("cell").ret.mean())
sharpe = lambda r: round(float(r.mean() / r.std() * np.sqrt(252)), 2)

print("cells:", len(side), " in-sample days per cell:", round(len(ins) / len(side), 1))
print("in-sample Sharpe:    ", sharpe(ins.ret * ins.cell.map(side)))
print("out-of-sample Sharpe:", sharpe(oos.ret * oos.cell.map(side)))
```

```
cells: 60  in-sample days per cell: 17.4
in-sample Sharpe:     2.93
out-of-sample Sharpe: 0.19
```

Walk through it:

1. Each month has 4 or 5 of each weekday, so 4 years give each group 1,045 / 60 = 17.4 days on average.
2. An average of 17 random days is mostly noise. The rule picks the side of that noise in each of the 60 groups.
3. In-sample, every group is on the side that happened to win. The Sharpe ratio is 2.93.
4. Out-of-sample, the noise is new. The Sharpe ratio falls to 0.19.

One history can be lucky, so the test was repeated on 500 made-up histories. The 60-parameter rule averaged a Sharpe ratio of 3.08 in-sample and 0.01 out-of-sample. A rule with 1 parameter, always long or always short, averaged 0.38 in-sample and 0.00 out-of-sample. Both rules have no edge. The rule with more parameters hides that fact far better in-sample.

```inkling
title "More parameters, bigger illusion"
layout compare
columns "1 parameter", "60 parameters"
row "In-sample Sharpe": "0.38", "3.08"
row "Out-of-sample Sharpe": "0.00", "0.01"
row "Gap": "0.38", "3.07"!
row "Real edge": no, no
step 1: in-sample-sharpe "Tuned on 4 years of noise"
step 2: out-of-sample-sharpe "Judged on 2 new years"
step 3: gap "The gap grows with the parameters"
step 4: real-edge "Neither rule could ever earn"
```

## Signs that a rule is overfit

1. It has many parameters compared with the data behind each one, such as 17 days per group.
2. Its in-sample result is far better than its out-of-sample result.
3. A small change to one parameter, such as a moving average of 49 days instead of 50, ruins the result.
4. Nobody can say why the rule should work.

> **Key idea:** Overfitting is tuning a rule until it matches the noise of the past. The more parameters a rule has, the better it fits history and the worse it predicts new data.

## What you have now

Overfitting is multiple testing inside one rule: each parameter is another chance to fit luck. A single out-of-sample period catches it, but it gives one verdict from one stretch of history, and you can use it only once. Real rules are also refitted as new data arrives. How do you test a rule the way it will run, refitted again and again?
