#!/bin/bash
npx tsc --noEmit 2>&1 | tee validation-full.log | grep "error TS" > validation-errors-only.log
echo "Total errors: $(wc -l < validation-errors-only.log)"
echo ""
echo "Error type distribution:"
cat validation-errors-only.log | sed 's/.*error \(TS[0-9]*\).*/\1/' | sort | uniq -c | sort -nr