# Fractional Kelly: betting less than Kelly because the odds are guesses

The Kelly criterion gave the bent coin a best stake of 20%. That answer used the exact chance of heads, 60%. In trading you never get that number. You get an estimate from a backtest, and the estimate can be far off. What happens to Kelly when your inputs are wrong, and what should you stake instead?

## Overbetting costs more than underbetting

Picture filling a car for a long drive with a fuel gauge you do not trust. If you stop for fuel too early, you lose a few minutes. If you trust the gauge and it reads high, you are stuck by the road. The two mistakes cost different amounts, so you stop early. The early stop stands for a smaller stake. Being stuck stands for staking more than the true Kelly fraction. The picture stops holding in one place: in trading you never learn the true reading, even afterwards.

Go back to the coin. Say your tests suggest heads comes up 60% of the time, but the true chance is 55%.

1. You compute Kelly from your estimate: 0.6 − 0.4 = 0.2. You stake 20%.
2. The true Kelly stake is 0.55 − 0.45 = 0.1. You are staking twice that.
3. At the true chance, a 20% stake has an average log growth of −0.00014 per round. Your money slowly shrinks on a coin that favours you.
4. A stake of half your estimate, 10%, grows at +0.00501 per round. That is the best possible growth for the true coin.

Now say your estimate was right after all. Then the 10% stake grows at 0.01504 per round instead of 0.02014. That is 75% of the best growth. Its swings are half as large: the standard deviation of the log growth per round falls from 0.199 to 0.098.

Smaller swings also mean fewer deep falls. A simulation played 20,000 runs of 1,000 rounds each. The 20% stake fell to half its starting money at some point in 46% of runs. The 10% stake did so in 10% of runs.

## How wrong a backtest estimate can be

For a strategy, the Kelly formula becomes f = m / s². Here m is the mean yearly excess return and s² its variance. A strategy with m = 5% and a volatility of 20% has f = 0.05 / 0.04 = 1.25. That means positions worth 125% of the account.

Now pretend you know the truth and run 10,000 different 5-year backtests of that strategy:

```python
import numpy as np

rng = np.random.default_rng(1)
mean, vol, days = 0.05, 0.20, 5 * 252          # true yearly excess return and volatility
daily = rng.normal(mean / 252, vol / np.sqrt(252), size=(10_000, days))

est_mean = daily.mean(axis=1) * 252            # what 10,000 different 5-year backtests measure
est_var = daily.var(axis=1, ddof=1) * 252
kelly = est_mean / est_var

print(f"true Kelly fraction: {mean / vol**2:.2f}")
print(f"estimates below 0: {(kelly < 0).mean():.0%}")
print(f"estimates above 2.5: {(kelly > 2.5).mean():.0%}")
```

```
true Kelly fraction: 1.25
estimates below 0: 28%
estimates above 2.5: 30%
```

In 30% of the backtests the estimate is more than twice the true Kelly fraction. Staking that much gives zero growth or a loss, as the coin showed. In 28% the estimate is below 0, so it says the strategy loses money.

```inkling
title "From a guess to a stake"
layout down
est: box "Backtest estimate\nof the edge"
k: box "Kelly fraction\nfrom the estimate"
cut: diamond "Multiply\nby one half"
stake: box "Stake you use" green
est -> k -> cut -> stake
note est "can be twice the truth, or below 0"
highlight cut
step 1: est "A backtest gives an estimate, not the true edge"
step 2: k "Kelly turns that estimate into a stake"
step 3: cut "Cut it to allow for the error"
step 4: stake "Keep 75% of the growth with half the swings"
```

## The name

Fractional Kelly means staking a fixed share c of the Kelly fraction, where c is below 1. With an exact edge and the formula f = m / s², the growth you keep is 2c − c² of the best. For half Kelly that is 2 × 0.5 − 0.5² = 0.75. At c = 2 it is 2 × 2 − 2² = 0, so you do not grow at all. Many traders stake half Kelly or less. That is a habit and a judgement, not a law.

> **Key idea:** Fractional Kelly stakes a share of the Kelly fraction, because the edge is only an estimate and overbetting costs far more than underbetting.

## What you have now

You can turn an estimated edge into a stake and cut it to allow for error, using the Kelly criterion and compounding. The formula still treats volatility as one fixed number. But volatility changes: a calm year can be followed by a year with four times the swings. How do you keep your risk steady while the market's risk moves?
