# A market data store: keeping raw and cleaned data with timestamps

The event-driven backtester replays bars in time order, and its results are only as honest as those bars. Data vendors make mistakes and fix them later. A close price can be wrong at 4 pm and corrected the next morning. With point-in-time features you learned to use only what was known at the moment of the decision. If your table holds only the corrected price, how can a backtest know what the strategy really saw?

## Never overwrite, only add

Picture a bank statement. When the bank makes a mistake, it does not erase the wrong line. It adds a new line that corrects it, with the date of the correction. Anyone can read the statement as it stood on any date.

Here is how the picture maps to the store:

- A line on the statement is one row: one price for one day.
- The date of the line is the day the price belongs to.
- The date of the correction is the moment you learned the new value.

The picture stops holding in one place. A bank statement shows one account. A market data store holds prices for thousands of shares, and the names of those shares change over time.

A store keeps two layers. The raw layer holds every value exactly as the vendor sent it, and nothing in it is ever changed. The cleaned layer holds your fixes, such as adjusted prices or removed bad values. Each cleaned row is added with its own time. Because the raw layer is kept, you can rebuild the cleaned layer if a cleaning rule turns out to be wrong.

## Two times on every row

Each row carries the day the price belongs to and the moment you learned it. To ask what was known at a moment, keep only the rows learned by then, and take the latest one for each day.

```python
import pandas as pd

rows = pd.DataFrame({
    "id":       [7, 7, 7],
    "day":      pd.to_datetime(["2025-03-03", "2025-03-03", "2025-03-04"]),
    "known_at": pd.to_datetime(["2025-03-03 16:05", "2025-03-04 09:00",
                                "2025-03-04 16:05"]),
    "close":    [52.10, 51.90, 52.40],
})

def as_of(rows, moment):
    seen = rows[rows["known_at"] <= pd.Timestamp(moment)]
    latest = seen.sort_values("known_at").groupby(["id", "day"]).tail(1)
    return latest.set_index("day")["close"]

print(as_of(rows, "2025-03-03 18:00"))
print(as_of(rows, "2025-03-04 18:00"))
```

```
day
2025-03-03    52.1
Name: close, dtype: float64
day
2025-03-03    51.9
2025-03-04    52.4
Name: close, dtype: float64
```

The prices are made up. Follow the two questions:

1. At 18:00 on 3 March, only the first row is known. The close for 3 March is 52.10.
2. At 09:00 on 4 March, a corrected close of 51.90 arrives for 3 March. The first row stays in the table.
3. At 18:00 on 4 March, three rows are known. For 3 March the latest is 51.90, and 4 March has 52.40.

A strategy that traded on the evening of 3 March saw 52.10. A backtest that asks `as_of` the decision time gets 52.10 too. If you had overwritten the row, the backtest would use 51.90, a price nobody had at that moment. That is look-ahead bias hidden inside the data.

```inkling
title "One close, two versions"
layout timeline
- 1: Close 52.10 arrives on 3 March
- 2: Strategy decides with 52.10
- 3: Correction to 51.90 next morning
- 4: Research asks as of 3 March
span 1..2 "what was known that evening"
highlight 4
step 1: 1 "The vendor's first close is stored with its arrival time"
step 2: 2 "The strategy acts on what it has"
step 3: 3 "The fix is added as a new row, not written over the old one"
step 4: 4 "A query as of 3 March still returns 52.10"
```

## Names change too

The shares in the example have the stable number 7, not a ticker. Companies change tickers, and an old ticker can later go to a different company. So the store keeps a separate table that says which ticker meant which number between which dates. For example, number 7 traded as OLDCO until 3 March 2025 and as NEWCO from 4 March 2025.

## Name it

A store is **bitemporal** when every row has two times: when the fact was true, and when you recorded it. **Symbology** is the mapping between the names a share has had, such as tickers, and the stable identifier your store uses for it.

> **Key idea:** A market data store adds rows and never overwrites them, so every query can ask what was known at a given moment.

## What you have now

You have joined point-in-time features with a store that remembers every version of every price. The strategy can now see the right data. Next it must act: how does an order leave your program and reach the market, and how do you hear what happened to it?
