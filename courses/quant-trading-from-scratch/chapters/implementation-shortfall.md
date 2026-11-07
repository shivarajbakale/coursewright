# Implementation shortfall: the full cost from decision to fill

Market impact told you that a large order pushes the price. So you trade slowly, and the price moves while you wait. Part of your order may never fill at all. You need one number that adds up every cost, including the shares you missed. How do you get it?

## Compare with a plan on paper

Picture planning a trip and writing down the train fare you saw on the website: $50. By the time you reach the counter, the fare for the first seats is $50.08. The later seats cost $50.16. The last two seats sell out, and you never get them. To judge the trip, you compare it with the plan you wrote down, not with the prices at the counter.

Here the written fare is the price when you decided to trade. The counter prices are your fills. The sold-out seats are the shares that never filled. The picture stops holding at the sold-out seats. A missed train seat costs you nothing in money, but missed shares cost you the gain they would have made. If the price rises after you stop, you lose that rise on every share you did not buy.

So you run two portfolios side by side, in four steps.

1. A paper portfolio buys all the shares you wanted, at the price when you decided, with no fees.
2. Your real portfolio holds only what filled, at the prices you paid, after fees.
3. At a chosen end time, you value both at the same price.
4. The paper result minus the real result is your cost.

```inkling
title "From decision to judgement"
layout timeline
- Decide: 10,000 at 50.00
- Fill one: 4,000 at 50.08
- Fill two: 4,000 at 50.16
- Stop: 2,000 unfilled
- Judge: price 50.40
span fill-one..stop "trading"
step 1: decide "You decide at the arrival price"
step 2: fill-one, fill-two "Each fill costs more than the decision price"
step 3: stop "You stop before the order is complete"
step 4: judge "The price you judge at prices the missed shares"
```

## A worked example

You decide to buy 10,000 shares when the price is $50.00. You get 8,000 shares, pay a fee of $0.005 per share, and stop. At the end of the day the price is $50.40.

```python
arrival = 50.00                        # price when you decided
wanted = 10_000                        # shares you decided to buy
fills = [(4_000, 50.08), (4_000, 50.16)]  # shares, price
fee_per_share = 0.005
end_price = 50.40                      # price when you judge the result

filled = sum(q for q, _ in fills)
avg = sum(q * p for q, p in fills) / filled
execution = filled * (avg - arrival)
fees = filled * fee_per_share
missed = (wanted - filled) * (end_price - arrival)
total = execution + fees + missed
print(f"filled {filled} at {avg:.2f} on average")
print(f"execution {execution:.0f}, fees {fees:.0f}, missed {missed:.0f}")
print(f"shortfall {total:.0f}, {100 * total / (wanted * arrival):.2f}% of the plan")
```

```
filled 8000 at 50.12 on average
execution 960, fees 40, missed 800
shortfall 1800, 0.36% of the plan
```

Walk through the parts:

1. The paper portfolio gains 10,000 × 0.40 = 4,000 dollars.
2. The real portfolio gains 8,000 × 0.28 = 2,240 dollars on its shares, minus 40 dollars of fees: 2,200 dollars.
3. The cost is 4,000 − 2,200 = 1,800 dollars.
4. The code splits the same 1,800 into three parts. Paying above $50.00 cost 8,000 × 0.12 = 960 dollars. Fees cost 40 dollars. The missed shares cost 2,000 × 0.40 = 800 dollars.
5. As a share of the plan, 1,800 / 500,000 = 0.36%.

For a sell order the signs flip. You lose when you sell below the decision price. You also lose when the price falls on shares you did not sell.

## Name it

**Implementation shortfall** is the difference between the paper portfolio and the real one, from the moment you decided to the end time. Two words go with it. The **arrival price** is the price when you decided. In practice it is the mid price at that moment. The **opportunity cost** is the part that comes from shares that never filled. It is the price move after the decision, times the missed shares.

> **Key idea:** Implementation shortfall measures your cost against the arrival price and counts the shares that never filled, so a slow order cannot hide its cost by not trading.

## What you have now

You can now put one honest number on an order: slippage, fees and missed shares together. It shows the trade-off that market impact left you with. Trading fast pays more impact, and trading slowly risks a larger opportunity cost. What is the plainest plan for spreading one order across the day?
