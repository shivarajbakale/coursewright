# Transaction costs: fees and spread paid on every trade

Your backtest loop now runs a rule bar by bar and keeps honest books. But every fill in it so far happened at a price with nothing taken off. A real trade is never free. How much does one trade cost, and how much can that change a rule's result?

## Two costs on every trade

Think of changing money at an airport booth. The booth buys euros at one rate and sells them at a higher rate. It also charges a fee for each exchange. You lose money on every swap, even if the euro does not move. The gap between the two rates stands for the bid-ask spread. The booth's fee stands for the broker's fee. The picture stops holding in one way: a booth's fee is often flat, while trading costs grow with the money you trade.

Every trade pays two costs:

1. The **commission**: the fee your broker charges to carry out the order. Here it is 0.05% of the money traded, an illustrative figure. Brokers charge per share, per order or as a percentage, and the amounts differ between brokers.
2. Half the spread. Say the best bid is $99.95 and the best ask is $100.05, so the mid price is $100.00. A market order to buy pays $100.05. That is $0.05, or 0.05%, above the mid price. A market order to sell gets $99.95 and loses the same 0.05% on the other side.

So one purchase of $10,000 of shares costs $10,000 × 0.05% = $5 in commission. It also costs $5 of spread. That is $10 in all, or 0.10% of the money traded. Selling the shares again costs another 0.10%. A round trip, in and then out, costs 0.20%.

```inkling
title "What one purchase costs"
layout stack
- Price you pay: $100.05
  - Commission: 0.05%
  - Half the spread: $0.05
- Mid price: $100.00
brace price-you-pay-100-05..mid-price-100-00 "0.10% per trade"
step 1: mid-price-100-00 "The fair middle of the quote"
step 2: half-the-spread-0-05 "A market order to buy pays the ask"
step 3: commission-0-05 "The broker takes its fee on top"
step 4: price-you-pay-100-05 "Together you are 0.10% behind before the price moves"
```

## Costs grow with turnover

**Turnover** is how much you trade, as a fraction of your equity. Buying with all your equity is a turnover of 1. Selling it all again is another 1. The cost of a trade is its turnover times the cost rate. Because of this, a rule that trades more pays more, whatever its signal says.

Here is a vectorised backtest of a rule that goes in and out every day, with costs taken off:

```python
import pandas as pd

close = pd.Series([100.0, 100.2, 100.1, 100.3, 100.2, 100.4, 100.3])
position = pd.Series([1, 0, 1, 0, 1, 0, 0])   # 1 = all equity long, 0 = flat

ret = close.pct_change().fillna(0)
gross = position.shift(1).fillna(0) * ret      # yesterday's position earns today's return
turnover = position.diff().fillna(position).abs()   # fraction of equity traded each day
cost = turnover * 0.001                        # 0.10% of every dollar traded
net = gross - cost

print("turnover:", turnover.sum())
print(f"gross: {(1 + gross).prod() - 1:.3%}")
print(f"net:   {(1 + net).prod() - 1:.3%}")
```

```
turnover: 6.0
gross: 0.601%
net:   -0.001%
```

Walk through it:

1. `ret` is each day's return of the price.
2. `gross` multiplies yesterday's position by today's return. The rule held the share into days 1, 3 and 5, and earned close to 0.20% each time.
3. The `turnover` column is the size of each change in position. The first purchase counts too, so `fillna(position)` fills the first row. The rule changed its position 6 times.
4. The total cost is 6 × 0.10% = 0.60% of equity.
5. Before costs the rule made 0.601%. After costs it lost 0.001%. The costs took the whole gain.

Now scale it up. A rule that trades all its equity once a day for a year pays 252 × 0.10% = 25.2% of its equity in costs. Its edge must be larger than that before it earns anything. A rule that trades all its equity once a month pays 12 × 0.10% = 1.2% a year.

> **Key idea:** Transaction costs are the commission and half the spread, paid on every trade. Their total is turnover times the cost per dollar traded, so a rule that trades more needs a bigger edge.

## What you have now

A trading edge must survive costs, and now you can compute them: turnover from each change in position, times commission plus half the spread. This model still assumes you trade at exactly the price your rule saw. In a real market the price can move between your decision and your fill. How big is that gap?
