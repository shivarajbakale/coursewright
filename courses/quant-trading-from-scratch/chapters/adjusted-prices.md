# Adjusted prices: prices corrected for splits and dividends

Look-ahead bias was about when a rule reads the data. This lesson is about what the data says. You load historical price data for a share and see the close fall from $100.00 to $50.50 in one day. That is a return of -49.5%. Did shareholders really lose half their money that day?

## Two events that move the price without a loss

Two company events change the price of a share without changing what a shareholder owns.

A **stock split** divides each share into more shares. In a 2-for-1 split, every old share becomes 2 new shares, and each new share is worth half as much. Picture cutting a pizza into 16 slices instead of 8. You have twice as many slices, and each is half the size, but you have the same amount of pizza. The slices stand for shares, and the pizza stands for what you own in the company. The picture stops holding in one way: a pizza cannot change its size overnight, but the share price can also move on the split day.

A **dividend** is cash the company pays to its shareholders for each share they hold. On the first day a new buyer no longer gets the payment, the price drops by about the size of the dividend. The cash has left the company and gone to the shareholders.

## Correcting the history

Here is a 2-for-1 split that takes effect on 6 March:

```python
import pandas as pd

dates = pd.date_range("2024-03-04", periods=5, freq="B")
raw = pd.Series([98.0, 100.0, 50.5, 51.0, 50.0], index=dates)
split_day = dates[2]                      # a 2-for-1 split takes effect here

factor = pd.Series(1.0, index=dates)
factor[dates < split_day] = 0.5           # one old share became 2 new shares
adjusted = raw * factor

print(pd.DataFrame({"raw": raw, "adjusted": adjusted,
                    "raw ret": raw.pct_change(),
                    "adj ret": adjusted.pct_change()}).round(4))
```

```
              raw  adjusted  raw ret  adj ret
2024-03-04   98.0      49.0      NaN      NaN
2024-03-05  100.0      50.0   0.0204   0.0204
2024-03-06   50.5      50.5  -0.4950   0.0100
2024-03-07   51.0      51.0   0.0099   0.0099
2024-03-08   50.0      50.0  -0.0196  -0.0196
```

Step by step:

1. Before the split, one share cost $100.00. After it, the same holding is 2 shares at $50.50, worth 2 × 50.50 = $101.00.
2. The raw return on 6 March says -49.5%. That is false. The holder's money went from $100.00 to $101.00, a gain of 1.00%.
3. The fix multiplies every price before the split by 0.5. Now 5 March reads $50.00, in the same units as the new shares.
4. The adjusted return on 6 March is 50.50 / 50.00 - 1 = 1.00%, the true return. The other days are unchanged.

```inkling
title "Fixing a split in the history"
raw: box "Raw closes"
find: diamond "Split or\ndividend?"
scale: box "Scale earlier\nprices"
adj: box "Adjusted closes" green
ret: box "Returns"
raw -> find
find -> scale : "yes"
scale -> adj
adj -> ret
highlight adj
step 1: raw "The raw closes contain a false drop"
step 2: find "Find each split and dividend date"
step 3: scale "Multiply every earlier price by the factor"
step 4: adj, ret "Returns from the adjusted series are true"
```

A dividend gets the same treatment with a different factor. Say a share closes at $50.00, pays a $1.00 dividend, and closes next day at $49.50. The raw return is -1.00%. Your real return is (49.50 + 1.00) / 50.00 - 1 = 1.00%, because you also received the dollar. Data vendors use the factor 1 - 1.00 / 50.00 = 0.98 for earlier prices. Then the adjusted return is 49.50 / 49.00 - 1 = 1.02%, close to the 1.00% you earned.

## Which price for which job

Each series has its own job:

1. Use adjusted prices for returns, signals and the equity curve. Because adjusted prices remove the false jumps, the returns match what a holder earned.
2. Use raw prices for orders and fills. On 5 March you would have paid $100.00 for one share, not $50.00.
3. Do not write rules on adjusted price levels, such as "buy below $50". Each later split rescales the whole past, so the levels depend on events after the decision.

> **Key idea:** Adjusted prices are a price history rescaled at each split and dividend, so returns from them match what a shareholder really earned.

## What you have now

Clean returns now come from adjusted prices, and raw prices still decide what each order costs. Both kinds of price exist only for companies that still have a price history to fetch. Companies that went bankrupt or stopped trading may be missing from the data altogether. What does testing only the companies that are still around do to a result?
