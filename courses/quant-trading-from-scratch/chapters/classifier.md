# A classification model: predicting the chance of up or down

You have features as questions and labels as answers, one pair for each day. Now you want a program that reads a new day's features and says how likely "up" is. How does a program learn that from past pairs?

## Learning a rule from examples

A **model** is a formula with adjustable numbers in it. It turns features into an answer. **Training** is choosing those numbers so the formula agrees with past labels as well as possible.

Think of a new doctor learning to read X-rays. A teacher shows 700 X-rays with the diagnosis written on each. The doctor adjusts their judgement after each one. Then the teacher tests the doctor on 300 X-rays the doctor has never seen. Only that test score tells you how good the doctor is. The picture stops holding in one place: the doctor learns patterns in bone, which change slowly. Market patterns are weak and change over time, so a good test score today can fade.

## A straight line bent into a chance

With linear regression, you fitted a line: a score `a + b × x`, with a starting value `a` and a slope `b`. A line can give any number, such as 3.2 or -7. A chance must lie between 0 and 1. So you pass the score through a squashing function: `1 / (1 + e^(-score))`. Here `e` is the number 2.718, the base of the natural logarithm. A score of 0 becomes 0.5. A large positive score comes close to 1, and a large negative score comes close to 0.

To train it, you need a penalty for each example. The penalty is `-log(p)`, where `p` is the chance the model gave to the label that really happened. Here `log` is the natural logarithm, `np.log` in Python. Say the model gives "up" a chance of 0.6:

1. If the day went up, the penalty is -log(0.6) = 0.511.
2. If the day went down, the chance it gave to "down" was 0.4, so the penalty is -log(0.4) = 0.916.
3. A model that always says 0.5 pays -log(0.5) = 0.693 every day.

Training picks the `a` and `b` that make the average penalty smallest. A model that cannot beat 0.693 knows nothing a coin does not.

```inkling
title "How training adjusts the numbers"
layout cycle
center "repeat until the penalty stops falling"
guess: circle "Choose a and b"
predict: circle "Chance of up per day"
score: circle "Average penalty"
adjust: circle "Change a and b"
cycle guess, predict, score, adjust
step 1: guess "Start from a guess, such as a = 0 and b = 0"
step 2: predict "The formula gives a chance for each training day"
step 3: score "Compare each chance with the label that happened"
step 4: adjust "Move a and b in the direction that lowers the penalty"
highlight score
```

Here is the whole process on 1,000 made-up days with one feature. The first 700 days are for training, and the last 300 are kept back for the test. `scipy`'s `minimize` does the repeated adjusting.

```python
import numpy as np
from scipy.optimize import minimize

rng = np.random.default_rng(0)
x = rng.normal(size=1000)                          # one feature per day
up = rng.random(1000) < 1 / (1 + np.exp(-0.5 * x)) # label: True = up

def prob_up(params, x):
    a, b = params
    return 1 / (1 + np.exp(-(a + b * x)))

def penalty(params, x, up):
    p = prob_up(params, x)
    return -np.mean(np.where(up, np.log(p), np.log(1 - p)))

train, test = slice(0, 700), slice(700, 1000)
fit = minimize(penalty, x0=[0.0, 0.0], args=(x[train], up[train]))
print("a, b:", fit.x.round(3))
print("train penalty:", round(fit.fun, 4))
print("test penalty: ", round(penalty(fit.x, x[test], up[test]), 4))
print("P(up) if x = 1:", prob_up(fit.x, 1.0).round(3))
```

```
a, b: [-0.022  0.431]
train penalty: 0.6715
test penalty:  0.6842
P(up) if x = 1: 0.601
```

Read the output in order:

1. Training found `a = -0.022` and `b = 0.431`. A higher feature means a higher chance of up.
2. On the training days, the penalty is 0.6715.
3. On the 300 test days, the penalty is worse: 0.6842. It is still below the coin's 0.6931, so the model learned something real.
4. For a day with feature 1, the score is -0.022 + 0.431 = 0.409, and the chance of up is 0.601.

The gap between 0.6715 and 0.6842 is the out-of-sample lesson again. Only the **test set**, the examples kept out of training, gives an honest score.

## Name it

A **probability** is a number from 0 to 1 that says how often an outcome happens over many repeats. A model whose labels are categories, such as up or down, is a classification model. **Logistic regression** is the classification model you built: a straight-line score squashed into a probability.

> **Key idea:** A classification model learns its numbers from labelled training examples and outputs a probability, and only its score on unseen test examples counts.

## What you have now

You joined features, labels and linear regression into a model that outputs a chance of up. You tested it once, on the last 300 days. One split is one result, and those 300 days may be lucky. How do you test on every part of the history without letting neighbouring labels leak answers across the split?
