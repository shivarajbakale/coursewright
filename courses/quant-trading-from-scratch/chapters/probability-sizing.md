# Sizing from probability: turning a predicted chance into a position

Purged cross-validation gives you an honest probability of up for each test day. A probability is not a trade. On a day the model says 0.55, and on another day it says 0.70. How much should you hold on each day?

## Confidence decides the stake

Think of a friend who offers you even-money bets on coin tosses. If the coin is fair, the right stake is zero. If you somehow knew it landed heads 70% of the time, you would bet more than if it landed heads 52% of the time. So the stake should grow with the distance from 0.5, not with the probability itself.

Here, the coin is the next trade and its bias is the model's probability. The picture stops holding in one place. You know a coin's bias exactly once you have measured it. The model's probability is an estimate that can be wrong, so you bet less than the picture says.

## From probability to position

You have the tools already. As you saw with the Kelly criterion, the best stake is f = p − q / b. A bet that wins or loses the same amount has b = 1, so f = p − (1 − p) = 2p − 1. Fractional Kelly says to bet a part of that, because the odds are guesses. Risk limits say no position may pass a fixed cap.

Say your labels use lines at +5% and -5%. Each trade then gains or loses about 5% of the money in it. Follow these steps for each day:

1. Compute the edge: `2p - 1`.
2. Multiply by a quarter, your fraction of Kelly. This is the share of equity you choose to risk.
3. Divide by 0.05, because each 1 of position risks 0.05 of it.
4. Clip the result to the cap: at most 100% of equity, long or short.

```inkling
title "From a probability to a position"
layout down
p: box "Probability of up"
edge: box "Edge: 2p - 1"
frac: box "Quarter of Kelly"
pos: box "Divide by 5% risk"
cap: box "Cap at 100%" orange
p -> edge -> frac -> pos -> cap
step 1: p "The model gives a probability from purged cross-validation"
step 2: edge "Distance from a coin flip, on a scale of -1 to 1"
step 3: frac "Bet a quarter, because the probability is an estimate"
step 4: pos "Turn the risked share into a position size"
step 5: cap "The risk limit has the last word"
highlight edge
```

Here is the rule in code:

```python
import numpy as np

barrier = 0.05        # labels use lines at +5% and -5%
kelly_share = 0.25    # bet a quarter of Kelly
cap = 1.0             # risk limit: at most 100% of equity, long or short

def position(p):
    edge = 2 * p - 1                       # Kelly's share of equity to risk on an even bet
    risked = kelly_share * edge            # the share we choose to risk
    return np.clip(risked / barrier, -cap, cap)   # each 1 of position risks 0.05

for p in [0.50, 0.52, 0.55, 0.60, 0.70, 0.45]:
    print(f"p = {p:.2f}  position = {position(p):+.0%}")
```

```
p = 0.50  position = +0%
p = 0.52  position = +20%
p = 0.55  position = +50%
p = 0.60  position = +100%
p = 0.70  position = +100%
p = 0.45  position = -50%
```

Walk through p = 0.55:

1. The edge is 2 × 0.55 - 1 = 0.1.
2. A quarter of it is 0.25 × 0.1 = 0.025, so you risk 2.5% of equity.
3. The position is 0.025 / 0.05 = 0.5, or 50% of equity, long.

At p = 0.70, the rule asks for 0.25 × 0.4 / 0.05 = 2, which is 200% of equity. The cap cuts it to 100%. At p = 0.45, the edge is negative, so the position is a short of 50%.

Two warnings follow from the steps:

- A trade that ends at the time line gains or loses less than 5%. The bet is then not exactly even, and the true Kelly share is smaller. This is one more reason to bet a fraction.
- Only use probabilities from test folds. On its own training days, a model looks more certain than it is, and every size grows with it.

## Name it

Sizing from probability means making the position grow with the distance between the predicted probability and 0.5. A fraction of Kelly sets how fast it grows, and a risk limit caps it.

> **Key idea:** Size each position from how far the model's out-of-sample probability is from a coin flip, scaled down by a Kelly fraction and capped by a risk limit.

## What you have now

You joined the classification model, purged cross-validation, fractional Kelly and risk limits into one rule that says how much to hold each day. That rule assumes the prediction is still useful by the time you trade. How quickly does a prediction lose its value after it is made?
