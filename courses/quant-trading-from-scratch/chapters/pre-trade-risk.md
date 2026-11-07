# Pre-trade risk checks: blocking bad orders before they leave

An order management system sends target minus holdings minus open orders. It trusts its inputs. If a bug sets a target of 300,000 shares instead of 300, it sends an order for the difference. Once that order reaches the broker, it can trade in less than a second, and you cannot take it back. How do you stop an order like that before it leaves your program?

## A guard at the door

Picture a bank teller who must ask a manager before paying out more than $10,000. The teller does not judge whether your reason is good. The teller checks a fixed rule, and anything above the line waits for a person. The bank also has one alarm button that closes every counter at once.

Here is how the picture maps to trading:

- The teller's rule is a check that runs on every order, in code, with fixed numbers.
- The $10,000 line is a limit you set in advance, such as the largest order value you allow.
- The alarm button is a single switch that blocks every new order.

The picture stops holding in one place. A teller can phone the manager and wait. Your checks have no time to ask anyone. They must pass or block each order with no person involved. Because of this, every rule is a plain comparison with a number.

These checks are risk limits applied to one order at a time, before it trades. A stop loss acts after you hold a position. These checks act before the order exists at the broker.

## Four checks in code

The limits below are illustrative. The last price of AAA is $50.00, and you already hold $190,000 of shares.

```python
MAX_ORDER_VALUE = 50_000      # dollars in one order
MAX_PRICE_GAP   = 0.05        # limit price within 5% of the last price
MAX_EXPOSURE    = 200_000     # dollars held across all shares
kill_switch     = False

def check(qty, limit, last, exposure):
    if kill_switch:
        return "blocked: kill switch is on"
    value = abs(qty) * limit
    if value > MAX_ORDER_VALUE:
        return f"blocked: order value {value:,.0f} > {MAX_ORDER_VALUE:,}"
    if abs(limit - last) / last > MAX_PRICE_GAP:
        return f"blocked: price {limit} is {abs(limit - last) / last:.0%} from {last}"
    if exposure + value > MAX_EXPOSURE:
        return f"blocked: exposure would be {exposure + value:,.0f}"
    return "passed"

exposure = 190_000
for qty, limit in [(150, 50.10), (15_000, 50.10), (50, 501.00), (200, 50.10)]:
    result = check(qty, limit, last=50.00, exposure=exposure)
    if result == "passed":
        exposure += abs(qty) * limit
    print(f"buy {qty:>6} at {limit:>6.2f}: {result}")
kill_switch = True
print(check(10, 50.00, last=50.00, exposure=exposure))
```

```
buy    150 at  50.10: passed
buy  15000 at  50.10: blocked: order value 751,500 > 50,000
buy     50 at 501.00: blocked: price 501.0 is 902% from 50.0
buy    200 at  50.10: blocked: exposure would be 207,535
blocked: kill switch is on
```

Walk through the five orders:

1. 150 × 50.10 = 7,515 dollars. That is under every limit, and the exposure grows to 190,000 + 7,515 = 197,515.
2. Someone typed two extra zeros. 15,000 × 50.10 = 751,500 dollars, which is over 50,000, so the size check blocks it.
3. A slipped decimal point gives a limit of $501.00. The gap is (501 − 50) / 50 = 9.02, which is 902%, far over 5%.
4. 200 × 50.10 = 10,020 dollars passes the size check. Then 197,515 + 10,020 = 207,535 is over 200,000, so the exposure check blocks it.
5. With the kill switch on, the first line returns, and no other check runs.

```inkling
title "Layers an order passes"
layout stack
- Order from the system
- Kill switch
- Order size check
- Price check
- Exposure check
- Broker
brace kill-switch..exposure-check "inside your program"
step 1: order-from-the-system "The system produces an order"
step 2: kill-switch "If the switch is on, nothing passes"
step 3: order-size-check, price-check "Each order is measured on its own"
step 4: exposure-check "Then against everything you already hold"
step 5: broker "Only an order that passes every layer leaves"
highlight kill-switch
```

The checks come in a fixed order. The kill switch is first because it must work even when every other part is broken. The exposure check is last because it needs the order's value.

## Name it

Pre-trade risk checks are rules that every order must pass before it goes to the broker. A **fat finger** is a typing or input error that makes an order far larger, or far from the market price, than intended. A **kill switch** is one control that blocks every new order at once. In a real system it also cancels the open orders.

> **Key idea:** Pre-trade risk checks compare every order with fixed limits on size, price and exposure, and a kill switch blocks all orders at once.

## What you have now

You have joined the order management system and risk limits into a gate that bad orders cannot pass. Every order that leaves now stays inside the limits you set. But what if a fill report is lost, and your books say you hold 150 shares while the broker says 0?
