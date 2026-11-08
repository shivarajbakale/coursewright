# Tool call: the model asks your program to act

A language model writes text one token at a time. That is all it can give you. Ask for the weather in Paris, and it can write "I cannot check the weather" or guess a number. It cannot open a weather service, read a file or run a query. The text is the whole reply.

Think of a clerk at a desk with no telephone. The clerk writes an errand and a place on a note, then hands the note to a runner. The runner leaves, does the errand and returns with an answer on a slip. The clerk reads the slip and writes the reply. In the picture, the clerk knows what each errand means. The model knows a function only from the description and the argument schema your program gives it.

To ask for help, the model needs a list of functions it may request. Each function has a tool schema: a name, a description and a JSON Schema of its arguments. A JSON Schema is a small JSON description of the fields, their types and which fields are required.

```json
{
  "name": "get_weather",
  "description": "Current weather for one city",
  "parameters": {
    "type": "object",
    "properties": { "city": { "type": "string" } },
    "required": ["city"]
  }
}
```

Suppose the user asks for the weather in Paris. The exchange has these steps:

1. Your program sends the question and the tool schema to the model.
2. The model replies with a call: `get_weather` and `{ "city": "Paris" }`. The call has an id, here `call_1`.
3. Your program reads the call and decides to run it. It sends Paris to a weather service.
4. The service returns "18 C, cloudy". Your program now needs to tell the model.
5. Your program sends a tool result: "18 C, cloudy", with `call_1` as its id.
6. The model reads the result and writes its answer: "In Paris it is 18 C and cloudy."

```inkling
title "How a tool call works"
layout sequence
you: person "You"
app: box "Program"
model: box "Model"
weather: box "Weather service"
you -> app : "Weather in Paris?"
app -> model : "Question and tool schema"
model -> app : "Call get_weather, city Paris"
app -> weather : "Ask for Paris"
weather --> app : "18 C, cloudy"
app --> model : "Result for call_1"
note model "writes the answer from this"
steps auto
```

The model never runs the function. It only writes the request. Your program checks the name, checks the arguments and chooses whether to run anything at all. That control matters: a call to delete a table can be refused before it touches the database.

These steps have names. The model's request is a **tool call**. The form that describes the function is its **tool schema**. The outcome your program sends back is the **tool result**. The id on the result matches it to the call it answers.

> **Key idea:** The model writes a request to run a named function; your program runs it and sends back the result.

## How pi does it

pi describes a tool to a model as an object with `name`, `description` and `parameters` (packages/ai/src/types.ts:771-776). A reply whose content contains blocks of type `toolCall` is a tool call. pi selects those blocks by filtering the message content for that type.

## What you have now

You know that a model can ask for an action instead of writing an answer, and that your program stays in charge of running it. One exchange like this is useful. Most tasks need several: the model reads a result, asks for another tool, and repeats.
