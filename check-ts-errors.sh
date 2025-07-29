#!/bin/bash
# Script to run TypeScript compiler and collect errors

echo "Running TypeScript compiler to collect errors..."
./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "error TS6231" | grep -E "\.ts\([0-9]+,[0-9]+\): error" > /tmp/ts_errors.txt

echo "Total errors found: $(wc -l < /tmp/ts_errors.txt)"
echo ""
echo "Error categories:"
echo ""

# Count errors by type
echo "=== Error Type Distribution ==="
grep -o "error TS[0-9]*" /tmp/ts_errors.txt | sort | uniq -c | sort -nr

echo ""
echo "=== First 50 errors ==="
head -50 /tmp/ts_errors.txt