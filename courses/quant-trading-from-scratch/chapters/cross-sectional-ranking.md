# Cross-sectional ranking: comparing assets with each other on one date

A market-neutral portfolio needs two sides: stocks you expect to do better, and stocks you expect to do worse. A signal looks at one asset over time and says "up" or "down". With 500 stocks, that gives you 500 separate yes-or-no views. How do you turn them into "these are better than those" on each date?

## Judging a race, not a stopwatch

Think of a school sports day. A stopwatch rule says "a runner is fast if they finish under 15 seconds". On a windy day, nobody does. On a day with a tailwind, everybody does. A judge who ranks the runners in each race always finds a first place and a last place, whatever the wind.

Here, each runner stands for a stock, the wind stands for the whole market's move, and one race stands for one date. Ranking compares stocks with each other, so a move that pushes every stock up together does not change the order. The picture stops holding in one place. A race has a clear winner, but a stock's rank says nothing about its own future. A rank is only useful if your measure really predicts the next return, and you must test that.

## Five stocks on two dates

Your measure is each stock's return over the past 20 days, in percent. On the first date, the market went up and all 5 stocks rose. On the second, all 5 fell.

```python
import pandas as pd
# past 20-day return of each stock, in %, on two dates (illustrative)
past = pd.DataFrame(
    {"A": [8.0, -1.0], "B": [3.0, -6.0], "C": [5.0, -2.5],
     "D": [12.0, -4.0], "E": [1.0, -9.0]},
    index=pd.to_datetime(["2024-03-28", "2024-04-30"]),
)
ranks = past.rank(axis=1)                  # 1 = lowest, 5 = highest, per row
views = ranks.sub(ranks.mean(axis=1), axis=0)
print(ranks)
print(views)
```

```
              A    B    C    D    E
2024-03-28  4.0  2.0  3.0  5.0  1.0
2024-04-30  5.0  2.0  4.0  3.0  1.0
              A    B    C    D    E
2024-03-28  1.0 -1.0  0.0  2.0 -2.0
2024-04-30  2.0 -1.0  1.0  0.0 -2.0
```

Walk through it:

1. Each row of the DataFrame holds every stock's value on one date. The method `rank(axis=1)` ranks along the row, so it compares stocks with each other, never one stock with its own past.
2. On the first date, D rose most (12%) and gets rank 5. E rose least (1%) and gets rank 1.
3. Subtracting the row's mean rank, 3, centres the ranks on 0. Positive means "better than the others" and negative means "worse".
4. On the second date, every stock fell. A fell only 1%, so it has the highest rank (5) and a view of +2.

A rule of "buy if the past return is positive" would buy all 5 stocks on the first date and none on the second. Ranking gives 2 stocks to favour and 2 to avoid on both dates. The centred views add to 0 on every row, which suits a long side and a short side of equal size.

Ranks have a second benefit. Raw values can have one extreme stock, such as a 60% jump after news. A rank caps that stock at first place, so it cannot outweigh the rest. If two stocks tie, `rank` gives both the average of their places.

```inkling
title "From one date's values to relative views"
layout down
row: box "One date's values"
measure: box "Measure per stock"
order: box "Rank within the date"
centre: box "Subtract the mean rank"
views: box "Relative views" green
row -> measure -> order -> centre -> views
highlight order
step 1: row "Take every stock on the same date"
step 2: measure "Compute the same measure for each"
step 3: order "Rank the stocks against each other"
step 4: centre "Centre the ranks so they add to 0"
step 5: views "Positive means better, negative means worse"
```

## Naming it

A **cross-section** is the set of values of every asset in your universe on one date: one row of the DataFrame. **Cross-sectional ranking** ranks the assets by a measure within each cross-section. It turns a signal into relative views.

The row must hold every stock that was in the universe on that date. As you saw with survivorship bias, a row that leaves out companies delisted later makes the past look better than it was.

> **Key idea:** Cross-sectional ranking compares every asset with the others on the same date, so a move of the whole market does not change the views.

## What you have now

You can turn one measure into a ranking on each date, with positive and negative views that add to 0. The next question is how to trade those views. Which stocks go long, which go short, and how much of each?
