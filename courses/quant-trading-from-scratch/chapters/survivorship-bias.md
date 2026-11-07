# Survivorship bias: testing only the companies that survived

Adjusted prices fixed the history of a company that is still trading. But to test a rule on many companies, you first need a list of companies. The nearest list to hand is the one an exchange publishes today. That list holds only the companies that are still there. What does a backtest miss when it starts from today's list?

## Listening only to the people who made it

Picture a talk where five people who left their jobs to start a company describe how they got rich. Each one says, "I took the risk and it paid off". You conclude that taking the risk pays. The people who tried and failed are not on the stage, so you never hear from them. The speakers stand for the companies still listed today. The missing founders stand for the companies that failed. The picture stops holding in one way: in a backtest the missing companies did not stay quiet. They had prices, and those prices fell.

A company leaves an exchange in a **delisting**: its shares stop trading there. A delisting happens for a bankruptcy, for a price too low to meet the exchange's rules, or because another company bought it. The last case often ends well for the shareholders. The first two often end with large losses, and those losses vanish when the company leaves the list.

## The smallest example

The **universe** is the set of assets a strategy may trade on a given date. Here are five made-up companies that were all listed on 1 January 2020. Two of them were delisted later. CCC went bankrupt, and DDD fell to $8.00 and was delisted.

```python
import pandas as pd

# Five made-up companies listed on 1 Jan 2020: price then, and last price
u = pd.DataFrame({
    "start": [20.0, 50.0, 10.0, 40.0, 30.0],
    "last":  [26.0, 60.0,  0.0,  8.0, 33.0],
    "listed_today": [True, True, False, False, True],
}, index=["AAA", "BBB", "CCC", "DDD", "EEE"])
u["ret"] = u["last"] / u["start"] - 1

print(u.round(2))
print(f"survivors only: {u[u.listed_today].ret.mean():.1%}")
print(f"whole universe: {u.ret.mean():.1%}")
```

```
     start  last  listed_today  ret
AAA   20.0  26.0          True  0.3
BBB   50.0  60.0          True  0.2
CCC   10.0   0.0         False -1.0
DDD   40.0   8.0         False -0.8
EEE   30.0  33.0          True  0.1
survivors only: 20.0%
whole universe: -24.0%
```

The test puts equal money in each company and holds to the end. Walk through it:

1. The three survivors returned +30%, +20% and +10%. Their average is +20.0%.
2. CCC went to zero, a return of -100%. DDD went from $40.00 to $8.00, a return of 8.00 / 40.00 - 1 = -80%.
3. Over all five, the average is (30 + 20 - 100 - 80 + 10) / 5 = -24%.
4. A test that starts from today's list reports +20.0%. An investor who bought all five in 2020 lost 24.0%.

The rule here did nothing clever. The whole gap of 44 percentage points came from leaving out the two failures.

```inkling
title "How a list loses its failures"
layout down
start: box "Listed in 2020:\n5 companies"
fail: box "CCC, DDD\ndelisted" red
today: box "Listed today:\n3 companies"
test: box "Backtest\nreports +20.0%"
true: box "True result\n-24.0%" green
start -> fail
start -> today
today -> test
start -> true
cross test
step 1: start "Five companies are in the universe in 2020"
step 2: fail "Two fail and leave the exchange"
step 3: today "Today's list keeps only the three survivors"
step 4: test "A backtest on today's list looks profitable"
step 5: true "The whole 2020 universe lost money"
```

## The fix

A survivor-free backtest needs data on companies that no longer trade. It uses that data in three steps.

1. Build the universe for each date from the list as it stood on that date.
2. Keep each delisted company's prices up to its last trade.
3. Book the delisting at the last price, or at zero for a bankruptcy where shareholders got nothing.

Free price data often leaves delisted companies out, so a survivor-free test needs a data set that keeps them.

> **Key idea:** Survivorship bias is the profit a backtest invents when its universe holds only companies that survived to today, because the failures and their losses are missing.

## What you have now

Your backtest now pays costs, reads only the past, uses adjusted returns and trades a universe that includes failures. Each of these fixes removes an error in the data or the code. One error remains, and it is in you: you designed the rule while looking at the same history you then test it on. How can you judge a rule on data that did not shape it?
