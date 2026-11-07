# TWAP execution: trading equal slices over time

Implementation shortfall left you with a trade-off. One large order at once pays a large market impact. A slow order risks a price that runs away from you. What is the plainest plan between those two ends?

## Buy a little at a time

Picture a shop that puts 2 kilograms of coffee on its shelf, and refills the shelf every half hour. You need 12 kilograms today. If you take all 12 at the opening, you empty the shelf, and the owner charges more for each extra kilogram. If you take 1 kilogram every half hour, you only ever take what is on the shelf.

The shelf stands for the shares waiting near the best price in the limit order book. The refill stands for new sellers who join the book. The picture stops holding in two places. A shop refills on a timetable, but nobody promises that the book refills, or how fast. Also, a shop owner does not trade against you. Other traders can notice an order that arrives every 30 minutes and buy ahead of it.

You can see the gain in the book from market impact. A market buy for 2,000 shares at once paid $0.0265 above the mid price on average. Now split it into 4 orders of 500 shares, and assume the book refills to the same shape before each one.

1. Each 500-share order takes 300 shares at $100.02 and 200 at $100.03.
2. Its average price is (300 × 100.02 + 200 × 100.03) / 500 = 100.024 dollars.
3. That is $0.014 above the mid price of $100.01, against $0.0265 for the single order.
4. Over 2,000 shares, the saving is 2,000 × 0.0125 = 25 dollars.

The saving rests on the refill assumption. If the price rises between the slices, the later slices pay more, and the shortfall grows again.

## A schedule in code

The plan needs two inputs: the shares and the time window. Say you must buy 12,000 shares between 09:30 and 15:30, in slices every 30 minutes.

```python
import pandas as pd

parent = 12_000                      # shares to buy today
starts = pd.date_range("2026-03-02 09:30", "2026-03-02 15:00", freq="30min")
child = parent // len(starts)        # equal slices
schedule = pd.DataFrame({"start": starts.strftime("%H:%M"), "shares": child})
schedule.loc[schedule.index[-1], "shares"] += parent - child * len(starts)  # leftovers go last
print(len(schedule), "child orders")
print(schedule.head(3).to_string(index=False))
print("total", schedule["shares"].sum())
```

```
12 child orders
start  shares
09:30    1000
10:00    1000
10:30    1000
total 12000
```

1. The `date_range` call makes 12 start times, from 09:30 to 15:00. The last slice runs from 15:00 to 15:30.
2. Each slice gets 12,000 / 12 = 1,000 shares.
3. Integer division can leave a remainder, for example with 12,005 shares. The last slice takes it, so the total always matches.

```inkling
title "One slice at a time"
layout cycle
center "until 12,000 bought"
wait: circle "Wait 30 minutes"
send: circle "Send 1,000 shares"
fill: circle "Record the fill"
cycle wait, send, fill
note fill "the next slice starts on time, filled or not"
step 1: send "A small order goes to the market"
step 2: fill "Its fill price joins your records"
step 3: wait "The book has time to refill"
```

## Name it

**TWAP execution**, time-weighted average price execution, splits a large order into equal pieces at equal time steps across a window. Its goal is an average fill price close to the average market price over that window. Each piece is a **child order**: one of the small orders that a large order is split into. The large order is the **parent order**.

Real schedules often move each start time by a random number of seconds. Because of this, the 30-minute pattern is harder for other traders to spot.

> **Key idea:** TWAP execution buys equal child orders at equal time steps, so each small order takes only the shares waiting near the best price.

## What you have now

TWAP execution turns one parent order into a timetable of child orders, which lowers market impact when the book refills. But it buys 1,000 shares in each slice, whether 100,000 shares trade in that half hour or 20,000. Is there a better share size for each slice than an equal one?
