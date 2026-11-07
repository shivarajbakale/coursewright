# Look-ahead bias: using information from after the decision

With slippage you saw that a daily rule cannot trade at a close it has not seen yet. A backtest makes that mistake easily, because the whole history sits in one DataFrame. Every row is visible to every line of code. What happens to the result when a rule reads a number from its own future?

## Betting on a race you have already watched

Picture a friend who records a horse race and then offers you bets on it. If you watched the recording first, you win every bet. Your skill at picking horses did not change; you only knew the result. The recording stands for the rows of the DataFrame after the decision. Your winning streak stands for the backtest's profit. The picture stops holding in one way: in a backtest nobody tells you that you peeked. The code runs, and the number looks like skill.

## The smallest example

Take a rule: "be long when the price rose today". Here it is written two ways, once wrong and once right.

```python
import pandas as pd

close = pd.Series([100.0, 101.0, 99.0, 100.0, 102.0, 101.0, 100.0, 101.0])
ret = close.pct_change().fillna(0)
up = (ret > 0).astype(int)              # 1 if today's close was above yesterday's

cheat = up * ret                        # trades today on a fact known only at today's close
honest = up.shift(1).fillna(0) * ret    # trades today on yesterday's fact

print(pd.DataFrame({"ret": ret, "up": up, "up.shift(1)": up.shift(1)}).round(4))
print(f"cheat:  {(1 + cheat).prod() - 1:.2%}")
print(f"honest: {(1 + honest).prod() - 1:.2%}")
print(f"buy and hold: {close.iloc[-1] / close.iloc[0] - 1:.2%}")
```

```
      ret  up  up.shift(1)
0  0.0000   0          NaN
1  0.0100   1          0.0
2 -0.0198   0          1.0
3  0.0101   1          0.0
4  0.0200   1          1.0
5 -0.0098   0          1.0
6 -0.0099   0          0.0
7  0.0100   1          0.0
cheat:  5.10%
honest: -1.00%
buy and hold: 1.00%
```

Follow the two versions:

1. `up` is 1 on days 1, 3, 4 and 7, the four days the price rose.
2. The `cheat` line multiplies `up` by the same day's return. It holds the share on exactly the four rising days, and on no falling day. That needs the day's close before the day starts.
3. The `cheat` result is 5.10%, more than five times the 1.00% of buy and hold.
4. The `honest` line uses `up.shift(1)`, yesterday's value. It holds the share on days 2, 4 and 5, after each rise. Those days returned -1.98%, +2.00% and -0.98%.
5. The `honest` result is a loss of 1.00%. The rule has no edge at all. All of the 5.10% came from reading the future.

```inkling
title "One row too early"
layout compare
columns "Cheat", "Honest"
row "Decides with": "today's close", "yesterday's close"!
row "Days held": "4 rising days", "days 2, 4, 5"
row "Result": "+5.10%", "-1.00%"
row "Possible live": no, yes
step 1: decides-with "What the rule may read"
step 2: days-held "Which days it holds the share"
step 3: result "What the backtest reports"
step 4: possible-live "Which one you could trade"
```

**`shift`** is the pandas method that moves every value down by a number of rows. After `shift(1)`, the row for day 4 holds the value from day 3. Shifting the position by one bar is the standard guard. It makes sure the position for a bar was decided before that bar's return happened.

## Where else it hides

The same mistake hides in less visible places:

1. A rule scales returns by the average of the whole history. That average includes years the rule had not lived through yet.
2. A rule trades at the close it used to decide. As slippage showed, the close exists only after the decision moment.
3. A rule uses a number that was published, or corrected, after the date it is attached to.

> **Key idea:** Look-ahead bias is any use, at decision time, of data that was not yet known then. It turns into profit that no live trading can repeat.

## What you have now

The backtest loop decides, then trades, then earns the next return, and `shift(1)` keeps that order in a vectorised backtest. That protects when you read the data. It does not protect what the data says. A price series can contain jumps that never cost a shareholder anything. Where do those jumps come from, and how do you remove them?
