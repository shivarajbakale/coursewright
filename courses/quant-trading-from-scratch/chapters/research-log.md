# A research log: writing the hypothesis down before testing

Stress tests showed how one result can break. But each stress test, each parameter you changed and each idea you dropped was another try. As you saw with multiple testing, many tries make luck look like skill. After a month of research, how many variants did you really run? Most people cannot say, and their memory keeps the winners and forgets the rest.

## A lab notebook

Picture a scientist's lab notebook. Before the experiment, they write what they expect and why. During it, they write every run, including the failed ones. Nobody may tear out a page. The notebook stands for your research log, an experiment for one backtest variant, and a torn-out page for a result you forget. The picture stops holding in one place: a lab can repeat an experiment on fresh material, but you have only one history of prices.

The log starts with a hypothesis. A hypothesis is a testable statement, written before the test, of what you expect, why, and what result would prove it wrong. Here is one for the strategy you stressed.

- **Claim:** after an up day, the next day rises more often than it falls, and the reverse after a down day.
- **Why:** news spreads slowly, a behaviour-based trading edge.
- **Test:** long after up days, short after down days, costs of 0.02% per unit traded.
- **Pass:** an out-of-sample t-statistic above 2.5 that survives doubled costs and a one-day delay.

Writing the pass rule first matters most. If you choose it after seeing the result, you can always find a rule the result meets.

## Logging every variant

Each test then adds one row, whatever the result. A few lines of pandas are enough:

```python
import os
import pandas as pd

LOG = "research_log.csv"

def log_variant(hypothesis, variant, t_stat, note=""):
    row = pd.DataFrame([{"date": pd.Timestamp.today().date(), "hypothesis": hypothesis,
                         "variant": variant, "t_stat": t_stat, "note": note}])
    row.to_csv(LOG, mode="a", header=not os.path.exists(LOG), index=False)

log_variant("H1 slow news", "flip daily, 1 day delay", 1.99)
log_variant("H1 slow news", "flip daily, 2 day delay", -1.52, "edge gone")
log = pd.read_csv(LOG)
print(f"{len(log)} variants tried, best t {log.t_stat.max():.2f}")
```

```
2 variants tried, best t 1.99
```

The file only grows. Call `log_variant` from inside your backtest function, so no run can skip it.

```inkling
title "Write first, then test, then record"
layout sequence
you: person "You"
log: icon book "Research log"
bt: box "Backtest"
you -> log : "hypothesis and pass rule"
you -> bt : "run one variant"
bt --> you : "t-statistic"
you -> log : "record the result, pass or fail"
steps auto
```

## What the count tells you

The number of rows sets how high your bar must be. The code below gives 1,000 imaginary researchers a set of strategies with no edge at all. Each tests n variants on one year of data and keeps the best:

```python
import numpy as np

rng = np.random.default_rng(5)
for n in [1, 5, 20, 100]:
    returns = rng.normal(0, 0.01, size=(1_000, n, 252))   # 1,000 researchers, n variants, no edge
    t = returns.mean(axis=2) / returns.std(axis=2, ddof=1) * np.sqrt(252)
    best = t.max(axis=1)                                   # each researcher keeps their best
    print(f"{n:3} variants: best t {best.mean():.2f} on average, above 2 in {(best > 2).mean():.0%}")
```

```
  1 variants: best t 0.02 on average, above 2 in 2%
  5 variants: best t 1.17 on average, above 2 in 10%
 20 variants: best t 1.88 on average, above 2 in 40%
100 variants: best t 2.53 on average, above 2 in 91%
```

With 1 variant, a t-statistic above 2 appears by luck in 2% of cases. With 20 variants, it appears in 40%. With 100, the best variant of a strategy with no edge averages 2.53. So a best t-statistic of 2.5 means little after 100 tries, and a log is the only honest way to know you made 100.

> **Key idea:** A research log records the hypothesis and its pass rule before testing, then every variant and result, so you know how many tries stand behind your best number.

## What you have now

You can now judge a result by its t-statistic, its stress tests and the count of tries behind it. Walk-forward testing keeps the final test out of sample. Everything so far has replayed the past. Other failures appear only when data arrives live, one bar at a time, for example a price that comes 5 minutes late. How do you find them without risking money?
