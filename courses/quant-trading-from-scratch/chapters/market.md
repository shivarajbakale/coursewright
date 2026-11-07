# A market: where buyers and sellers agree on prices

You have a spare ticket for a sold-out concert. You want to sell it, and you have no idea what it is worth. The printed price says 25 pounds. Three people message you, and each names a different amount. Who decides the price, and how?

## Matching buyers with sellers

Think of a weekend car-boot sale. Sellers lay out what they have. Buyers walk past and say what they will pay. When a buyer and a seller agree on an amount, money changes hands. Nobody sets the price from above. The price comes from the two people who agree.

That picture holds in one important way: a price exists only because a buyer and a seller agreed on it. It stops holding in two ways. At a car-boot sale, each item is different, and one person haggles with one other person. In the markets this course studies, thousands of identical items are on offer at once. Also, people do not haggle. Each person states a price and waits, and a computer matches them.

Here is the smallest example. Three buyers each want one ticket, and three sellers each have one. Every person writes down a single price:

- A buyer writes the most they will pay: 40, 35 and 30 pounds.
- A seller writes the least they will accept: 28, 33 and 38 pounds.

A match is possible when a buyer will pay at least what a seller asks. The fair way to find the matches is to pair the keenest people first:

1. Sort the buyers from the highest price down: 40, 35, 30.
2. Sort the sellers from the lowest price up: 28, 33, 38.
3. Pair the first buyer with the first seller. The buyer pays up to 40 and the seller wants 28. Because 40 is at least 28, they agree.
4. Pair the next two. The buyer pays up to 35 and the seller wants 33. They agree too.
5. Pair the last two. The buyer pays up to 30 and the seller wants 38. Because 30 is less than 38, nobody agrees, and both wait.

```python
buyers = [40, 35, 30]   # the most each buyer will pay
sellers = [28, 33, 38]  # the least each seller will accept

buyers.sort(reverse=True)   # keenest buyer first
sellers.sort()              # cheapest seller first

for b, s in zip(buyers, sellers):
    if b >= s:
        print(f"trade at {s}: buyer pays up to {b}, seller wants {s}")
    else:
        print(f"no trade: buyer pays up to {b}, seller wants {s}")
```

```
trade at 28: buyer pays up to 40, seller wants 28
trade at 33: buyer pays up to 35, seller wants 33
no trade: buyer pays up to 30, seller wants 38
```

Each agreed match is called a trade. In this code, a trade happens at the seller's price. That is a choice for this example. In the electronic markets this course studies, a trade happens at the price of the person who was already waiting.

```inkling
title "How one trade happens"
layout sequence
buyer: person "Buyer"
mkt: box "Market"
seller: person "Seller"
buyer -> mkt : "I pay at most 40"
seller -> mkt : "I accept at least 28"
mkt -> mkt : "40 is at least 28: a match"
mkt --> buyer : "you bought at 28"
mkt --> seller : "you sold at 28"
steps auto
```

Two trades happened, at 28 and at 33. The buyer at 30 and the seller at 38 are still waiting. If a new seller arrives and accepts 30, a third trade happens at a price lower than both earlier ones. Because of this, a price is never fixed. Each new trade can set a different price.

## Naming it

A market is a place, physical or electronic, where people who want to buy something meet people who want to sell it. A trade is one agreed match: a seller hands over an item and a buyer pays one agreed price for it. The price people mention for something is the price of its most recent trade.

> **Key idea:** A market matches buyers with sellers, and every match is a trade that sets a price for that moment.

## What you have now

You now know that a price is not a label someone prints. It is the result of trades, and it changes when a new trade happens at a different amount. Concert tickets are one item people trade. The markets in this course trade something else: small pieces of companies. What exactly is one of those pieces, and why would anyone pay for it?
