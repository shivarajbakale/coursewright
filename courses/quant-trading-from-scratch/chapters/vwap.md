# VWAP execution: trading more when the market trades more

TWAP execution bought the same number of shares in every slice. But the market does not trade the same amount every hour. In US stocks, for example, volume is highest near the open and the close, and lowest around midday. An equal slice is a large part of a quiet hour and a small part of a busy one. How do you size each slice to the market around it?

## Hide in the crowd

Picture a railway station. At rush hour, a person who carries a large suitcase through the hall goes almost unseen. At 03:00, the same person is the only traveller anyone notices. The crowd stands for the market's volume. The suitcase stands for your order. To stay unseen, you move when the crowd is large.

The picture stops holding at the timetable. Rush hour at a station comes at the same time each day. Market volume follows a pattern only on average, and one news report can change any single day.

## A plan from past days

You estimate the pattern from past days. To keep the numbers small, take a made-up market that is open for six hours, from 10:00 to 16:00. Here are three past days of volume, in thousands of shares per hour.

```python
import pandas as pd

hours = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"]
past = pd.DataFrame(  # shares traded in each hour, in thousands
    [[260, 150, 110, 100, 140, 240],
     [200, 130, 120, 120, 160, 270],
     [200, 140, 100, 110, 150, 300]], columns=hours)
profile = past.div(past.sum(axis=1), axis=0).mean()  # share of each day, averaged
plan = (12_000 * profile).round().astype(int)
print(profile.round(2).to_dict())
print(plan.to_dict())
```

```
{'10:00': 0.22, '11:00': 0.14, '12:00': 0.11, '13:00': 0.11, '14:00': 0.15, '15:00': 0.27}
{'10:00': 2640, '11:00': 1680, '12:00': 1320, '13:00': 1320, '14:00': 1800, '15:00': 3240}
```

1. `past.div(past.sum(axis=1), axis=0)` turns each day into fractions. On the first day, the 10:00 hour traded 260 of 1,000 thousand shares: 0.26.
2. `.mean()` averages each hour over the three days. For 10:00 that is (0.26 + 0.20 + 0.20) / 3 = 0.22.
3. The plan gives each hour its fraction of your 12,000 shares. For 10:00, 12,000 × 0.22 = 2,640 shares.
4. The six hours add up to 12,000 shares.

Now say today's market trades 1,000,000 shares in this pattern. In the 10:00 hour it trades 220,000 shares, and in the 12:00 hour 110,000. Compare the share of each hour's volume that is yours:

1. TWAP execution buys 2,000 shares every hour. That is 2,000 / 220,000 = 0.91% at 10:00, and 2,000 / 110,000 = 1.82% at 12:00.
2. The new plan buys 2,640 at 10:00 and 1,320 at 12:00. Both are 1.2% of the hour's volume.

```inkling
title "Equal slices against volume-sized slices"
layout compare
columns "TWAP", "VWAP"
row "Shares at 10:00": "2,000", "2,640"
row "Shares at 12:00": "2,000", "1,320"
row "Your part at 12:00": "1.82%", "1.2%"!
row "Same part every hour": no, yes
step 1: shares-at-10-00 "In the busy hour, the volume plan buys more"
step 2: shares-at-12-00 "In the quiet hour, it buys less"
step 3: your-part-at-12-00 "Equal slices are a large part of a quiet hour"
step 4: same-part-every-hour "The volume plan stays an equal part of each hour"
```

## Name it

The **volume profile** is the fraction of a day's volume that trades in each part of the day, averaged over past days. **VWAP execution** sizes each child order by the volume profile, so your part of the market stays the same all day. VWAP means volume-weighted average price: the total paid for all trades, divided by the total shares traded. If 100 shares trade at $10.00 and 300 at $10.10, the VWAP is (100 × 10.00 + 300 × 10.10) / 400 = 10.075 dollars. The goal of VWAP execution is an average fill price close to the market's VWAP over the same hours.

> **Key idea:** VWAP execution splits an order by the volume profile, so you trade most when the market trades most and stay a steady part of the crowd.

## What you have now

TWAP execution and VWAP execution both turn a parent order into child orders. They differ only in how each child order is sized. Both make the same promise: a fill price close to an average of the market. After the trade, how do you check whether they kept it, and what each trade really cost?
