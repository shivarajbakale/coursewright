# A futures contract: agreeing today on a price for later

A bakery needs wheat in six months and fears the price will rise. A farmer fears the price will fall before harvest. Both want to fix the price today and trade later. How can two strangers agree on that, and trust each other to pay?

## A price fixed now, a trade later

Think of booking a hotel room months ahead at today's rate. The rate you book is the agreed price, and the night you stay is the trade. The picture stops holding in two places. You can sell the agreement to someone else before the date, because it trades on an exchange. And gains and losses are paid in cash every day, not once at the end.

A futures contract is an agreement to trade a fixed amount of something at a fixed price on a fixed later date. That date is the **expiry**. The buyer is long the contract and the seller is short. The seller does not need to borrow anything to be short, unlike in short selling. Nobody pays the agreed price on the day they agree.

Each side instead leaves a deposit with the exchange, called **margin**. The margin covers a loss that one side might fail to pay. The exchange then does **daily settlement**:

1. Each evening the exchange sets a settlement price for the contract.
2. It works out how far that price moved since the evening before.
3. It moves that amount of cash from the margin of the side that lost to the side that gained.

Because of this, a loss can never grow for months unpaid. If your margin falls too low, you must add cash or the exchange closes your contract.

```inkling
title "Daily settlement"
layout sequence
buyer: person "Buyer (long)"
ex: box "Exchange"
seller: person "Seller (short)"
buyer -> ex : "$1,000 margin"
seller -> ex : "$1,000 margin"
ex -> buyer : "day 1: price up, +$120"
buyer -> ex : "day 2: price down, -$150"
ex -> buyer : "day 3: price up, +$80"
steps auto
```

## Three days of one contract

Take a contract to buy 100 shares of a stock in one year. The stock costs $100 today, and the futures price is $105.13. You buy one contract and deposit $1,000 of margin.

```python
import pandas as pd

settle = pd.Series([105.13, 106.33, 104.83, 105.63], index=["day 0", "day 1", "day 2", "day 3"])
size = 100                            # shares per contract
pnl = settle.diff().fillna(0) * size  # cash paid to the buyer each day
margin = 1000 + pnl.cumsum()          # buyer's margin account
print(pd.DataFrame({"settle": settle, "pnl": pnl.round(2), "margin": margin.round(2)}))
```

```
       settle    pnl  margin
day 0  105.13    0.0  1000.0
day 1  106.33  120.0  1120.0
day 2  104.83 -150.0   970.0
day 3  105.63   80.0  1050.0
```

1. Day 1: the price rises by $1.20. 1.20 × 100 = 120, so you receive $120.
2. Day 2: the price falls by $1.50. You pay $150, and your margin drops to $970.
3. Day 3: the price rises by $0.80. You receive $80.

After three days you have 1050 − 1000 = 50 dollars more. That equals (105.63 − 105.13) × 100 = 50. Daily settlement splits the total gain into daily payments, and each day's account is marked to market.

## Why the futures price is above the stock price

Compare two ways to own the 100 shares in one year. You can pay $10,000 today. Or you can keep the $10,000 at the risk-free rate of 5% and pay the futures price at expiry. If the futures price were $100, the second way would earn a year of interest for free. So the futures price includes that interest.

Finance often adds interest continuously, a tiny amount at every instant. With continuous interest, the growth factor over T years at rate r is e^(r × T), where e is about 2.71828. Here e^(0.05 × 1) = 1.0513, so the futures price is 100 × 1.0513 = 105.13. This assumes the stock pays no dividend during the year. A dividend lowers the futures price, because the futures buyer does not receive it.

> **Key idea:** A futures contract fixes a price today for a trade at expiry, margin guards against default, and daily settlement pays each day's gain or loss in cash.

## What you have now

A futures contract lets you be long or short without paying the price today. Its fair price is the price today grown at the risk-free rate. But every contract ends at its expiry. How do you hold a futures position for years when each contract lasts months?
