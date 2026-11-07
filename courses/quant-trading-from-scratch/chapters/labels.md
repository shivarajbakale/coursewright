# Labels: what the model is asked to predict

You can now build point-in-time features: inputs that use only what was known on each date. A program that learns from examples also needs the answer for each example. On a given day, what counts as the right answer?

## Writing the answer key first

Think of a teacher who marks a quiz. Before marking, the teacher writes an answer key. If the key says "rain within 24 hours", a forecast of rain at 11 p.m. is right. If the key says "rain at noon tomorrow", the same forecast is wrong. The forecaster did not change. The key did.

In trading, the answer key is a fixed rule that looks at prices after the decision day and gives one answer for that day. The picture stops holding here: a teacher can mark today, but your answer for a day is only known once the following days have passed.

## Two answer keys for the same prices

Here are 11 made-up closing prices, from day 0 to day 10:

```python
import pandas as pd

close = pd.Series([100.0, 101.0, 102.5, 101.8, 103.0, 104.2,
                   103.5, 102.0, 100.5, 99.0, 98.4])   # day 0 to day 10

def fixed_horizon_label(close, t, horizon):
    ret = close.iloc[t + horizon] / close.iloc[t] - 1
    return 1 if ret > 0 else -1

def triple_barrier_label(close, t, horizon, barrier):
    for day in range(t + 1, t + horizon + 1):
        ret = close.iloc[day] / close.iloc[t] - 1
        if ret >= barrier:
            return 1, day        # upper barrier first
        if ret <= -barrier:
            return -1, day       # lower barrier first
    return 0, t + horizon        # time ran out

print(fixed_horizon_label(close, 0, 10))
print(triple_barrier_label(close, 0, 10, 0.04))
```

```
-1
(1, 5)
```

The first key asks: is the return from day 0 to day 10 positive? It is 98.4 / 100 - 1 = -0.016, a loss of 1.6%. So the answer is -1, meaning "down".

The second key draws three lines around the day-0 price and asks which line the price touches first:

1. An upper line at 100 × 1.04 = 104, a 4% gain.
2. A lower line at 100 × 0.96 = 96, a 4% loss.
3. A time line at day 10.

The code checks the days in order. On day 5, the price is 104.2, a return of 4.2%. That is above the upper line, so the answer is +1, meaning "up", and the code stops looking. If the price had touched neither line by day 10, the answer would be 0.

```inkling
title "One price path, two answers"
layout compare
columns "Return after 10 days", "First line touched"
row "Looks at": "day 10 only", "days 1 to 10 in order"
row "Result": "-1.6%", "+4.2% on day 5"
row "Answer": "-1 (down)", "+1 (up)"
row "Matches a stop loss": no, yes!
step 1: looks-at "Each key looks at different days"
step 2: result "The price path gives a loss at day 10 but touched +4% first"
step 3: answer "So the two keys give opposite answers"
step 4: matches-a-stop-loss "Only the barriers match a trader with a stop loss"
```

The same prices give opposite answers. Neither key is wrong. They ask different questions. The second key matches how you would trade with a 4% profit target and a 4% stop loss, as you saw with risk limits. A trader with those rules exits on day 5 with a gain, so "up" describes what that trader got.

## Name it

The **label** is the answer your rule should learn to give for one example. The **horizon** is how many bars ahead the label may look: here, 10. A **triple-barrier label** is +1, -1 or 0, depending on whether the upper line, the lower line or the time line is touched first.

> **Key idea:** A label is the answer key you fix before any learning, and it is the one place where prices after the decision day are allowed.

Because of that, a label must never become a feature. Also note that the labels of day 0 and day 1 share 9 of their 10 days. Neighbouring labels are not independent answers.

## What you have now

For each day, you have point-in-time features as the question and a label as the answer. The label looks a fixed horizon into the future, so you know it only after that horizon has passed. The next question is how a program learns from thousands of these question-answer pairs, and what it gives back.
