# Point-in-time features: inputs built only from what was known then

You have tested rules that you wrote by hand. Now you want a program to find the rule for you from past data. That program needs inputs for every date: numbers it can look at before it decides. Which numbers is it allowed to look at on a given date?

## A forecaster with a clock

Picture a weather forecaster who writes tomorrow's forecast at 6 a.m. The forecaster may use every reading taken before 6 a.m. A rain gauge read at 9 a.m. does not exist yet. A thermometer reading corrected at noon does not exist yet either. At 6 a.m., the forecaster only has the first, uncorrected value.

In trading, the forecast is your decision on a date, and the readings are the data. The picture stops holding in one place. Market data arrives later than the period it describes, and the delay differs from one data source to the next.

## Known on which day

A company reports its sales for each quarter of the year. The report for the quarter that ends on 31 March does not appear on 31 March. In this made-up example, it is published on 25 April. Later, the company corrects it. A changed figure that replaces an earlier one is a **revision**.

Here is the history, with the date each number became public:

| Quarter | Published | Sales |
| --- | --- | --- |
| December 2023 | 25 Jan 2024 | 95 |
| March 2024 | 25 Apr 2024 | 100 |
| June 2024 | 25 Jul 2024 | 110 |
| March 2024 (revised) | 10 Aug 2024 | 96 |

Your input is sales growth: the newest quarter's sales divided by the quarter before, minus 1. To compute it honestly on a date, follow these steps:

1. Keep only the rows published on or before that date.
2. For each quarter, keep the newest version of its figure.
3. Divide the newest quarter by the one before it, and subtract 1.

```python
import pandas as pd

reports = pd.DataFrame({
    "quarter":   ["2023-12", "2024-03", "2024-06", "2024-03"],
    "published": pd.to_datetime(["2024-01-25", "2024-04-25", "2024-07-25", "2024-08-10"]),
    "sales":     [95.0, 100.0, 110.0, 96.0],   # last row: March revised
})

def growth_as_of(date):
    known = reports[reports["published"] <= pd.Timestamp(date)]
    newest = known.sort_values("published").groupby("quarter")["sales"].last()
    return newest.iloc[-1] / newest.iloc[-2] - 1

for d in ["2024-05-15", "2024-07-01", "2024-08-01", "2024-08-15"]:
    print(d, f"{growth_as_of(d):.2%}")
```

```
2024-05-15 5.26%
2024-07-01 5.26%
2024-08-01 10.00%
2024-08-15 14.58%
```

On 15 May, you know 100 and 95, so growth is 100 / 95 - 1 = 0.0526, or 5.26%. On 1 July, the June figure is not public yet, so growth stays 5.26%. On 1 August, it is 110 / 100 - 1 = 0.10. After the revision on 10 August, it becomes 110 / 96 - 1 = 0.1458.

```inkling
title "When each number became known"
layout sequence
co: box "Company"
db: db "Your data"
you: person "Your rule"
co -> db : "March: 100 (25 Apr)"
co -> db : "June: 110 (25 Jul)"
co -> db : "March revised: 96 (10 Aug)"
db -> you : "only rows published by today"
steps auto
```

Now compare a common shortcut. A data file downloaded today holds only the final figures, dated by the quarter's last day. It says March sales were 96 from 31 March. That file gives growth of 96 / 95 - 1 = 0.0105 on 15 May. On 1 July, it gives 110 / 96 - 1 = 0.1458, 24 days before anyone knew the June figure. This is look-ahead bias again. Here, it hides inside the data file, not inside your code, so a `shift` of one bar does not fix it.

## Name it

A **feature** is one input number your rule sees for each date, such as sales growth. The **publication lag** is the time between the end of the period a number describes and the day it becomes public. Here it is 25 days.

> **Key idea:** A point-in-time feature uses only the values that were published before the decision, in the version that existed on that day.

## What you have now

You can build inputs that respect look-ahead bias, even when data arrives late and changes later. For a cross-section of companies, you repeat this for each company on each date. The next question is the other side: what answer should the program learn to give?
