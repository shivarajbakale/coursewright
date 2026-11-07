# A factor portfolio: long the top group, short the bottom group

Cross-sectional ranking gives you, on each date, a view of every stock relative to the others. A market-neutral portfolio lets you bet on one side beating the other without betting on the market. Put the two together. Which stocks should you hold long, which short, and how do you tell whether the ranking has any value at all?

## Picking teams by height

Picture a gym teacher who lines up 10 pupils by height. The teacher splits the line into 5 groups of 2. Then the tallest group plays the shortest group at basketball. If height helps at basketball, the tall team should win more games than it loses. If it does not, the results look like coin flips.

In this picture, height stands for your score, the pupils stand for stocks, and a game stands for one month of returns. The picture stops holding in one place. One game proves little, and one month proves even less. You must play the match over many months before the result means anything.

## Ten stocks, one month

Each stock has a score from any signal you choose. Here the scores are made up. You sort the stocks into 5 groups by score and look at each stock's return over the following month.

```python
import pandas as pd
stocks = pd.DataFrame({
    "score": [0.9, -0.4, 0.2, 1.5, -1.1, 0.0, 0.7, -0.8, 1.2, -0.2],
    "next_return": [2.1, -0.5, 0.4, 3.0, -1.8, 0.9, 1.1, 0.2, 1.4, -0.6],  # % next month
}, index=list("ABCDEFGHIJ"))
stocks["group"] = pd.qcut(stocks["score"], 5, labels=[1, 2, 3, 4, 5])
by_group = stocks.groupby("group", observed=True)["next_return"].mean()
print(by_group)
print(f"factor return: {by_group[5] - by_group[1]:.2f}%")
```

```
group
1   -0.80
2   -0.55
3    0.65
4    1.60
5    2.20
Name: next_return, dtype: float64
factor return: 3.00%
```

Walk through it:

1. `pd.qcut(..., 5)` cuts the 10 scores into 5 groups with 2 stocks each. Group 5 holds the highest scores: D and I. Group 1 holds the lowest: E and H.
2. The top group returned (3.0 + 1.4) / 2 = 2.2% on average next month.
3. The bottom group returned (-1.8 + 0.2) / 2 = -0.8% on average.
4. Long the top and short the bottom earns 2.2 - (-0.8) = 3.0% for the month.
5. In dollars, put $10,000 long, split equally over D and I. Put $10,000 short, split over E and H. The long side earns $10,000 × 2.2% = $220. The short side gains $10,000 × 0.8% = $80, because those stocks fell on average. The total is $300.

The middle groups are not traded, but they are still useful. Here the 5 group averages rise in order from -0.80% to 2.20%. A steady rise is better evidence than a big gap between the two ends alone.

```inkling
title "Five groups, two traded"
layout stack
- Group 5 long
- Group 4
- Group 3
- Group 2
- Group 1 short
brace group-4..group-2 "not traded"
note group-5-long "highest scores"
note group-1-short "lowest scores"
highlight group-5-long
step 1: group-5-long "Hold the highest-scoring group long"
step 2: group-4, group-3, group-2 "Watch the middle groups without trading them"
step 3: group-1-short "Sell the lowest-scoring group short"
```

## Naming it

A **quantile** is one of a set of equal-sized groups made by sorting values. Five groups are quintiles, and ten are deciles. A **factor** is a characteristic shared across many assets that explains part of why their returns differ. Company size is one example. A **factor portfolio** holds the top quantile long and the bottom quantile short, so its return is the top group's return minus the bottom group's. Fama and French (1993) built published factors this way, for company size and for how cheap a share is.

The two equal-dollar legs are market-neutral only if their average betas match. If the top group has beta 1.3 and the bottom group 0.9, size the legs by beta as you did before. Two more cautions apply. One month with 10 stocks tells you nothing; a real test uses hundreds of stocks over years, and checks the t-statistic of the monthly returns. And the legs change every month, so turnover and transaction costs come out of every month's return.

> **Key idea:** A factor portfolio sorts assets into quantiles by a characteristic, goes long the top group and short the bottom, and earns the gap between them.

## What you have now

You can turn any score into a factor portfolio and measure its return month by month. The question now is which score to use. One score has a long published record: how much each stock rose over the past year. Does a stock that rose most keep rising, and how exactly should you measure "rose most"?
