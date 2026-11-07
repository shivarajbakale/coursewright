# Purged cross-validation: testing folds that cannot see each other

Your classification model scored well on one block of 300 test days. One block is one result, and it may be a lucky stretch. You want a score from every part of the history. How do you test on all of it without giving the model the answers?

## Taking turns as the test

**Cross-validation** splits the examples into equal blocks, and each block takes one turn as the test set. In each turn, the model trains on the other blocks. You then average the test scores. Walk-forward testing only trains on the past. Cross-validation also trains on blocks that come after the test block, so every block gets tested.

Think of a class of five study groups that share one exam. Each group sits the exam once while the other four groups write the questions. The picture stops holding in one place. Students in nearby groups talk to each other in the hallway. If they talk, the questions leak.

## Where the leak comes from

Here, the hallway is the horizon of your labels. With a horizon of 10 days, the example for day `t` uses prices from day `t` to day `t + 10`. Take a test block of days 40 to 59.

1. The training example for day 38 has a label that looks at days 38 to 48.
2. The test example for day 45 has a label that looks at days 45 to 55.
3. Both labels contain the price moves of days 45 to 48.

Say a jump on day 46 makes both labels "up". The model learned from day 38 that this pattern went up. It then "predicts" day 45 correctly because it saw part of that answer in training. The test score looks better than any score on new days will.

The fix is to remove training examples whose days overlap the test block's days. Removing them is called purging. A test block of days 40 to 59 touches prices up to day 59 + 10 = 69. So every training example from day 30 to day 69 overlaps, and you drop it.

One more leak runs the other way. A feature can look back, such as the return over the past 5 days. A training example on day 72 then uses prices from days 67 to 72. Days 67 to 69 are inside the test labels. So you also drop the 5 days after the last overlapping day: days 70 to 74.

```python
import numpy as np

n, horizon, k, embargo = 100, 10, 5, 5
days = np.arange(n)                  # example t uses prices from day t to day t + 10

def purged_split(fold):
    test = days[fold * 20:(fold + 1) * 20]
    start, end = test[0], test[-1] + horizon      # every day the test examples touch
    overlaps = (days + horizon >= start) & (days <= end)
    after = (days > end) & (days <= end + embargo)
    train = days[~overlaps & ~after]
    return train, test

for fold in range(k):
    train, test = purged_split(fold)
    print(fold, f"test {test[0]}-{test[-1]}", "train size", len(train))
```

```
0 test 0-19 train size 65
1 test 20-39 train size 55
2 test 40-59 train size 55
3 test 60-79 train size 55
4 test 80-99 train size 70
```

Follow the middle block, days 40 to 59:

1. The overlap covers days 30 to 69: 40 days, including the 20 test days.
2. The extra gap covers days 70 to 74: 5 days.
3. Training keeps 100 - 40 - 5 = 55 examples.

```inkling
title "One turn of purged cross-validation"
layout down
t1: box "Train: days 0-29" green
p1: box "Purged: days 30-39" gray
test: box "Test: days 40-59" yellow
p2: box "Purged: days 60-69" gray
gap: box "Embargo: days 70-74" gray
t2: box "Train: days 75-99" green
t1 -> p1 -> test -> p2 -> gap -> t2
step 1: test "One block takes its turn as the test"
step 2: p1, p2 "Drop examples whose 10-day labels touch the test days"
step 3: gap "Drop 5 more days after it, for features that look back"
step 4: t1, t2 "Train on what is left: 55 examples"
highlight test
```

## Name it

A **fold** is one of the equal blocks the examples are split into: here, 5 folds of 20 days. The **embargo** is the extra gap of days dropped after each test fold. Purged cross-validation is cross-validation where every training example that overlaps a test fold, or sits inside its embargo, is removed.

> **Key idea:** Purged cross-validation tests every fold in turn and removes the training examples whose labels or features share days with the test fold.

## What you have now

You can now score a model on every part of the history, and the labels' horizon no longer leaks answers. The output for each test day is an honest probability of up. The next question is what to do with it: how much should you buy when the model says 0.60?
