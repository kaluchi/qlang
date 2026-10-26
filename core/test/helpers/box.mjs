// [QSBLD#kind]

// [QSSYN#line]
export const lines = (...steps) => steps.join('\n| ');

export const BOX = lines(
  ':Box |~~ A parcel. ~~| (::kind | holds :LengthNotPositiveError |~~ A box has a length. ~~| ~(get /0 | gt 0))',
  ':Box/put |~~ The same box with another weight inside. ~~| (::fn | takes :weight |~~ The weight to put inside. ~~| /0 | holds :WeightNotANumberError |~~ The weight is a number. ~~| ~(weight | tag | eq ::number) | impl ~(within ~(take 1 | append weight)))',
  ':Box/tally |~~ The lead and the rest. ~~| (::fn | takes :lead |~~ The lead, null when left out. ~~| ~(query /0) | takes :rest |~~ The values after the lead. ~~| ~(drop 1) | impl ~(get [~(lead) ~(rest)]))',
  ':Box/past |~~ An index past the end. ~~| ~(get /9)',
  ''
);
