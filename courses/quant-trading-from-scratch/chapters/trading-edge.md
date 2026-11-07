# A trading edge: a repeatable advantage that survives costs

With the Sharpe ratio you can score a strategy's past results. But a good score over a few months can be luck. A coin that lands heads 7 times in 10 is not a better coin. What does a strategy need so that its good results keep coming?

## The casino's small advantage

Picture a roulette wheel with 37 pockets, numbered 0 to 36. You bet 1 on a single number. If it comes up, the casino pays 35 and you keep your 1. Suppose each pocket comes up once in 37 spins:

1. You lose 36 spins, which costs you 36 × 1 = 36.
2. You win 1 spin, which pays you 35.
3. Overall you are down 36 − 35 = 1 for every 37 bets, which is 1 / 37 = 2.70% of each bet.

That 2.70% is small. Any one night, a player can win. But the casino takes millions of bets, so the small tilt adds up to a reliable profit.

In this picture, the casino stands for a trader with an edge, and each bet stands for one trade. The picture stops holding in two places. The casino knows its 2.70% exactly from the shape of the wheel. A trader can only estimate an advantage from past data, and may be wrong. Also, a wheel never changes, but other traders can copy an advantage until it shrinks.

## An edge must survive costs

Here is a made-up trading rule. Out of every 100 trades, it wins 52 and loses 48. Each win gains 1% and each loss loses 1%. Each trade is one round trip, so it pays the bid-ask spread once.

1. Before costs, the average trade gains (52 × 1 − 48 × 1) / 100 = 0.04%.
2. If a round trip costs 0.02% in spread, the average trade nets 0.04% − 0.02% = 0.02%.
3. If a round trip costs 0.05%, the average trade nets 0.04% − 0.05% = −0.01%. Now the rule loses money.
4. Over 200 trades a year, adding the trades, that is 200 × 0.02% = 4% in the first case and 200 × −0.01% = −2% in the second.

```python
wins, losses = 52, 48            # out of every 100 trades
move = 1.0                       # each trade gains or loses 1%
gross = (wins * move - losses * move) / 100     # average % per trade

for spread in (0.02, 0.05):      # cost of one round trip, in %
    net = gross - spread
    print(spread, round(gross, 2), round(net, 2), round(net * 200, 1))
```

```
0.02 0.04 0.02 4.0
0.05 0.04 -0.01 -2.0
```

The rule is the same in both cases. Only the cost changed. A real edge is small, so costs decide whether it exists at all.

## Where an edge comes from

A rule that wins on old prices is not enough. You also want a reason it should keep winning. Most reasons fall into 3 groups:

1. **Behaviour.** People make the same mistakes again and again. For example, a holder who panics after bad news may sell below a fair price.
2. **Risk.** Investors who want to avoid a risk pay others to carry it. A **risk premium** is the extra return you earn for holding a risk that others do not want. Shares have to offer more than safe bills, or nobody would accept the chance that their price falls.
3. **Market rules.** Rules make a trader buy or sell at a set time, whatever the price. For example, a fund that copies a list of shares must buy a share on the day it joins the list.

```inkling
title "Where an edge comes from"
layout mindmap
- A trading edge
  - Behaviour
    - Panic selling
  - Risk
    - Paid to carry it
  - Market rules
    - Forced buying
  - Must beat costs
step 1: a-trading-edge "An edge is a small tilt that repeats"
step 2: behaviour, panic-selling "People repeat the same mistakes"
step 3: risk, paid-to-carry-it "Carrying a risk others avoid gets paid"
step 4: market-rules, forced-buying "Rules force trades at set times"
step 5: must-beat-costs "Whatever the source, it must be bigger than costs"
circle must-beat-costs
```

## Name it

A **trading edge** is a small advantage that repeats over many trades and stays positive after costs. A good edge also has a reason to last: behaviour, a risk premium, or a market rule.

> **Key idea:** An edge is a small, repeatable tilt in your favour that survives costs, and it comes from behaviour, from being paid for risk, or from market rules.

## What you have now

You know what a strategy needs to keep earning: a small advantage that beats the bid-ask spread, with a reason behind it. Edges of this kind are not all different. Most strategies make one of a small number of bets about how prices move. What are those bets?
