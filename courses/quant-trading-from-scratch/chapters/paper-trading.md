# Paper trading: running the strategy live without real money

Your research log holds a hypothesis that passed its tests on the past. A backtest reads a finished file, where every price is already there and on time. Live trading is different. Prices arrive one at a time, sometimes late or missing, and your code must decide before the bar ends. How do you test those parts without putting money at risk?

## A dress rehearsal

Picture a theatre's dress rehearsal. The actors wear the costumes, the lights and sound run on cue, and the show runs at full speed. Only the audience is missing. The show stands for your strategy, the cues for live data and order times, and the missing audience for real money. The picture stops holding in one place: a rehearsal can repeat a scene, but a live market day happens once.

Paper trading runs the strategy on live data, at live times, and records the orders it would send. Fills are simulated, from the live quotes, and nothing reaches the market. A broker is the firm that sends your orders to an exchange. Many brokers offer a paper account for this, with the same connection as a real one.

## What to compare

Each evening you rerun the backtest on the same days the paper account traded. Then you compare the two, day by day. The illustrative code below does this for 20 days:

```python
import numpy as np, pandas as pd

days = pd.bdate_range("2026-03-02", periods=20)          # 20 illustrative trading days
rng = np.random.default_rng(2)
replay = pd.Series(rng.normal(0.0005, 0.01, 20), index=days)   # backtest rerun on the same days
paper = replay - 0.0003                                  # every paper fill a little worse
paper.iloc[7] = 0.0                                      # day 8: data came late, no trade

gap = paper - replay
print(f"average gap per day: {gap.mean():.4%}")
print("days off by more than 0.1%:", [d.strftime("%Y-%m-%d") for d in gap[gap.abs() > 0.001].index])
```

```
average gap per day: -0.0697%
days off by more than 0.1%: ['2026-03-11']
```

Read the two gaps separately.

1. **A small gap every day.** Paper fills were 0.03% worse than the backtest each day. Over 252 trading days that adds up to about 0.03% × 252 = 7.56% a year. Your slippage estimate was too low, and the backtest must change.
2. **One large gap.** On 11 March the price arrived late, so the strategy traded nothing and missed a gain of 0.82%. That is a fault in your data feed or your timing, not in the idea.

Neither gap shows up in a backtest, because a backtest never waits for data. Paper trading finds four kinds of fault. Prices arrive late or not at all. Code crashes on a holiday. Signals differ from the backtest's. The broker rejects orders.

```inkling
title "The same days, two ways"
live: box "Live prices"
strat: box "Strategy code"
fills: box "Simulated fills"
replay: box "Backtest rerun"
cmp: diamond "Compare\nday by day" yellow
live -> strat -> fills -> cmp
live -> replay -> cmp
circle cmp
step 1: live "Prices arrive one at a time"
step 2: strat, fills "The strategy trades on paper"
step 3: replay "The backtest replays the same days"
step 4: cmp "Every gap is a fault or a wrong estimate"
```

Paper trading cannot prove the edge. Three months of paper trading is about 63 days. With a Sharpe ratio of 1, the t-statistic after 63 days is 1 × 0.5 = 0.5, where 0.5 is √(63 / 252). Paper trading also cannot show how your own orders move the price, because no order reaches the market.

## Staged deployment

Staged deployment moves a strategy to full size in steps. Each step has a pass rule, written in the research log before it starts.

1. **Paper.** At least 1 month. Pass: no unexplained gaps and no crashes.
2. **Small money.** For example 10% of the planned size, for 3 months. Pass: real fills within your slippage estimate.
3. **Full size.** With every risk limit switched on from the first day.

A failed stage sends the strategy back one step, never forward.

> **Key idea:** Paper trading runs a strategy on live data with simulated fills, so faults in data, timing and code show up before real money is at risk.

## What you have now

You now have the whole path from an idea to a live strategy. A hypothesis goes in the research log first. Then come a backtest with honest costs, a test of its Sharpe ratio and stress tests. Sizing, risk limits and paper trading come last. Each step can stop a strategy that only looked good. The next modules build on this base with strategies that trade two or more assets against each other.
