# Historical price data: past bars loaded in time order

You have a trading rule and no wish to test it with real money first. The safer test is to replay the past. You feed old prices to the rule one day at a time and record what it would have done. That replay is called a backtest. A backtest needs one input before anything else: past prices in the right order. How do you load them so the replay can trust them?

## A diary of bars

Think of a weather diary. Each page has a date and that day's readings. To ask "what happened after a cold week?", the pages must be in date order. No page can appear twice, and no page can be blank. Historical price data is that diary for one share. Each row is one price bar with its date: the open, high, low, close and volume you met with the price bar. The picture stops holding in one place. A diary records what its writer saw. A price file can contain errors that the exchange never made, so you check the file before you trust it.

In pandas, the table is a DataFrame: a table with named columns and one label for each row. Here the label of each row is its date. A row label made of dates is called a time index. With a time index, pandas can sort rows by date and select a date range, for example `bars.loc["2025-03-04":"2025-03-07"]`.

## Loading and checking ten bars

The data below is illustrative: ten made-up daily bars for an invented share with the ticker XYZ. The first two rows are in the wrong order on purpose. Files often arrive like that, for example when two downloads are joined.

```python
import io
import pandas as pd

CSV = """date,open,high,low,close,volume
2025-03-04,100.5,103.0,100.0,102.0,1500
2025-03-03,99.5,101.0,99.0,100.0,1200
2025-03-05,102.0,102.5,100.5,101.0,900
2025-03-06,101.5,104.5,101.0,104.0,1800
2025-03-07,104.5,107.5,104.0,107.0,2100
2025-03-10,107.0,107.5,105.5,106.0,1600
2025-03-11,105.5,106.0,102.5,103.0,1400
2025-03-12,102.5,103.0,98.5,99.0,2500
2025-03-13,99.5,101.5,99.0,101.0,1300
2025-03-14,101.5,104.5,101.0,104.0,1700
"""

def load_bars(text):
    bars = pd.read_csv(io.StringIO(text), parse_dates=["date"], index_col="date")
    bars = bars.sort_index()
    assert bars.index.is_unique, "two bars share a date"
    assert not bars.isna().any().any(), "a value is missing"
    assert (bars["high"] >= bars[["open", "close"]].max(axis=1)).all()
    assert (bars["low"] <= bars[["open", "close"]].min(axis=1)).all()
    return bars

bars = load_bars(CSV)
print(bars.head(3))
print(bars.index.is_monotonic_increasing, len(bars))
```

```
             open   high    low  close  volume
date
2025-03-03   99.5  101.0   99.0  100.0    1200
2025-03-04  100.5  103.0  100.0  102.0    1500
2025-03-05  102.0  102.5  100.5  101.0     900
True 10
```

The function does four steps:

1. `read_csv` turns the text into a DataFrame. `parse_dates` makes the `date` column real dates, and `index_col` makes it the time index.
2. `sort_index` puts the rows in date order. Because of this, 2025-03-03 now comes before 2025-03-04.
3. The first two checks stop the program if two rows share a date or a value is missing.
4. The last two checks test each bar. The high must be at least the open and the close. The low must be at most both.

The last line prints `True` and 10. `True` means that every date is later than the date before it. The 10 bars cover 2025-03-03 to 2025-03-14, which is two weeks of weekdays.

Why check so much before any rule sees the data? Because the replay believes every row. If two rows are in the wrong order, the rule reacts to a later price before an earlier one. If a date appears twice, one day counts twice. If a close is missing, every calculation that uses it becomes a missing value too. Each of these errors changes the result and prints no error message. An `assert` turns a silent error into a loud one, at the moment you load the file.

```inkling
title "Loading bars you can trust"
csv: icon file "CSV text"
read: box "read_csv"
sort: box "sort_index"
check: diamond "Checks pass?"
bars: db "bars\nDataFrame" green
stop: box "Stop loudly" red
csv -> read -> sort -> check
check -> bars : "yes"
check -> stop : "no"
circle check
step 1: csv "The file arrives, possibly out of order"
step 2: read "pandas turns it into a table with a time index"
step 3: sort "The rows are put in date order"
step 4: check "Each row is tested before any rule reads it"
step 5: bars, stop "Good data goes on; bad data stops the program"
```

> **Key idea:** Historical price data is a DataFrame of bars with a time index: one row per period, in strict date order, checked before any rule reads it.

## What you have now

You have the price bar from earlier, now stored as one row of a table that pandas can sort and slice by date. The table holds the past but says nothing about what to do. How does a rule turn these closes into a decision to own the share or not?
