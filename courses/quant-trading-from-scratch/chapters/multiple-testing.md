# Multiple testing: many tries make luck look like skill

With out-of-sample testing, you picked the best of 5 moving-average lengths. It scored 0.95 on the data that chose it and 0.30 on new data. Research rarely stops at 5 tries. You change a length, add a filter, try another share, and run the backtest again. What does the best result mean after 100 tries?

## A room full of coin-flippers

Put 100 people in a room and ask each to flip a coin 10 times. Nobody has any skill at flipping coins. Yet with 100 people, the chance that at least one flips 9 or more heads is close to two in three. That person looks talented, and is not. The people stand for the variants of a rule you test. The heads stand for the backtest result. The picture stops holding in one way: a coin's odds are known. You do not know whether any of your variants has a real edge.

## The smallest example

Each choice you can change in a rule is a **parameter**: a moving-average length, a holding period, the share it trades. Each new value of a parameter is a new try. Here are 100 rules with no skill at all. Each one is long or short at random each day, on returns that contain no pattern.

```python
import numpy as np, pandas as pd

rng = np.random.default_rng(1)
ret = rng.normal(0, 0.01, 504)                   # 2 years of daily returns, no pattern
rules = rng.choice([-1, 1], size=(100, 504))     # 100 rules: long or short at random each day

pnl = pd.DataFrame(rules * ret).T                # one column of daily results per rule
year1, year2 = pnl.iloc[:252], pnl.iloc[252:]
sharpe = lambda r: r.mean() / r.std() * np.sqrt(252)

s1 = sharpe(year1)
best = s1.idxmax()
print("rules with Sharpe above 1 in year 1:", (s1 > 1).sum())
print("best rule in year 1:", round(s1[best], 2))
print("same rule in year 2:", round(sharpe(year2)[best], 2))
```

```
rules with Sharpe above 1 in year 1: 18
best rule in year 1: 2.63
same rule in year 2: -0.9
```

Read the result in order:

1. Every rule is a coin flip, so its true Sharpe ratio is 0.
2. In year 1, 18 of the 100 rules scored above 1. With one year of daily data, luck alone pushes a rule above 1 in about 16 cases out of 100.
3. The best rule scored 2.63. On its own, that number would look like a strong edge.
4. In year 2 the same rule scored -0.90. Its luck did not repeat.

The best score climbs as you try more. This table comes from a simulation like the one above, repeated thousands of times. It shows the middle value of the best one-year Sharpe ratio among rules that have no edge:

| Rules tried | Best Sharpe ratio, middle value |
| --- | --- |
| 1 | 0.00 |
| 10 | 1.50 |
| 100 | 2.49 |
| 1,000 | 3.25 |

So a one-year Sharpe ratio of 2.5 means little if it was the best of 100 tries. It is about what 100 rules with no edge produce.

```inkling
title "How a research loop finds luck"
layout cycle
center "keep the best"
idea: circle "Change a\nparameter"
run: circle "Run the\nbacktest"
look: circle "Look at\nthe Sharpe"
keep: circle "Keep it if\nit is higher"
cycle idea, run, look, keep
note keep "100 loops: best near 2.5 with no edge"
step 1: idea "You change one choice in the rule"
step 2: run "The backtest runs on the same history"
step 3: look "You read the score"
step 4: keep "The highest score so far survives"
```

## Defending against it

1. Count every try, including the ones you threw away. A result means little without the number of tries behind it.
2. Compare the best score with what that many tries of no-edge rules produce, as in the table.
3. Keep out-of-sample data back, and judge only the final choice on it.
4. Prefer a reason first. A rule with a cause you can state, such as a risk premium, needs fewer tries than a search through every setting.

> **Key idea:** Multiple testing is trying many variants and keeping the best. The best of many no-edge rules scores well by luck alone, so a result must be judged against the number of tries.

## What you have now

The Sharpe ratio of one rule on one history carries luck, and keeping the best of many tries collects that luck on purpose. Out-of-sample data shows the luck when it fails to repeat. The same thing happens inside a single rule with 60 parameters, each tuned to the past. What does a rule with too many adjustable parts learn from history?
