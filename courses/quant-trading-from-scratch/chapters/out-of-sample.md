# Out-of-sample testing: judging a rule on data it never saw

Your backtest now pays costs, avoids look-ahead bias and uses a survivor-free universe. One error is left, and it comes from the designer. Say you chose a rule's moving-average length by watching which length did best on this history. Then you reported that result on the same history. Can a rule's score be trusted when the score came from the data that chose it?

## A teacher who hands out the exam in advance

Picture a teacher who gives the class the exact exam questions a week early. Every student scores 95%. The scores tell you which students memorised the answers. They do not tell you who can solve a new problem. The exam questions stand for the history you designed the rule on. A new exam stands for the years the rule will trade live. The picture stops holding in one way: students know they saw the questions, but a backtest never says how much of its score was memory.

The fix is the same in both cases. Keep part of the questions back, and set them only once, after all the studying is done.

## Splitting history by time

The **in-sample** data is the part of history you use to design and tune a rule. The **out-of-sample** data is a later part you hold back and use once, to judge the finished rule.

Here is a test on 6 years of made-up prices. The prices are random numbers, so no rule can have a true edge on them. The rule is long when the close is above its moving average, and flat otherwise.

```python
import numpy as np, pandas as pd

rng = np.random.default_rng(5)
days = pd.bdate_range("2018-01-01", "2023-12-29")    # 6 years of weekdays
close = pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.01, len(days)))), index=days)

def rule(length):                                    # daily returns of the rule
    pos = (close > close.rolling(length).mean()).astype(int).shift(1)
    return pos * close.pct_change()

def sharpe(r):
    return round(float(r.mean() / r.std() * np.sqrt(252)), 2)   # risk-free rate taken as 0

scores = {n: sharpe(rule(n)[:"2021"]) for n in [5, 10, 20, 50, 100]}  # in-sample: 2018-2021
best = max(scores, key=scores.get)
print("in-sample:", scores)
print("chosen length:", best)
print("out-of-sample:", sharpe(rule(best)["2022":]))                  # 2022-2023, used once
```

```
in-sample: {5: 0.65, 10: 0.58, 20: 0.67, 50: 0.95, 100: 0.71}
chosen length: 50
out-of-sample: 0.3
```

What happened, in order:

1. The code builds the rule for 5 lengths of moving average. Each rule uses `shift(1)`, so it trades on yesterday's signal.
2. It scores each rule by its annualised Sharpe ratio on 2018 to 2021 only. The in-sample data covers 4 years.
3. The 50-day rule scored highest, at 0.95. You choose it.
4. Only now does the code touch 2022 and 2023. The same rule scores 0.30 there.
5. The rule kept 0.30 / 0.95 = 0.32 of its in-sample Sharpe ratio, about a third.

The 0.95 was the highest of 5 scores on the history that picked it. That alone pushes it up. The 0.30 comes from years that played no part in the choice, so it is the fairer estimate.

```inkling
title "Design on one part, judge on another"
data: db "6 years\nof prices"
ins: box "In-sample\n2018-2021"
pick: box "Choose the\n50-day rule"
oos: box "Out-of-sample\n2022-2023" green
score: box "Sharpe 0.30"
data -> ins
data -> oos
ins -> pick : "best of 5"
pick -> score
oos -> score : "used once"
highlight oos
step 1: data "Six years of history"
step 2: ins "Design and tune on the first four years"
step 3: pick "Pick the rule that scored highest"
step 4: oos, score "Judge it once on two years it never saw"
```

## Rules for a fair hold-out

1. Split by date, never at random. Neighbouring days share information, so a random split puts each test day next to training days.
2. Put the out-of-sample period last, so it plays the part of the future.
3. Use it once. If you look, change the rule and look again, the out-of-sample data has become in-sample data.

> **Key idea:** Out-of-sample testing judges a finished rule on a later stretch of history that played no part in designing it, because data that shaped a rule cannot judge it.

## What you have now

Look-ahead bias was about a rule reading the future inside a backtest. Out-of-sample testing stops the designer from doing the same, by keeping the judging years out of every design choice. Here, choosing the best of 5 lengths turned a 0.30 rule into a 0.95 score. What happens to that gap when you try 100 versions instead of 5?
