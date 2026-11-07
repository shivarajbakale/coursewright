# A signal: a rule that turns data into a view

You now have ten bars in date order. They tell you what happened, but not what to do. As you saw with strategy families, a trend rule bets that a move continues. How do you write that bet as code that the replay can run on every bar?

## A thermostat for your view

A thermostat reads the room temperature and decides "heat on" or "heat off". It does not heat anything itself. A signal does the same job for trading. It reads the data known so far and returns the direction you want. In this lesson, +1 means "I want to own the share" and 0 means "I want to own none". The temperature stands for the prices, and "heat on" stands for +1. The picture stops holding in one place. A thermostat reads only the present. A signal can read the whole past up to the current bar, but never a bar after it.

The trend rule here uses a moving average. A moving average is the mean of the last n closes, recomputed at every bar. With n = 3, the moving average on 2025-03-06 is (102 + 101 + 104) / 3 = 102.33. The rule says: when the close is above its 3-bar moving average, the price is rising, so the signal is +1. Otherwise the signal is 0.

## The rule on ten bars

This code continues from the `bars` table you loaded with historical price data.

```python
def trend_signal(closes, window=3):
    """+1 when the latest close is above its moving average, else 0."""
    average = closes.rolling(window).mean()
    signal = (closes > average).astype(int)
    signal[average.isna()] = 0          # not enough history yet: no view
    return signal

table = bars[["close"]].copy()
table["average"] = bars["close"].rolling(3).mean().round(2)
table["signal"] = trend_signal(bars["close"])
print(table)
```

```
            close  average  signal
date
2025-03-03  100.0      NaN       0
2025-03-04  102.0      NaN       0
2025-03-05  101.0   101.00       0
2025-03-06  104.0   102.33       1
2025-03-07  107.0   104.00       1
2025-03-10  106.0   105.67       1
2025-03-11  103.0   105.33       0
2025-03-12   99.0   102.67       0
2025-03-13  101.0   101.00       0
2025-03-14  104.0   101.33       1
```

Read the table from the top:

1. The first two days have no average (`NaN`), because 3 closes are needed. The rule has no history, so it gives 0.
2. On 2025-03-05 the average is (100 + 102 + 101) / 3 = 101.00. The close of 101 is not above it, so the signal is 0.
3. On 2025-03-06 the close of 104 is above 102.33. The signal turns +1.
4. On 2025-03-11 the close of 103 is below (107 + 106 + 103) / 3 = 105.33. The signal falls back to 0.
5. On 2025-03-13 the close of 101 equals the average of 101.00. "Above" is false, so the signal is 0. A rule must say what a tie means, and this rule picks 0.

The signal changes 3 times in 10 bars: up on 2025-03-06, down on 2025-03-11 and up again on 2025-03-14.

```inkling
title "The trend signal in March 2025"
layout timeline
- 5: Equal, signal 0
- 6: Above, signal +1
- 10: Still above, +1
- 11: Below, signal 0
- 13: Equal, signal 0
- 14: Above, signal +1
span 6..10 "want to own"
step 1: 5 "On the 5th the average equals the close, so no view"
step 2: 6 "On the 6th the close rises above its average"
step 3: 10 "The view holds while the close stays above"
step 4: 11 "On the 11th a fall below the average ends the view"
step 5: 13 "On the 13th a tie counts as not above"
step 6: 14 "On the 14th the close rises above again"
```

## Only the data known so far

A signal for a date must use only bars up to that date. `rolling(3)` looks at the current row and the 2 rows before it, never at later rows. You can test that property directly:

```python
full = trend_signal(bars["close"])
upto = trend_signal(bars["close"].loc[:"2025-03-07"])
print(full["2025-03-07"], upto["2025-03-07"])
```

```
1 1
```

The signal for 2025-03-07 is 1 with all 10 bars and also with only the first 5. If adding later bars changed an earlier signal, the rule would be reading the future. A replay of that rule would then trade on information that nobody had at the time.

> **Key idea:** A signal is a function from the data known up to a bar to the direction or size you want, here +1 or 0.

## What you have now

You have joined the trend idea to historical price data: a function that gives one view per bar. A view of +1 is a wish, not shares in an account. What do you actually hold when the signal says +1, and how does holding it earn or lose money?
