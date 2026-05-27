const template = `Review $1.

Focus on:
- correctness
- missing tests
- safety issues

Extra instructions: $ARGUMENTS`;

function expand(templateText, args) {
  return templateText
    .replaceAll("$ARGUMENTS", args.join(" "))
    .replace(/\$(\d+)/g, (_, index) => args[Number(index) - 1] ?? "");
}

console.log(expand(template, ["the staged diff", "be", "strict"]));
