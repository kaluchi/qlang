# QSNUM · The words of numbers

Arithmetic over finite doubles, and the words that combine values one
subject computes. The requirements of each section are the cases of its
file under `core/test/conformance/QSNUM/`.

## arithmetic

`add`, `sub`, `mul` and `div` take the number in the pipe as their
subject and one number as their object; `mod` answers the remainder with
the sign of the divisor; `floor`, `ceil`, `abs` and `round`, with a
count of digits, take a number to a whole one, its size or its rounding.
Every answer is a finite double: one past the doubles is refused as
`::number/NotFiniteError`, and a division by zero under the divisor,
`::number/div/divisor/ZeroError`. `range` answers the whole numbers from
zero below its subject.

```qlang
> 10 | add 5 | mul 2 | sub 10
20

> get [~(7 | mod 3) ~(-7 | mod 3) ~(7 | mod -3)]
[1 2 -2]

> get [~(2.7 | floor) ~(2.1 | ceil) ~(-3 | abs) ~(2.567 | round 2)]
[2 3 3 2.57]

> 1e308 | mul 10 !| type
::number/NotFiniteError

> 10 | div 0 !| type
::number/div/divisor/ZeroError

> 5 | range
[0 1 2 3 4]
```

## combine

The subject of a call is the value in the pipe, always: no count of
modifiers turns the first of them into the subject, and a call that
gives more objects than its word reads is refused, its refusal naming
what fits. Values one subject computes are combined by a word that
serves any value, `sumOf`, `subOf`, `mulOf` and `divOf`, its objects all
the values it combines, each read against the subject.

```qlang
> 1 | add 1 2 !| type
::number/add/ArgsBeyondInputsError

> {:price 4 :qty 3} | mulOf /price /qty
12
```
