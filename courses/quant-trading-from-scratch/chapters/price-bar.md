# A price bar: one period's open, high, low and close

As you saw with a market, every trade sets a price. A busy share can trade tens of thousands of times in one day. A trading rule that looks back over a year cannot read every one of those trades, and most rules do not need to. You need a short summary of each hour or each day. Which few numbers keep what matters?

## A weather report for prices

Think of a daily weather report. It does not list the temperature every minute. It gives the high and the low for the day. A gardener can plan with those two numbers alone.

A price summary works the same way, with two more numbers. For one period of time, you keep four prices:

1. The open: the price of the first trade in the period.
2. The high: the highest trade price in the period.
3. The low: the lowest trade price in the period.
4. The close: the price of the last trade in the period.

You also keep one count. The volume is the total number of shares traded in the period. A move on high volume had many traders behind it. A move on low volume had few.

The weather picture stops holding in one place. A temperature exists even when nobody measures it. A price exists only when a trade happens. If no trade happens in a period, the period has no prices at all.

## Six trades, two bars

Here are six illustrative trades in one share, in time order:

| Time | Price | Shares |
| --- | --- | --- |
| 10:02 | 100.10 | 200 |
| 10:15 | 100.40 | 100 |
| 10:31 | 99.80 | 300 |
| 10:48 | 100.20 | 400 |
| 11:05 | 100.30 | 150 |
| 11:40 | 100.90 | 250 |

Group them by hour. The 10:00 hour has the first four trades:

1. The open is the first price, 100.10.
2. The high is the largest price, 100.40.
3. The low is the smallest price, 99.80.
4. The close is the last price, 100.20.
5. The volume is 200 + 100 + 300 + 400 = 1000 shares.

The 11:00 hour has two trades. Its open is 100.30 and its close is 100.90. Its high is 100.90 and its low is 100.30, and its volume is 150 + 250 = 400 shares.

pandas does this grouping for you. Index the trades by time, then ask for one row per hour:

```python
import pandas as pd

trades = pd.DataFrame({
    "time": pd.to_datetime(["2024-03-01 10:02", "2024-03-01 10:15", "2024-03-01 10:31",
                            "2024-03-01 10:48", "2024-03-01 11:05", "2024-03-01 11:40"]),
    "price": [100.10, 100.40, 99.80, 100.20, 100.30, 100.90],
    "shares": [200, 100, 300, 400, 150, 250],
}).set_index("time")

bars = trades["price"].resample("1h").ohlc()
bars["volume"] = trades["shares"].resample("1h").sum()
print(bars)
```

```
                      open   high    low  close  volume
time                                                   
2024-03-01 10:00:00  100.1  100.4   99.8  100.2    1000
2024-03-01 11:00:00  100.3  100.9  100.3  100.9     400
```

`resample("1h")` puts every trade into the hour it falls in. `ohlc()` takes the open, high, low and close of each group. The same code with `"1D"` gives one row per day.

```inkling
title "One hour of trades becomes one bar"
layout timeline
- Open: first trade, 100.10 at 10:02
- High: top trade, 100.40 at 10:15
- Low: bottom trade, 99.80 at 10:31
- Close: last trade, 100.20 at 10:48
span open..close "one bar, volume 1000"
step 1: open "The first trade of the hour sets the open"
step 2: high "The highest trade sets the high"
step 3: low "The lowest trade sets the low"
step 4: close "The last trade sets the close"
```

## Naming it

A price bar is the summary of all trades in one period: its open, high, low and close prices, and its volume. The four prices are often written OHLC, from their first letters. A bar keeps the range of prices but loses their order. From the 10:00 bar alone, you cannot tell whether the high came before the low.

> **Key idea:** A price bar summarises every trade in one period by its open, high, low and close prices and the volume traded.

## What you have now

A share's price history is now a list of bars, one per hour or per day. The closes from one bar to the next tell you how the price moved. In the 11:00 bar, the price rose from 100.30 to 100.90, a rise of 0.60. Is a rise of 0.60 a big move or a small one?
