# A broker API: sending orders and getting fills back

In the event-driven backtester, a small function played the broker. It took each order and pushed a fill one minute later. A real broker is a separate company with its own computers. Your order travels over a network, waits in a queue at an exchange, and can trade in pieces or not at all. How does your program send an order, and how does it learn what happened to it?

## A parcel with tracking

Picture sending a parcel with a tracking number. The shop gives you the number when you hand the parcel over. After that, you do not watch the parcel. You read status updates as they arrive: received, in transit, delivered.

Here is how the picture maps to trading:

- The parcel is your order: buy or sell, how many shares, and at what limit price.
- The tracking number is the order's identifier, which you use in every later message.
- Each status update is a report from the broker, such as accepted or partly filled.

The picture stops holding in two places. A parcel arrives whole, but an order for 100 shares can fill as 60 and then 40. Also, you can ask to cancel an order, but the cancel can arrive too late, after the shares have traded.

## The states an order passes through

An order is always in one state. It moves forward only when the broker reports a change:

1. **Sent**: your program has sent the order, and the broker has not answered yet.
2. **Accepted**: the broker has the order and has passed it to the market. If the broker refuses it, for example for a bad price, the state becomes **rejected**.
3. **Partly filled**: part of the quantity has traded, and the rest is still waiting.
4. **Filled**: the whole quantity has traded.
5. **Cancelled**: the broker removed the part that had not traded.

Filled, cancelled and rejected are final. After them, no report can change the order.

```inkling
title "One order, three reports"
layout sequence
you: box "Your program"
broker: box "Broker"
mkt: box "Exchange"
you -> broker : "buy 100 at 50.00"
broker -> mkt : "passes order on"
broker --> you : "accepted"
mkt --> broker : "60 traded"
broker --> you : "partly filled 60"
you -> broker : "cancel the rest"
broker --> you : "filled 40: too late"
steps auto
```

## A tracker in code

Your side keeps a table of allowed moves. Each broker report moves the order on, and a move the table does not allow raises an error. That error means a message came in an order you did not plan for, and you want to see it.

```python
from dataclasses import dataclass

NEXT = {"sent": {"accepted", "rejected"},
        "accepted": {"partly filled", "filled", "cancelled"},
        "partly filled": {"partly filled", "filled", "cancelled"}}
# filled, cancelled and rejected are final: nothing comes after them

@dataclass
class Order:
    id: int
    qty: int
    filled: int = 0
    state: str = "sent"

    def on_report(self, new_state, fill_qty=0):   # called for each broker report
        if new_state not in NEXT.get(self.state, set()):
            raise ValueError(f"{self.state} -> {new_state} is not allowed")
        self.state, self.filled = new_state, self.filled + fill_qty
        print(f"order {self.id}: {new_state:13} filled {self.filled}/{self.qty}")

o = Order(id=1, qty=100)
o.on_report("accepted")            # the broker confirms it holds the order
o.on_report("partly filled", 60)   # 60 shares trade
# you ask to cancel the other 40, but they trade before the request arrives
o.on_report("filled", 40)
try:
    o.on_report("cancelled")
except ValueError as err:
    print("refused:", err)
```

```
order 1: accepted      filled 0/100
order 1: partly filled filled 60/100
order 1: filled        filled 100/100
refused: filled -> cancelled is not allowed
```

Walk through it:

1. The order starts as sent, with 0 of 100 shares filled.
2. The broker accepts it. Then 60 shares trade, so 60 + 0 = 60 are filled.
3. You ask to cancel the other 40. Before the request arrives, they trade: 60 + 40 = 100.
4. The order is filled, which is final. Your own code tried to mark it cancelled, and the table refused.

Because of this, you never set an order's state yourself. You record what the broker reports. A cancel is only a request.

## Name it

An API, or application programming interface, is the set of messages one program accepts from another. A broker API lets your program send, change and cancel orders, and sends back a report for each change. An **order state** is the stage an order has reached, such as accepted or partly filled. The **FIX protocol** (Financial Information eXchange) is a standard message format that brokers and exchanges share. Each message is a list of numbered fields: `35=D` means a new order, and `39=1` means partly filled.

> **Key idea:** A broker API takes your orders and reports each change of order state; your program records those reports and never guesses the state.

## What you have now

You have joined orders and fills with a broker that answers in reports. You can send one order and follow it to the end. A strategy, though, says what it wants to hold, not which orders to send. How do you turn the holdings you want into the right orders, without sending the same order twice?
