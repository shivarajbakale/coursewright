# A position: how much of an asset you hold

On 2025-03-06 your signal says +1. That is a wish, and a wish earns nothing. Money changes hands only when you hold something. So how much do you hold, and how does holding it turn price changes into gains and losses?

## The tickets in your drawer

Picture 10 concert tickets in your drawer. Their resale price rises by 3 each. Your tickets are now worth 10 × 3 = 30 more, whether you sell them or not. The number of tickets stands for the number of shares you hold. The resale price stands for the share price. The picture stops holding in one place. A ticket count cannot go below zero, but a position can. A negative position means you owe shares, and that idea needs a full explanation of its own.

A position is the signed number of shares you hold of one asset. It is the position, not the signal, that earns returns. Two small words describe it:

- You are long when the position is above zero. You own shares, so you gain when the price rises and lose when it falls.
- You are flat when the position is zero. You gain and lose nothing, whatever the price does.

The gain from holding a position over one day is the shares held times the change in the close. For 10 shares and a close that moves from 104 to 107, the gain is 10 × (107 − 104) = 30.

## From signal to position

For now, a signal of +1 means "hold 10 shares", and 0 means "hold none". To keep this first version short, pretend you can trade at the close of the day you decide. A position decided at one close is then held through the next day.

```python
closes = bars["close"]
position = trend_signal(closes) * 10          # shares held after each close
held = position.shift(1).fillna(0)            # what you held during each day
pnl = held * closes.diff().fillna(0) + 0      # held shares x price change

table = pd.DataFrame({"close": closes, "position": position,
                      "held": held, "pnl": pnl})
print(table)
print("total:", pnl.sum())
```

```
            close  position  held   pnl
date
2025-03-03  100.0         0   0.0   0.0
2025-03-04  102.0         0   0.0   0.0
2025-03-05  101.0         0   0.0   0.0
2025-03-06  104.0        10   0.0   0.0
2025-03-07  107.0        10  10.0  30.0
2025-03-10  106.0        10  10.0 -10.0
2025-03-11  103.0         0  10.0 -30.0
2025-03-12   99.0         0   0.0   0.0
2025-03-13  101.0         0   0.0   0.0
2025-03-14  104.0        10   0.0   0.0
total: -10.0
```

The column `pnl` is the gain or loss of each day. (The `+ 0` turns pandas' "−0.0" into a plain 0.0.) Follow the rows in order:

1. On 2025-03-06 the signal turns +1 and you buy 10 shares at the close of 104. You held nothing during that day, so its gain is 0.
2. On 2025-03-07 you hold 10 shares and the close moves from 104 to 107. The gain is 10 × 3 = 30.
3. On 2025-03-10 the close moves from 107 to 106. The loss is 10 × (106 − 107) = −10.
4. On 2025-03-11 the close moves from 106 to 103, a loss of 10 × (103 − 106) = −30. At that close the signal drops to 0, so you sell and are flat.
5. On 2025-03-14 you buy 10 shares again at 104. You held nothing during the day, so the gain is 0.

The total is 30 − 10 − 30 = −10. The same result comes from the one round trip: you bought at 104 and sold at 103, so 10 × (103 − 104) = −10. The rule was right that the price rose, but it bought after part of the rise and sold after part of the fall.

Why is `held` the position moved one row down? Each day's gain belongs to the shares you held during that day. Those are the shares you chose at the previous close. If you multiplied today's change by today's new position, you would collect a move that happened before you bought.

```inkling
title "A wish versus shares held"
layout compare
columns "Signal", "Position"
row "What it is": "a view", "shares held"
row "On 2025-03-06": "+1", "10 shares"
row "Unit": "direction", "shares"
row "Earns money": no, yes
step 1: what-it-is "The signal is a view; the position is what you own"
step 2: on-2025-03-06 "A view of +1 becomes 10 shares"
step 3: unit "One is a direction, the other a count"
step 4: earns-money "Only the shares you hold gain or lose"
```

> **Key idea:** A position is the signed number of shares you hold, and each day it earns the shares held times the price change.

## What you have now

You turned the signal into a position, and the position into a daily gain or loss. The rule is either long or flat, so it earns only when the price rises. When the trend points down, being flat earns nothing. Can a position earn money from a fall?
