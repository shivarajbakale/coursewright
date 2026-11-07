# Market-neutral portfolios: longs and shorts that cancel market risk

Beta splits a stock's return into a market part and its own part. Say you believe company A will do better than company B. You do not have a view on the market. But if you buy A and the market falls 5%, you lose money even if you were right about A. How do you keep the bet on A against B and remove the bet on the market?

## Two boats tied together

Go back to the boats on the tide. You own one boat, A, and you owe the harbour one boat, B. When the tide rises, A lifts you up and B lifts what you owe by the same amount. The tide's effect cancels. What remains is how each boat bobs on its own waves.

Here, owning a boat stands for a long position. Owing one stands for a short position: as you saw with short selling, you gain when B falls. The picture stops holding because the cancelling is exact only when the two sizes match the two betas. The betas are estimates, so in practice the cancelling is close, not perfect.

## Sizing the two legs

Stock A has beta 1.2 and stock B has beta 0.8. You put $10,000 long in A. How much should you short in B?

The market part of a position is its notional times its beta. That product is its market exposure in dollars.

1. The long leg's market exposure is $10,000 × 1.2 = $12,000.
2. The short leg must have the same exposure: $12,000 / 0.8 = $15,000 short in B.
3. The net market exposure is $12,000 - $12,000 = $0.

Now say the market falls 5%. Stock A's market part is 1.2 × -5% = -6%, a loss of $600 on the long. Stock B's market part is 0.8 × -5% = -4%. B falls, so the short gains $600. The two cancel.

Next add each company's own news. A rises 2% on its own and B falls 1% on its own.

```python
beta_a, beta_b = 1.2, 0.8
long_a = 10_000                       # dollars held long in A
short_b = long_a * beta_a / beta_b    # dollars sold short in B
print(f"short B: ${short_b:,.0f}")

own_a, own_b = 0.02, -0.01            # each company's own news
for market in (-0.05, 0.0, 0.05):
    ret_a = beta_a * market + own_a
    ret_b = beta_b * market + own_b
    pnl = long_a * ret_a - short_b * ret_b
    print(f"market {market:+.0%}: profit ${pnl:,.0f}")
```

```
short B: $15,000
market -5%: profit $350
market +0%: profit $350
market +5%: profit $350
```

The profit is $350 whatever the market does. It is $10,000 × 2% = $200 from A's own rise, plus $15,000 × 1% = $150 from B's own fall.

Compare the simpler choice of equal dollars on both sides, $10,000 long and $10,000 short. Its net market exposure is $12,000 - $8,000 = $4,000. Because of this, a 5% market fall costs $4,000 × 5% = $200 of the bet.

```inkling
title "Equal dollars or equal beta"
layout compare
columns "Equal dollars", "Equal beta"
row "Short in B": "$10,000", "$15,000"
row "Net market exposure": "$4,000", "$0"!
row "Market falls 5%": "$100 profit", "$350 profit"
row "Market rises 5%": "$500 profit", "$350 profit"
step 1: short-in-b "Size the short leg two ways"
step 2: net-market-exposure "Only equal beta cancels the market part"
step 3: market-falls-5 "With equal dollars, a falling market eats the bet"
step 4: market-rises-5 "With equal beta, the result does not depend on the market"
```

## Naming it

A **hedge** is a position you hold to cancel a risk in another position. Here, the short in B hedges the market risk of the long in A. A **market-neutral portfolio** holds longs and shorts sized so that the beta-weighted exposures add to 0. What remains is a bet on the spread between the two sides: the longs' own returns minus the shorts' own returns.

Neutral does not mean free or safe. The short leg pays borrow costs every day. The betas drift, so the hedge needs checking. And if A does worse than B on its own news, the portfolio loses whatever the market does.

> **Key idea:** A market-neutral portfolio sizes longs and shorts so their beta-weighted exposures cancel, leaving only a bet on the longs beating the shorts.

## What you have now

With beta and short selling together, you can remove the market from a bet and keep the part you have a view on. So far you picked A and B by hand. With 500 stocks, you need a way to decide which ones belong on the long side and which on the short side, on each date. How do you compare that many stocks with each other?
