# Risk limits: rules that cap losses and concentration

Volatility targeting keeps risk near a level you choose, as long as recent volatility predicts tomorrow. Sometimes it does not. A price can fall 20% overnight on news, and a bug can send an order 10 times too large. Sizing rules trust their estimates, so they cannot see what the estimates miss. What protects the account then?

## Fuses in the wiring

Picture the fuse box in a house. You choose your appliances and how long to run them, like your sizing rules choose positions. A fuse does not care why the current is too high. When the current passes a fixed number, it cuts the circuit. The fuse stands for a risk limit, the current for the money at risk, and the cut for refusing or closing trades. The picture stops holding in one place. A fuse acts at once. A limit acts only when your code next checks it, and prices can jump past it first.

Here are five limits for an account of 100,000. The numbers are illustrative; you choose your own before you trade.

1. **Position limit.** No single position is worth more than 25% of equity, 25,000.
2. **Gross exposure limit.** Exposure is the total value of your positions as a share of equity. Gross exposure counts longs and shorts both as positive, and it may not pass 100%.
3. **Stop loss.** A stop loss closes a position when its price moves a fixed amount against you. Here the amount is 8% below the entry price.
4. **Daily loss limit.** If today's loss reaches 2% of equity, 2,000, you open no new trades until tomorrow.
5. **Drawdown limit.** If equity falls 15% below its peak, you cut every position to half. After a peak of 120,000 that happens at 120,000 × 0.85 = 102,000.

Each limit works at a different scale, from one order up to the whole history of the account:

```inkling
title "Limits from one order to the whole account"
layout stack
- Position limit 25%
- Gross exposure limit 100%
- Stop loss 8%
- Daily loss limit 2%
- Drawdown limit 15%
brace position-limit-25..gross-exposure-limit-100 "before each order"
brace stop-loss-8..drawdown-limit-15 "while you hold"
step 1: position-limit-25 "No single position above a quarter of equity"
step 2: gross-exposure-limit-100 "All positions together within equity"
step 3: stop-loss-8 "A losing position is closed"
step 4: daily-loss-limit-2 "A bad day stops new trades"
step 5: drawdown-limit-15 "A long fall halves everything"
```

## Checking an order against the limits

Say you hold four positions. A is 24,000 long, B is 20,000 short, C is 22,000 long and D is 18,000 long. Gross exposure is 24,000 + 20,000 + 22,000 + 18,000 = 84,000. Net exposure counts shorts as negative: 24,000 − 20,000 + 22,000 + 18,000 = 44,000. Your signal now asks to buy 30,000 of a fifth asset, E.

```python
def allowed_buy(amount, holdings, equity, max_position=0.25, max_gross=1.0):
    """How much of a new long position the limits allow, in money."""
    gross = sum(abs(v) for v in holdings.values())     # longs and shorts both count
    room_position = max_position * equity
    room_gross = max_gross * equity - gross
    return max(0.0, min(amount, room_position, room_gross))

holdings = {"A": 24_000, "B": -20_000, "C": 22_000, "D": 18_000}   # negative = short
print(allowed_buy(30_000, holdings, equity=100_000))
```

```
16000.0
```

1. The position limit cuts 30,000 to 25,000.
2. The gross limit leaves room for 100,000 − 84,000 = 16,000.
3. The smaller room wins, so the order goes out for 16,000, not 30,000.

The function never asks whether E is a good trade. That is on purpose. A limit sits outside the strategy, so a bug in the strategy cannot switch it off.

Limits have costs. The stop loss sends a market order when the price reaches 50 × 0.92 = 46. If the price opens at 43 after bad news, the fill is at 43 or worse. The loss is (43 − 50) / 50 = −14%, not −8%. Stop losses also sell after a fall, so a mean reversion strategy can lose its edge to them. Test each limit inside the backtest, never add it only for live trading.

> **Key idea:** Risk limits are fixed rules outside the strategy that cap position size, exposure and loss, so no single estimate, bug or bad day can end the account.

## What you have now

You can now size a strategy and cap its damage, using volatility targeting for the normal days and drawdown limits for the bad ones. All of this assumes the edge is real. A backtest with a Sharpe ratio of 1 looks like an edge. How sure can you be that it is not luck?
