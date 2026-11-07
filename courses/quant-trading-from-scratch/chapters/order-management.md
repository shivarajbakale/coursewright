# An order management system: turning target positions into orders

A broker API takes one order and reports its state until the order is final. Your strategy does not think in orders, though. It says what it wants to hold: 300 shares of AAA and none of BBB. Between that wish and the broker sits a gap. You may already hold 100 shares of AAA, and an order for 50 more may still be waiting. If your program crashes and starts again, it must not buy the same shares a second time. How do you get from "what I want" to "what to send"?

## Count what is already on the way

Picture a kitchen that wants 12 eggs on the shelf. The cook counts 4 on the shelf. An order for 6 more was placed this morning and has not arrived. So the cook orders 12 − 4 − 6 = 2 eggs, not 8. If the cook checks again an hour later, the 2 are on the order list too, and the answer is 0.

Here is how the picture maps to trading:

- The 12 eggs wanted are the target position.
- The 4 on the shelf are your holdings, the shares you own now.
- The 6 on the way are open orders: sent and accepted, not yet filled.

The picture stops holding in one place. Eggs never go negative. In trading a negative difference means you must sell, and a target below zero is a short position.

## The difference, in code

The rule for each share is one subtraction: target minus holdings minus open orders. The result is the order to send. A positive number is a buy and a negative number is a sell.

```python
targets  = {"AAA": 300, "BBB": 0}
holdings = {"AAA": 100, "BBB": 50}
open_orders = [{"symbol": "AAA", "qty": 50}]   # bought, not yet filled

def orders_needed(targets, holdings, open_orders):
    pending = {}
    for o in open_orders:
        pending[o["symbol"]] = pending.get(o["symbol"], 0) + o["qty"]
    out = []
    for sym, want in targets.items():
        diff = want - holdings.get(sym, 0) - pending.get(sym, 0)
        if diff != 0:
            out.append({"symbol": sym, "qty": diff})   # + buy, - sell
    return out

first = orders_needed(targets, holdings, open_orders)
print("run 1:", first)
open_orders += first                                 # they are now waiting
print("run 2:", orders_needed(targets, holdings, open_orders))
```

```
run 1: [{'symbol': 'AAA', 'qty': 150}, {'symbol': 'BBB', 'qty': -50}]
run 2: []
```

Walk through it:

1. AAA: the target is 300, you hold 100, and 50 are on the way. So 300 − 100 − 50 = 150 to buy.
2. BBB: the target is 0 and you hold 50. So 0 − 50 − 0 = −50, which means sell 50.
3. The two new orders join the open orders.
4. The second run finds 300 − 100 − 200 = 0 for AAA and 0 − 50 + 50 = 0 for BBB. It sends nothing.

The second run is the case that matters. A crash and a restart, or a timer that fires twice, runs the same step again. Because open orders are part of the sum, the repeat sends nothing new.

```inkling
title "From wanted to sent"
targets: box "Targets\nAAA 300" yellow
hold: box "Holdings\nAAA 100"
open: box "Open orders\nAAA 50"
diff: diamond "Target − held\n− open"
send: box "Send\nbuy AAA 150" green
targets -> diff
hold -> diff
open -> diff
diff -> send : "only the gap"
note send "large orders can go out as child orders"
step 1: targets "The strategy says what it wants to hold"
step 2: hold, open "The system counts what you own and what is on the way"
step 3: diff "It subtracts both from the target"
step 4: send "Only the difference goes to the broker"
```

The difference can still be large. Then the system can hand it to TWAP execution, which splits it into child orders over time. Those child orders count as open orders too.

## Name it

An order management system is the part of a trading system that holds the targets, the holdings and every open order. It compares them and sends only the difference to the broker. **Idempotency** means that doing the same step twice has the same effect as doing it once. Here, a second run with no new fills sends no second order.

Brokers help with this too. Each order carries an identifier that your system chooses. If the same identifier arrives twice, the broker refuses the second copy.

> **Key idea:** An order management system sends target minus holdings minus open orders, so a repeated run never sends the same order twice.

## What you have now

You have joined the broker API and child orders into a system that turns wishes into orders. It sends whatever the subtraction gives. If a bug sets a target of 300,000 instead of 300, it sends that too. What stops a bad order before it leaves?
