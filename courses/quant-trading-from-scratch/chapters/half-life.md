# Mean-reversion half-life: how fast a gap closes

Cointegration told you that the spread of a pair returns to its mean. It did not say when. A gap that closes in 5 days and a gap that closes in 5 months need very different trades. The slow one ties up your money for months and gives the tie between the companies more time to break. So how do you put a number on the speed?

## A cup of coffee cooling

Picture a hot cup of coffee in a cool room. Each minute, the coffee loses a fixed share of its temperature gap to the room. A big gap shrinks fast at first. A small gap shrinks slowly. Because the share is fixed, the time to lose half the gap is the same whether the gap is 40 degrees or 4.

The room temperature stands for the spread's mean. The coffee's temperature stands for the spread on each day. The fixed share lost each minute stands for the pull you saw in stationarity. The picture stops holding in one place: coffee cools smoothly. A spread also gets a random push from the news every day, so it closes half its gap only on average.

## A gap that keeps 90% each day

Say the spread is 10 above its mean today, and each day it keeps 90% of its gap. With no news, the gap shrinks like this:

```inkling
title "A gap that keeps 90% each day"
layout timeline
- 0: Day 0, gap 10
- 1: Day 1, gap 9
- 3: Day 3, gap 7.29
- 6: Day 6, gap 5.31
- 7: Day 7, gap 4.78
span 6..7 "half closed"
highlight 7
step 1: 0 "The spread starts 10 above its mean"
step 2: 1 "One day keeps 90%: 10 × 0.9 = 9"
step 3: 3 "Each day multiplies the gap by 0.9 again"
step 4: 6 "After 6 days, just over half the gap is left"
step 5: 7 "By day 7 the gap is below half"
```

After 6 days the gap is 10 × 0.9⁶ = 5.31. After 7 days it is 10 × 0.9⁷ = 4.78. So half the gap closes between day 6 and day 7. To find the exact time h, solve 0.9^h = 0.5 with the logarithm:

h = ln(0.5) / ln(0.9) = −0.6931 / −0.1054 = 6.58 days

The **mean-reversion half-life** is the time a spread takes, on average, to close half its distance to the mean. With k as the share of the gap kept each day, the half-life is ln(0.5) / ln(k). A k close to 1 means a slow pull: with k = 0.99 the half-life is 69 days.

> **Key idea:** The half-life is ln(0.5) / ln(k) days, where k is the share of the spread's gap from its mean that survives each day.

## Estimating k from data

In real data you do not know k. You estimate it from the spread itself:

1. For each day, take yesterday's spread and today's change in the spread.
2. Fit the best straight line through those points. Its slope is k − 1. A pull makes the slope negative: a high spread yesterday is followed by a fall today.
3. Add 1 to the slope to get k, then compute the half-life.

The pair from cointegration was built with k = 0.9, so its true half-life is 6.58 days.

```python
# spread: the pair's spread from the cointegration example, a - 1.515 * b
yesterday = spread.shift(1).iloc[1:]          # spread on the day before
change = spread.diff().iloc[1:]               # today's spread minus yesterday's
slope, _ = np.polyfit(yesterday, change, 1)   # best straight line through the points
kept = 1 + slope                              # share of the gap kept each day
half_life = np.log(0.5) / np.log(kept)
print(f"slope {slope:.3f}  kept {kept:.3f}  half-life {half_life:.1f} days")
```

```
slope -0.082  kept 0.918  half-life 8.1 days
```

The estimate is 8.1 days, not 6.58. The daily news moves the fitted slope, even with 500 days of data. Treat a half-life as a rough guide, good to a few days here, not a timetable.

A slope of 0 or above means k is 1 or more. Then there is no pull, and the formula gives no half-life. Drop that pair.

The half-life guides two choices in a trade:

1. How long you expect to hold a position. A half-life of 8 days suggests trades of days to a few weeks.
2. How long a rolling window to use for the spread's mean. A window far shorter than the half-life chases the spread instead of measuring its level.

## What you have now

You can turn a cointegrated spread into a speed: the share k kept each day, and the half-life ln(0.5) / ln(k). You know the spread returns and roughly how fast. How do you turn that into actual buys and sells of the two stocks?
